"""suppliers.py router — project-scoped /projects/{id}/suppliers endpoints.

Registering a supplier requires contractor-side management rights on the project
(CONTRACTOR_ADMIN of an accepted contractor org, or a CONTRACTOR_LEAD member).
Listing is available to anyone who can view the project.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.project_access import ensure_can_manage_contractor_side, require_project
from app.database.session import get_db
from app.models.auth import User
from app.models.master import Project
from app.schemas.master import SupplierCreate, SupplierResponse
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
    """Register an RMC supplier for this project (contractor side)."""
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
