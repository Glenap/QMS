"""floor_repo.py — DB queries for tower floors."""

from app.models.master import Floor, Tower
from app.repositories.base_repo import BaseRepository


class FloorRepository(BaseRepository[Floor]):
    model = Floor

    async def get_tower(self, tower_id: int) -> Tower | None:
        return await self.session.get(Tower, tower_id)
