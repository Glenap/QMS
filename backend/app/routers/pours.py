"""pours.py router — project-scoped /projects/{id}/pours.

Pour cards are raised and completed by the project's Quality Engineer. Listing
and detail are available to anyone who can view the project.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import PermissionDeniedError
from app.core.project_access import require_project
from app.database.session import get_db
from app.models.auth import User, UserRole
from app.models.master import Project
from app.schemas.transaction import PourComplete, PourCreate, PourResponse
from app.services.pour_service import PourService

router = APIRouter(prefix="/projects", tags=["pours"])


def _ensure_quality_engineer(user: User) -> None:
    if user.role != UserRole.QUALITY_ENGINEER:
        raise PermissionDeniedError(
            "Only a quality engineer can raise or complete pour cards"
        )


@router.post("/{project_id}/pours", response_model=PourResponse, status_code=201)
async def create_pour(
    data: PourCreate,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_quality_engineer(current_user)
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


@router.patch("/{project_id}/pours/{pour_id}/complete", response_model=PourResponse)
async def complete_pour(
    pour_id: int,
    data: PourComplete,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_quality_engineer(current_user)
    return await PourService(db).complete(project, pour_id, data)
