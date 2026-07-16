"""pours.py router — project-scoped /projects/{id}/pours.

Pour cards are recorded by the project's Quality Engineer from an accepted
delivery. Listing and detail are available to anyone who can view the project.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.project_access import require_project, require_project_role
from app.database.session import get_db
from app.models.auth import ProjectRole, User
from app.models.master import Project
from app.schemas.transaction import PourCreate, PourResponse
from app.services.pour_service import PourService

router = APIRouter(prefix="/projects", tags=["pours"])


@router.post("/{project_id}/pours", response_model=PourResponse, status_code=201)
async def create_pour(
    data: PourCreate,
    project: Project = Depends(require_project_role(ProjectRole.QUALITY_ENGINEER)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await PourService(db).create(data, project, current_user)


@router.get("/{project_id}/pours", response_model=list[PourResponse])
async def list_pours(
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await PourService(db).list_for_project(project)


@router.get("/{project_id}/pours/{pour_id}", response_model=PourResponse)
async def get_pour(
    pour_id: int,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await PourService(db).get(project, pour_id)
