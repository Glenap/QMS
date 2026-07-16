"""ncrs.py router — Phase 5 NCR lifecycle.

Project-scoped under /projects/{id}. Anyone who can view the project reads the
NCR list and detail; the Quality Engineer drives the lifecycle — recording the
root cause, advancing the status (OPEN → UNDER_REVIEW → CLOSED), logging
corrective actions, ordering NDT/core retests, and notifying the RMC.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.project_access import require_project, require_project_role
from app.database.session import get_db
from app.models.auth import ProjectRole, User
from app.models.master import Project
from app.schemas.quality import (
    CorrectiveActionCreate,
    CorrectiveActionResponse,
    CorrectiveActionUpdate,
    NCRDetailResponse,
    NcrNotifyRmc,
    NcrPatternResponse,
    NCRResponse,
    NcrRmcNotificationResponse,
    NCRUpdate,
    RetestCreate,
    RetestResponse,
    RetestResultUpdate,
)
from app.services.ncr_service import NCRService

router = APIRouter(prefix="/projects", tags=["quality"])



# ── Reads (any project viewer) ────────────────────────────────────────────────


@router.get("/{project_id}/ncrs", response_model=list[NCRResponse])
async def list_ncrs(
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await NCRService(db).list_ncrs(project)


@router.get("/{project_id}/ncrs/{ncr_id}", response_model=NCRDetailResponse)
async def get_ncr(
    ncr_id: int,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await NCRService(db).get_ncr(project, ncr_id)


@router.get(
    "/{project_id}/ncrs/{ncr_id}/pattern", response_model=NcrPatternResponse
)
async def ncr_pattern(
    ncr_id: int,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    """Deterministic recurring-failure insight for this NCR's RMC + grade."""
    return await NCRService(db).ncr_pattern(project, ncr_id)


@router.get("/{project_id}/retests", response_model=list[RetestResponse])
async def list_retests(
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    """Every NDT / core retest across the project's NCRs."""
    return await NCRService(db).list_retests(project)


# ── Lifecycle (Quality Engineer) ──────────────────────────────────────────────


@router.patch("/{project_id}/ncrs/{ncr_id}", response_model=NCRDetailResponse)
async def update_ncr(
    ncr_id: int,
    data: NCRUpdate,
    project: Project = Depends(require_project_role(ProjectRole.QUALITY_ENGINEER)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await NCRService(db).update_ncr(project, ncr_id, data, current_user)


@router.post(
    "/{project_id}/ncrs/{ncr_id}/corrective-actions",
    response_model=CorrectiveActionResponse,
    status_code=201,
)
async def add_corrective_action(
    ncr_id: int,
    data: CorrectiveActionCreate,
    project: Project = Depends(require_project_role(ProjectRole.QUALITY_ENGINEER)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await NCRService(db).add_corrective_action(
        project, ncr_id, data, current_user
    )


@router.patch(
    "/{project_id}/ncrs/{ncr_id}/corrective-actions/{action_id}",
    response_model=CorrectiveActionResponse,
)
async def update_corrective_action(
    ncr_id: int,
    action_id: int,
    data: CorrectiveActionUpdate,
    project: Project = Depends(require_project_role(ProjectRole.QUALITY_ENGINEER)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await NCRService(db).update_corrective_action(
        project, ncr_id, action_id, data, current_user
    )


@router.post(
    "/{project_id}/ncrs/{ncr_id}/retests",
    response_model=RetestResponse,
    status_code=201,
)
async def order_retest(
    ncr_id: int,
    data: RetestCreate,
    project: Project = Depends(require_project_role(ProjectRole.QUALITY_ENGINEER)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await NCRService(db).order_retest(project, ncr_id, data, current_user)


@router.patch(
    "/{project_id}/ncrs/{ncr_id}/retests/{retest_id}",
    response_model=RetestResponse,
)
async def record_retest_result(
    ncr_id: int,
    retest_id: int,
    data: RetestResultUpdate,
    project: Project = Depends(require_project_role(ProjectRole.QUALITY_ENGINEER)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await NCRService(db).record_retest_result(
        project, ncr_id, retest_id, data, current_user
    )


@router.post(
    "/{project_id}/ncrs/{ncr_id}/notify-rmc",
    response_model=NcrRmcNotificationResponse,
    status_code=201,
)
async def notify_rmc(
    ncr_id: int,
    data: NcrNotifyRmc,
    project: Project = Depends(require_project_role(ProjectRole.QUALITY_ENGINEER)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await NCRService(db).notify_rmc(project, ncr_id, data, current_user)
