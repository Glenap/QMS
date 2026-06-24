"""mixdesign_repo.py — DB queries for mix designs."""

from app.models.master import Grade, MixDesign, Supplier
from app.repositories.base_repo import BaseRepository


class MixDesignRepository(BaseRepository[MixDesign]):
    model = MixDesign

    async def get_supplier(self, supplier_id: int) -> Supplier | None:
        return await self.session.get(Supplier, supplier_id)

    async def get_grade(self, grade_id: int) -> Grade | None:
        return await self.session.get(Grade, grade_id)
