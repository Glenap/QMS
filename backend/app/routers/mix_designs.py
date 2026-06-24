"""mix_designs.py router — project-scoped /projects/{id}/mix-designs.

Mix designs are submitted on the contractor side (their suppliers' approved
mixes). Listing is open to anyone who can view the project.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.project_access import ensure_can_manage_contractor_side, require_project
from app.database.session import get_db
from app.models.auth import User
from app.models.master import Project
from app.schemas.master import MixDesignCreate, MixDesignResponse
from app.services.mixdesign_service import MixDesignService

router = APIRouter(prefix="/projects", tags=["mix-designs"])


@router.get("/{project_id}/mix-designs", response_model=list[MixDesignResponse])
async def list_mix_designs(
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await MixDesignService(db).list_for_project(project)


@router.post(
    "/{project_id}/mix-designs", response_model=MixDesignResponse, status_code=201
)
async def create_mix_design(
    data: MixDesignCreate,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_can_manage_contractor_side(db, current_user, project)
    return await MixDesignService(db).create(project, data)
