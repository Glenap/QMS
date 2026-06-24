"""floors.py router — floors nested under a tower of a project.

Listing is open to anyone who can view the project. Creating/generating floors
is part of project setup, so either side's managers (client or contractor) may
do it.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.project_access import ensure_can_manage_project, require_project
from app.database.session import get_db
from app.models.auth import User
from app.models.master import Project
from app.schemas.master import FloorCreate, FloorGenerate, FloorResponse
from app.services.floor_service import FloorService

router = APIRouter(prefix="/projects", tags=["floors"])


@router.get(
    "/{project_id}/towers/{tower_id}/floors", response_model=list[FloorResponse]
)
async def list_floors(
    tower_id: int,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await FloorService(db).list_for_tower(project, tower_id)


@router.post(
    "/{project_id}/towers/{tower_id}/floors",
    response_model=FloorResponse,
    status_code=201,
)
async def create_floor(
    tower_id: int,
    data: FloorCreate,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_can_manage_project(db, current_user, project)
    return await FloorService(db).create(project, tower_id, data)


@router.post(
    "/{project_id}/towers/{tower_id}/floors/generate",
    response_model=list[FloorResponse],
    status_code=201,
)
async def generate_floors(
    tower_id: int,
    data: FloorGenerate,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk-create sequential floors for a tower (skips existing labels)."""
    await ensure_can_manage_project(db, current_user, project)
    return await FloorService(db).generate(project, tower_id, data)
