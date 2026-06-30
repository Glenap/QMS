"""mix_designs.py router — project-scoped /projects/{id}/mix-designs.

Mix designs are **RMC-owned** (the RMC submits them through a tokenised link, see
the public mix-submission router). Here the quality engineer **reviews** them
(approve / reject / in-progress) and anyone who can view the project can list them.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import PermissionDeniedError
from app.core.project_access import require_project
from app.database.session import get_db
from app.models.auth import User, UserRole
from app.models.master import Project
from app.schemas.master import GradeResponse, MixDesignResponse, MixDesignReview
from app.services.mixdesign_service import MixDesignService

router = APIRouter(prefix="/projects", tags=["mix-designs"])


def _ensure_quality_engineer(user: User) -> None:
    if user.role != UserRole.QUALITY_ENGINEER:
        raise PermissionDeniedError(
            "Only a quality engineer can review mix designs"
        )


@router.get("/{project_id}/mix-designs", response_model=list[MixDesignResponse])
async def list_mix_designs(
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await MixDesignService(db).list_for_project(project)


@router.get(
    "/{project_id}/mix-designs/approved-grades",
    response_model=list[GradeResponse],
)
async def list_approved_grades(
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    """Grades with an APPROVED mix design — the grades a pour may use."""
    return await MixDesignService(db).approved_grades(project)


@router.patch(
    "/{project_id}/mix-designs/{mix_design_id}/review",
    response_model=MixDesignResponse,
)
async def review_mix_design(
    mix_design_id: int,
    data: MixDesignReview,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """QE decision on a submitted mix design: APPROVE / REJECT(+reason) / IN_PROGRESS."""
    _ensure_quality_engineer(current_user)
    return await MixDesignService(db).review(
        project, mix_design_id, data, current_user
    )
