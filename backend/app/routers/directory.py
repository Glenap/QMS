"""directory.py router — organisation-wide, cross-project directories.

Read-only roll-ups the org roster (team) doesn't cover: every RMC supplier and
testing lab the caller's organisation can see, across all its projects, with the
project + contractor each is attached to. A client org sees all entities on its
projects; a contractor org sees the ones it holds. Any authenticated org member
may read (the per-project pages own registration / block / approval actions).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models.auth import User
from app.schemas.master import LabDirectoryItem, SupplierDirectoryItem
from app.services.lab_service import LabService
from app.services.supplier_service import SupplierService

router = APIRouter(prefix="/directory", tags=["directory"])


@router.get("/suppliers", response_model=list[SupplierDirectoryItem])
async def org_suppliers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await SupplierService(db).list_for_org(current_user)


@router.get("/labs", response_model=list[LabDirectoryItem])
async def org_labs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await LabService(db).list_for_org(current_user)
