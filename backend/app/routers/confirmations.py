"""confirmations.py router — PUBLIC supplier/lab confirmation handshake.

No authentication: access is gated by a single-use random token emailed to the
supplier/lab. GET returns what to show on the confirm page; POST records the
CONFIRM/DECLINE (and any contact corrections).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.schemas.master import (
    ConfirmationResult,
    LabConfirmationView,
    LabConfirmSubmit,
    SupplierConfirmationView,
    SupplierConfirmSubmit,
)
from app.services.lab_service import LabService
from app.services.supplier_service import SupplierService

router = APIRouter(prefix="/external/confirm", tags=["confirmations"])


@router.get("/supplier", response_model=SupplierConfirmationView)
async def view_supplier_confirmation(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    return await SupplierService(db).get_confirmation(token)


@router.post("/supplier", response_model=ConfirmationResult)
async def submit_supplier_confirmation(
    data: SupplierConfirmSubmit,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    return await SupplierService(db).submit_confirmation(token, data)


@router.get("/lab", response_model=LabConfirmationView)
async def view_lab_confirmation(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    return await LabService(db).get_confirmation(token)


@router.post("/lab", response_model=ConfirmationResult)
async def submit_lab_confirmation(
    data: LabConfirmSubmit,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    return await LabService(db).submit_confirmation(token, data)
