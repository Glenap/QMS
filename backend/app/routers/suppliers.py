"""suppliers.py router — project-scoped /projects/{id}/suppliers endpoints.

Registering a supplier requires contractor-side management rights on the project
(CONTRACTOR_ADMIN of an accepted contractor org, or a CONTRACTOR_LEAD member).
Listing is available to anyone who can view the project.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.project_access import (
    ensure_can_block_entities,
    ensure_can_manage_client_side,
    ensure_can_manage_contractor_side,
    require_project,
    require_project_role,
)
from app.database.session import get_db
from app.models.auth import ProjectRole, User
from app.models.master import Project
from app.schemas.alert import RmcNotify
from app.schemas.master import (
    ApprovalReject,
    BlockRequest,
    MixDesignResponse,
    RequiredGradeInfo,
    RequiredGradesUpdate,
    SupplierCreate,
    SupplierResponse,
)
from app.services.mixdesign_service import MixDesignService
from app.services.supplier_service import SupplierService

router = APIRouter(prefix="/projects", tags=["suppliers"])


@router.post(
    "/{project_id}/suppliers", response_model=SupplierResponse, status_code=201
)
async def create_supplier(
    data: SupplierCreate,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register an RMC supplier. Who may register depends on the project's
    ``registration_by`` setting: the client (client-side rights) when CLIENT, else
    the contractor (contractor-side rights)."""
    if project.registration_by == "CLIENT":
        await ensure_can_manage_client_side(db, current_user, project)
    else:
        await ensure_can_manage_contractor_side(db, current_user, project)
    return await SupplierService(db).create(data, project, current_user)


@router.get("/{project_id}/suppliers", response_model=list[SupplierResponse])
async def list_suppliers(
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    """List suppliers registered for this project."""
    return await SupplierService(db).list_for_project(project)


@router.post(
    "/{project_id}/suppliers/{supplier_id}/resend-confirmation",
    response_model=SupplierResponse,
)
async def resend_supplier_confirmation(
    supplier_id: int,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-send the confirmation email to a supplier (contractor side)."""
    await ensure_can_manage_contractor_side(db, current_user, project)
    return await SupplierService(db).resend_confirmation(
        project, supplier_id, current_user
    )


# ── Mix-design requests (contractor names the grades; RMC submits via link) ──


@router.get(
    "/{project_id}/suppliers/{supplier_id}/required-grades",
    response_model=list[RequiredGradeInfo],
)
async def get_required_grades(
    supplier_id: int,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    """Grades this supplier was asked to submit mix designs for (+ their status)."""
    return await MixDesignService(db).get_required_grades(project, supplier_id)


@router.put(
    "/{project_id}/suppliers/{supplier_id}/required-grades",
    response_model=list[RequiredGradeInfo],
)
async def set_required_grades(
    supplier_id: int,
    data: RequiredGradesUpdate,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set the grades the RMC must submit mix designs for; mints + emails the
    submission link (contractor side)."""
    await ensure_can_manage_contractor_side(db, current_user, project)
    return await MixDesignService(db).set_required_grades(
        project, supplier_id, data.grade_ids, current_user
    )


@router.get(
    "/{project_id}/suppliers/{supplier_id}/mix-designs",
    response_model=list[MixDesignResponse],
)
async def list_supplier_mix_designs(
    supplier_id: int,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    """Mix designs this supplier has submitted for the project."""
    return await MixDesignService(db).list_for_supplier(project, supplier_id)


@router.post(
    "/{project_id}/suppliers/{supplier_id}/block", response_model=SupplierResponse
)
async def block_supplier(
    supplier_id: int,
    data: BlockRequest,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Block a supplier (with a reason) from new dispatches / mix-design requests."""
    await ensure_can_block_entities(db, current_user, project)
    return await SupplierService(db).set_blocked(
        project, supplier_id, current_user, blocked=True, reason=data.reason
    )


@router.post(
    "/{project_id}/suppliers/{supplier_id}/unblock", response_model=SupplierResponse
)
async def unblock_supplier(
    supplier_id: int,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_can_block_entities(db, current_user, project)
    return await SupplierService(db).set_blocked(
        project, supplier_id, current_user, blocked=False
    )


@router.post(
    "/{project_id}/suppliers/{supplier_id}/approve", response_model=SupplierResponse
)
async def approve_supplier(
    supplier_id: int,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Contractor accepts a client-registered RMC (→ usable for dispatch/mix)."""
    await ensure_can_manage_contractor_side(db, current_user, project)
    return await SupplierService(db).set_approval(
        project, supplier_id, current_user, accepted=True
    )


@router.post(
    "/{project_id}/suppliers/{supplier_id}/reject", response_model=SupplierResponse
)
async def reject_supplier(
    supplier_id: int,
    data: ApprovalReject,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Contractor rejects a client-registered RMC (→ not usable), with a reason."""
    await ensure_can_manage_contractor_side(db, current_user, project)
    return await SupplierService(db).set_approval(
        project, supplier_id, current_user, accepted=False, reason=data.reason
    )


@router.post("/{project_id}/suppliers/{supplier_id}/notify", status_code=204)
async def notify_supplier(
    supplier_id: int,
    data: RmcNotify,
    project: Project = Depends(
        require_project_role(ProjectRole.QUALITY_ENGINEER, ProjectRole.PROJECT_MANAGER)
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """QE/PM emails the RMC about a quality issue."""
    await SupplierService(db).notify_issue(project, supplier_id, data, current_user)
