"""dispatches.py router — project-scoped RMC dispatch + gate scan.

Two audiences, one router:

  /projects/{id}/dispatches…  — the Quality Engineer raises a dispatch (which
      emails the supplier a tokenised truck-fill link) and anyone on the project
      can list/view them.
  /projects/{id}/gate/{token}… — the site Supervisor scans an arriving truck in
      and accepts/rejects the delivery.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.project_access import require_project, require_project_role
from app.database.session import get_db
from app.models.auth import ProjectRole, User
from app.models.master import Project
from app.schemas.transaction import (
    ActionRequired,
    DispatchCreate,
    DispatchResponse,
    GateTruckView,
    InsituSubmit,
    QEInboxCount,
    QEReviewItem,
    TruckArrive,
    TruckReject,
)
from app.services.dispatch_service import DispatchService

router = APIRouter(prefix="/projects", tags=["dispatches"])


# ── Dispatches (Quality Engineer raises; any viewer reads) ───────────────────


@router.post(
    "/{project_id}/dispatches", response_model=DispatchResponse, status_code=201
)
async def create_dispatch(
    data: DispatchCreate,
    project: Project = Depends(require_project_role(ProjectRole.QUALITY_ENGINEER)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await DispatchService(db).create(data, project, current_user)


@router.get("/{project_id}/dispatches", response_model=list[DispatchResponse])
async def list_dispatches(
    pour_id: int | None = None,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await DispatchService(db).list_for_project(project, pour_id)


@router.get(
    "/{project_id}/dispatches/{dispatch_id}", response_model=DispatchResponse
)
async def get_dispatch(
    dispatch_id: int,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    return await DispatchService(db).get(project, dispatch_id)


@router.post(
    "/{project_id}/dispatches/{dispatch_id}/resend", response_model=DispatchResponse
)
async def resend_dispatch(
    dispatch_id: int,
    project: Project = Depends(require_project_role(ProjectRole.QUALITY_ENGINEER)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await DispatchService(db).resend(project, dispatch_id, current_user)


# ── Gate scan (Supervisor) ───────────────────────────────────────────────────


@router.get("/{project_id}/gate/{token}", response_model=GateTruckView)
async def gate_lookup(
    token: str,
    project: Project = Depends(require_project_role(ProjectRole.SUPERVISOR)),
    db: AsyncSession = Depends(get_db),
):
    return await DispatchService(db).gate_view(project, token)


@router.post("/{project_id}/gate/{token}/arrive", response_model=GateTruckView)
async def gate_arrive(
    token: str,
    data: TruckArrive,
    project: Project = Depends(require_project_role(ProjectRole.SUPERVISOR)),
    db: AsyncSession = Depends(get_db),
):
    return await DispatchService(db).arrive(project, token, data)


@router.post("/{project_id}/gate/{token}/accept", response_model=GateTruckView)
async def gate_accept(
    token: str,
    project: Project = Depends(require_project_role(ProjectRole.SUPERVISOR)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await DispatchService(db).accept(project, token, current_user)


@router.post("/{project_id}/gate/{token}/reject", response_model=GateTruckView)
async def gate_reject(
    token: str,
    data: TruckReject,
    project: Project = Depends(require_project_role(ProjectRole.SUPERVISOR)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await DispatchService(db).reject(project, token, current_user, data)


@router.post(
    "/{project_id}/gate/{token}/action-required", response_model=GateTruckView
)
async def gate_action_required(
    token: str,
    data: ActionRequired,
    project: Project = Depends(require_project_role(ProjectRole.SUPERVISOR)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Supervisor flags a mismatch on an admitted truck → the QE's inbox."""
    return await DispatchService(db).raise_action(project, token, data, current_user)


# ── QE inbox + in-situ slump sign-off ────────────────────────────────────────


@router.get("/{project_id}/qe-inbox", response_model=list[QEReviewItem])
async def qe_inbox(
    project: Project = Depends(require_project_role(ProjectRole.QUALITY_ENGINEER)),
    db: AsyncSession = Depends(get_db),
):
    """Deliveries awaiting the QE's in-situ sign-off (PENDING_QE)."""
    return await DispatchService(db).qe_inbox(project)


@router.get("/{project_id}/qe-inbox/count", response_model=QEInboxCount)
async def qe_inbox_count(
    project: Project = Depends(require_project_role(ProjectRole.QUALITY_ENGINEER)),
    db: AsyncSession = Depends(get_db),
):
    return QEInboxCount(count=await DispatchService(db).qe_inbox_count(project))


@router.post(
    "/{project_id}/dispatches/{dispatch_id}/insitu", response_model=GateTruckView
)
async def record_insitu(
    dispatch_id: int,
    data: InsituSubmit,
    project: Project = Depends(require_project_role(ProjectRole.QUALITY_ENGINEER)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """QE records the in-situ slump test + decision; APPROVE accepts + credits the
    pour (slump must pass), REJECT notifies the RMC."""
    return await DispatchService(db).record_insitu(
        project, dispatch_id, data, current_user
    )
