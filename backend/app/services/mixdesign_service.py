"""mixdesign_service.py — business logic for mix designs.

A mix design ties a supplier + grade to a project, with the trial-mix
proportions and approval status. File upload of the approved PDF is deferred to
the documents phase; this stores the structured metadata only.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.master import Grade, MixDesign, Project, Supplier
from app.repositories.mixdesign_repo import MixDesignRepository
from app.schemas.master import MixDesignCreate, MixDesignResponse


class MixDesignService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = MixDesignRepository(session)

    async def list_for_project(self, project: Project) -> list[MixDesignResponse]:
        rows = await self.repo.list_by(
            MixDesign.project_id == project.project_id,
            order_by=MixDesign.created_at.desc(),
        )
        return [await self._to_response(md) for md in rows]

    async def create(
        self, project: Project, data: MixDesignCreate
    ) -> MixDesignResponse:
        supplier = await self.repo.get_supplier(data.supplier_id)
        if not supplier or supplier.project_id != project.project_id:
            raise NotFoundError("Supplier")
        grade = await self.repo.get_grade(data.grade_id)
        if not grade:
            raise NotFoundError("Grade")

        md = await self.repo.add(
            MixDesign(project_id=project.project_id, **data.model_dump())
        )
        return await self._to_response(md, supplier=supplier, grade=grade)

    async def _to_response(
        self,
        md: MixDesign,
        supplier: Supplier | None = None,
        grade: Grade | None = None,
    ) -> MixDesignResponse:
        if supplier is None:
            supplier = await self.repo.get_supplier(md.supplier_id)
        if grade is None:
            grade = await self.repo.get_grade(md.grade_id)
        return MixDesignResponse(
            mix_design_id=md.mix_design_id,
            project_id=md.project_id,
            supplier_id=md.supplier_id,
            supplier_name=supplier.supplier_name if supplier else None,
            grade_id=md.grade_id,
            grade_name=grade.grade_name if grade else None,
            contractor_name=md.contractor_name,
            wc_ratio=md.wc_ratio,
            cement_type=md.cement_type,
            approval_status=md.approval_status,
            strength_28day_mpa=md.strength_28day_mpa,
            created_at=md.created_at,
        )
