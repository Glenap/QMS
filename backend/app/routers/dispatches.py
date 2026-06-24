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
from app.core.exceptions import PermissionDeniedError
from app.core.project_access import require_project
from app.database.session import get_db
from app.models.auth import User, UserRole
from app.models.master import Project
from app.schemas.transaction import (
    DispatchCreate,
    DispatchResponse,
    GateTruckView,
    TruckArrive,
    TruckReject,
)
from app.services.dispatch_service import DispatchService

router = APIRouter(prefix="/projects", tags=["dispatches"])


def _ensure_quality_engineer(user: User) -> None:
    if user.role != UserRole.QUALITY_ENGINEER:
        raise PermissionDeniedError(
            "Only a quality engineer can raise a concrete dispatch"
        )


def _ensure_supervisor(user: User) -> None:
    if user.role != UserRole.SUPERVISOR:
        raise PermissionDeniedError("Only a site supervisor can work the gate")


# ── Dispatches (Quality Engineer raises; any viewer reads) ───────────────────


@router.post(
    "/{project_id}/dispatches", response_model=DispatchResponse, status_code=201
)
async def create_dispatch(
    data: DispatchCreate,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_quality_engineer(current_user)
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
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_quality_engineer(current_user)
    return await DispatchService(db).resend(project, dispatch_id, current_user)


# ── Gate scan (Supervisor) ───────────────────────────────────────────────────


@router.get("/{project_id}/gate/{token}", response_model=GateTruckView)
async def gate_lookup(
    token: str,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_supervisor(current_user)
    return await DispatchService(db).gate_view(project, token)


@router.post("/{project_id}/gate/{token}/arrive", response_model=GateTruckView)
async def gate_arrive(
    token: str,
    data: TruckArrive,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_supervisor(current_user)
    return await DispatchService(db).arrive(project, token, data)


@router.post("/{project_id}/gate/{token}/accept", response_model=GateTruckView)
async def gate_accept(
    token: str,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_supervisor(current_user)
    return await DispatchService(db).accept(project, token, current_user)


@router.post("/{project_id}/gate/{token}/reject", response_model=GateTruckView)
async def gate_reject(
    token: str,
    data: TruckReject,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_supervisor(current_user)
    return await DispatchService(db).reject(project, token, current_user, data)
