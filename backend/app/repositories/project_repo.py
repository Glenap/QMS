"""project_repo.py — DB queries for projects and their towers."""

from sqlalchemy import select

from app.models.master import Project, Tower
from app.repositories.base_repo import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    model = Project

    async def add_tower(self, tower: Tower) -> Tower:
        self.session.add(tower)
        await self.session.flush()
        await self.session.refresh(tower)
        return tower

    async def list_towers(self, project_id: int) -> list[Tower]:
        res = await self.session.execute(
            select(Tower)
            .where(Tower.project_id == project_id)
            .order_by(Tower.tower_name)
        )
        return list(res.scalars().all())
