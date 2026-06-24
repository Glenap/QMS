"""catalog_service.py — read access to the global grade + component catalogs."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.master import Component, Grade
from app.repositories.catalog_repo import ComponentRepository, GradeRepository
from app.schemas.master import ComponentResponse, GradeResponse


class CatalogService:
    def __init__(self, session: AsyncSession):
        self.grades = GradeRepository(session)
        self.components = ComponentRepository(session)

    async def list_grades(self) -> list[GradeResponse]:
        rows = await self.grades.list_by(order_by=Grade.min_strength_mpa)
        return [GradeResponse.model_validate(g) for g in rows]

    async def list_components(self) -> list[ComponentResponse]:
        rows = await self.components.list_by(order_by=Component.component_id)
        return [ComponentResponse.model_validate(c) for c in rows]
