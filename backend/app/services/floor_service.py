"""floor_service.py — business logic for tower floors.

Floors belong to a tower, which belongs to a project. Every operation verifies
the tower actually belongs to the project in the URL before touching floors.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.master import Floor, Project, Tower
from app.repositories.floor_repo import FloorRepository
from app.schemas.master import FloorCreate, FloorGenerate, FloorResponse


class FloorService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = FloorRepository(session)

    async def _tower_in_project(self, tower_id: int, project: Project) -> Tower:
        tower = await self.repo.get_tower(tower_id)
        if not tower or tower.project_id != project.project_id:
            raise NotFoundError("Tower")
        return tower

    async def list_for_tower(self, project: Project, tower_id: int) -> list[FloorResponse]:
        await self._tower_in_project(tower_id, project)
        floors = await self.repo.list_by(
            Floor.tower_id == tower_id, order_by=Floor.floor_number
        )
        return [FloorResponse.model_validate(f) for f in floors]

    async def create(
        self, project: Project, tower_id: int, data: FloorCreate
    ) -> FloorResponse:
        await self._tower_in_project(tower_id, project)
        floor = await self.repo.add(
            Floor(
                tower_id=tower_id,
                floor_label=data.floor_label,
                floor_number=data.floor_number,
            )
        )
        return FloorResponse.model_validate(floor)

    async def generate(
        self, project: Project, tower_id: int, data: FloorGenerate
    ) -> list[FloorResponse]:
        """Bulk-create sequential floors, skipping labels that already exist."""
        await self._tower_in_project(tower_id, project)
        existing = {
            f.floor_label
            for f in await self.repo.list_by(Floor.tower_id == tower_id)
        }
        created: list[FloorResponse] = []
        for n in range(data.start_number, data.start_number + data.count):
            label = f"{data.label_prefix}{n}"
            if label in existing:
                continue
            floor = await self.repo.add(
                Floor(tower_id=tower_id, floor_label=label, floor_number=n)
            )
            created.append(FloorResponse.model_validate(floor))
        return created
