"""pour_repo.py — DB queries for pours."""

from app.models.transaction import Pour
from app.repositories.base_repo import BaseRepository


class PourRepository(BaseRepository[Pour]):
    model = Pour

    async def get_in_project(self, pour_id: int, project_id: int) -> Pour | None:
        pour = await self.session.get(Pour, pour_id)
        if pour and pour.project_id == project_id:
            return pour
        return None
