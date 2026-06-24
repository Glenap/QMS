"""pour_service.py — business logic for pour cards.

A pour ties a location (tower→floor→component), a concrete grade, and an RMC
supplier together for a planned concrete pour. Raised by the project's Quality
Engineer; later phases attach truck dispatches and cube samples.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    NotFoundError,
    PermissionDeniedError,
    PourAlreadyCompletedError,
)
from app.models.auth import User
from app.models.master import (
    Component,
    Floor,
    Grade,
    MixDesign,
    Project,
    ProjectContractor,
    Supplier,
    Tower,
)
from app.models.transaction import Pour, PourStatus
from app.repositories.pour_repo import PourRepository
from app.schemas.transaction import PourComplete, PourCreate, PourResponse


class PourService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = PourRepository(session)

    async def create(
        self, data: PourCreate, project: Project, user: User
    ) -> PourResponse:
        pid = project.project_id

        tower = await self.session.get(Tower, data.tower_id)
        if not tower or tower.project_id != pid:
            raise NotFoundError("Tower")
        await self._ensure_tower_in_scope(tower, project, user)

        floor = await self.session.get(Floor, data.floor_id)
        if not floor or floor.tower_id != data.tower_id:
            raise NotFoundError("Floor")

        if not await self.session.get(Component, data.component_id):
            raise NotFoundError("Component")
        if not await self.session.get(Grade, data.grade_id):
            raise NotFoundError("Grade")

        supplier = await self.session.get(Supplier, data.supplier_horizontal_id)
        if not supplier or supplier.project_id != pid:
            raise NotFoundError("Supplier")

        if data.supplier_vertical_id is not None:
            sv = await self.session.get(Supplier, data.supplier_vertical_id)
            if not sv or sv.project_id != pid:
                raise NotFoundError("Vertical supplier")

        if data.mix_design_id is not None:
            md = await self.session.get(MixDesign, data.mix_design_id)
            if not md or md.project_id != pid:
                raise NotFoundError("Mix design")

        pour = await self.repo.add(
            Pour(
                project_id=pid,
                recorded_by=user.user_id,
                status=PourStatus.PLANNED,
                **data.model_dump(),
            )
        )
        return await self._to_response(pour)

    async def _ensure_tower_in_scope(
        self, tower: Tower, project: Project, user: User
    ) -> None:
        """A contractor may only raise pours on towers allotted to them. The
        contractor's ``ProjectContractor.scope`` is a readable label of tower
        names ("Tower A, Tower B"); ``None`` or "Entire project" means no
        restriction (and covers client-side actors with no contractor link)."""
        res = await self.session.execute(
            select(ProjectContractor.scope).where(
                ProjectContractor.contractor_org_id == user.org_id,
                ProjectContractor.project_id == project.project_id,
            )
        )
        scope = res.scalar_one_or_none()
        if not scope or scope == "Entire project":
            return
        allowed = {name.strip() for name in scope.split(",")}
        if tower.tower_name not in allowed:
            raise PermissionDeniedError(
                "That tower isn't part of your contract scope on this project"
            )

    async def list_for_project(self, project: Project) -> list[PourResponse]:
        pours = await self.repo.list_by(
            Pour.project_id == project.project_id,
            order_by=Pour.pour_date.desc(),
        )
        return [await self._to_response(p) for p in pours]

    async def get(self, project: Project, pour_id: int) -> PourResponse:
        pour = await self.repo.get_in_project(pour_id, project.project_id)
        if not pour:
            raise NotFoundError("Pour")
        return await self._to_response(pour)

    async def complete(
        self, project: Project, pour_id: int, data: PourComplete
    ) -> PourResponse:
        pour = await self.repo.get_in_project(pour_id, project.project_id)
        if not pour:
            raise NotFoundError("Pour")
        if pour.status == PourStatus.COMPLETED:
            raise PourAlreadyCompletedError()

        pour.status = PourStatus.COMPLETED
        pour.completed_at = datetime.now(UTC)
        if data.volume_actual_cum is not None:
            pour.volume_actual_cum = data.volume_actual_cum
        if data.completion_notes is not None:
            pour.completion_notes = data.completion_notes
        await self.session.flush()
        await self.session.refresh(pour)
        return await self._to_response(pour)

    async def _to_response(self, pour: Pour) -> PourResponse:
        # session.get hits the identity map, so repeated lookups across a list
        # don't re-query the same tower/grade/etc.
        tower = await self.session.get(Tower, pour.tower_id)
        floor = await self.session.get(Floor, pour.floor_id)
        component = await self.session.get(Component, pour.component_id)
        grade = await self.session.get(Grade, pour.grade_id)
        supplier = await self.session.get(Supplier, pour.supplier_horizontal_id)
        return PourResponse(
            pour_id=pour.pour_id,
            project_id=pour.project_id,
            tower_id=pour.tower_id,
            tower_name=tower.tower_name if tower else None,
            floor_id=pour.floor_id,
            floor_label=floor.floor_label if floor else None,
            component_id=pour.component_id,
            component_type=component.component_type.value if component else None,
            grade_id=pour.grade_id,
            grade_name=grade.grade_name if grade else None,
            supplier_horizontal_id=pour.supplier_horizontal_id,
            supplier_name=supplier.supplier_name if supplier else None,
            pour_date=pour.pour_date,
            pour_reference=pour.pour_reference,
            volume_cum=pour.volume_cum,
            sub_contractor_name=pour.sub_contractor_name,
            status=pour.status,
            volume_actual_cum=pour.volume_actual_cum,
            completion_notes=pour.completion_notes,
            completed_at=pour.completed_at,
            created_at=pour.created_at,
        )
