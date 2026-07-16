"""pour_service.py — business logic for pour cards.

A pour records a completed concrete placement. The QE creates it **from an
accepted truck delivery**: grade, supplier and volume come from the delivery, and
the QE supplies the placement location (tower→floor→component). One delivery
yields one pour, and the pour's volume is the delivered (accepted) volume — there
is no separate planned volume or delivery rollup.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.date_rules import ensure_not_after
from app.core.exceptions import (
    DeliveryNotAcceptedError,
    NotFoundError,
    PermissionDeniedError,
    PourAlreadyExistsError,
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
from app.models.transaction import Pour, PourDispatchLink, PourStatus, TruckStatus
from app.repositories.dispatch_repo import DispatchRepository, TruckRepository
from app.repositories.pour_repo import PourRepository
from app.schemas.transaction import PourCreate, PourResponse


class PourService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = PourRepository(session)
        self.dispatch = DispatchRepository(session)
        self.trucks = TruckRepository(session)

    async def create(
        self, data: PourCreate, project: Project, user: User
    ) -> PourResponse:
        pid = project.project_id

        # The delivery this pour records: an accepted truck with no pour yet.
        dispatch = await self.dispatch.get_in_project(data.dispatch_id, pid)
        if not dispatch:
            raise NotFoundError("Dispatch")
        truck = await self.trucks.get_for_dispatch(dispatch.dispatch_id)
        if not truck or truck.status != TruckStatus.ACCEPTED:
            raise DeliveryNotAcceptedError()
        if await self.dispatch.pour_id_for(dispatch.dispatch_id) is not None:
            raise PourAlreadyExistsError()

        tower = await self.session.get(Tower, data.tower_id)
        if not tower or tower.project_id != pid:
            raise NotFoundError("Tower")
        await self._ensure_tower_in_scope(tower, project, user)

        floor = await self.session.get(Floor, data.floor_id)
        if not floor or floor.tower_id != data.tower_id:
            raise NotFoundError("Floor")

        if not await self.session.get(Component, data.component_id):
            raise NotFoundError("Component")

        if data.supplier_vertical_id is not None:
            sv = await self.session.get(Supplier, data.supplier_vertical_id)
            if not sv or sv.project_id != pid:
                raise NotFoundError("Vertical supplier")

        if data.mix_design_id is not None:
            md = await self.session.get(MixDesign, data.mix_design_id)
            if not md or md.project_id != pid:
                raise NotFoundError("Mix design")

        # A pour can't be dated before the project starts or after it ends.
        ensure_not_after(
            project.start_date, data.pour_date,
            earlier_label="project start date", later_label="pour date",
        )
        ensure_not_after(
            data.pour_date, project.end_date,
            earlier_label="pour date", later_label="project end date",
        )

        # Grade, supplier and volume are the delivery's — the volume placed is the
        # accepted truck's load. The pour is complete the moment it's recorded.
        volume = (
            float(dispatch.volume_received_cum)
            if dispatch.volume_received_cum is not None
            else None
        )
        pour = await self.repo.add(
            Pour(
                project_id=pid,
                tower_id=data.tower_id,
                floor_id=data.floor_id,
                component_id=data.component_id,
                grade_id=dispatch.grade_id,
                supplier_horizontal_id=dispatch.supplier_id,
                supplier_vertical_id=data.supplier_vertical_id,
                mix_design_id=data.mix_design_id,
                pour_date=data.pour_date,
                pour_reference=data.pour_reference,
                volume_cum=volume,
                volume_actual_cum=volume,
                sub_contractor_name=data.sub_contractor_name,
                status=PourStatus.COMPLETED,
                completed_at=datetime.now(UTC),
                recorded_by=user.user_id,
            )
        )
        self.session.add(
            PourDispatchLink(pour_id=pour.pour_id, dispatch_id=dispatch.dispatch_id)
        )
        await self.session.flush()
        return await self._to_response(pour, dispatch_id=dispatch.dispatch_id)

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

    async def _to_response(
        self, pour: Pour, *, dispatch_id: int | None = None
    ) -> PourResponse:
        if dispatch_id is None:
            dispatch_id = await self.dispatch.dispatch_id_for_pour(pour.pour_id)
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
            dispatch_id=dispatch_id,
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
