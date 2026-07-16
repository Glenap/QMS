"""labs.py router — project-scoped /projects/{id}/labs endpoints.

Registering a lab requires contractor-side management rights on the project
(CONTRACTOR_ADMIN of an accepted contractor org, or a CONTRACTOR_LEAD member).
Listing is available to anyone who can view the project.

Note: public/external lab self-registration via invitation token is a
later-phase concern.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.project_access import (
    ensure_can_block_entities,
    ensure_can_manage_client_side,
    ensure_can_manage_contractor_side,
    require_project,
)
from app.database.session import get_db
from app.models.auth import User
from app.models.master import Project
from app.schemas.master import ApprovalReject, BlockRequest, LabCreate, LabResponse
from app.services.lab_service import LabService

router = APIRouter(prefix="/projects", tags=["labs"])


@router.post("/{project_id}/labs", response_model=LabResponse, status_code=201)
async def create_lab(
    data: LabCreate,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a testing lab. Who may register depends on the project's
    ``registration_by``: the client (client-side) when CLIENT, else the
    contractor (contractor-side)."""
    if project.registration_by == "CLIENT":
        await ensure_can_manage_client_side(db, current_user, project)
    else:
        await ensure_can_manage_contractor_side(db, current_user, project)
    return await LabService(db).create(data, project, current_user)


@router.get("/{project_id}/labs", response_model=list[LabResponse])
async def list_labs(
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    """List testing labs registered for this project."""
    return await LabService(db).list_for_project(project)


@router.post(
    "/{project_id}/labs/{lab_id}/resend-confirmation",
    response_model=LabResponse,
)
async def resend_lab_confirmation(
    lab_id: int,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-send the confirmation email to a lab (contractor side)."""
    await ensure_can_manage_contractor_side(db, current_user, project)
    return await LabService(db).resend_confirmation(project, lab_id, current_user)


@router.post("/{project_id}/labs/{lab_id}/block", response_model=LabResponse)
async def block_lab(
    lab_id: int,
    data: BlockRequest,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Block a lab (with a reason) from new cube samples / report links."""
    await ensure_can_block_entities(db, current_user, project)
    return await LabService(db).set_blocked(
        project, lab_id, current_user, blocked=True, reason=data.reason
    )


@router.post("/{project_id}/labs/{lab_id}/unblock", response_model=LabResponse)
async def unblock_lab(
    lab_id: int,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_can_block_entities(db, current_user, project)
    return await LabService(db).set_blocked(project, lab_id, current_user, blocked=False)


@router.post("/{project_id}/labs/{lab_id}/approve", response_model=LabResponse)
async def approve_lab(
    lab_id: int,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Contractor accepts a client-registered lab (→ usable for cube dispatch)."""
    await ensure_can_manage_contractor_side(db, current_user, project)
    return await LabService(db).set_approval(
        project, lab_id, current_user, accepted=True
    )


@router.post("/{project_id}/labs/{lab_id}/reject", response_model=LabResponse)
async def reject_lab(
    lab_id: int,
    data: ApprovalReject,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Contractor rejects a client-registered lab (→ not usable), with a reason."""
    await ensure_can_manage_contractor_side(db, current_user, project)
    return await LabService(db).set_approval(
        project, lab_id, current_user, accepted=False, reason=data.reason
    )
