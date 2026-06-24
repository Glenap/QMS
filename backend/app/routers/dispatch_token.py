"""dispatch_token.py router — PUBLIC truck-fill page for RMC suppliers.

No authentication: access is gated by the single-use token emailed to the
supplier when the QE raises a dispatch. GET returns the order context to show on
the fill page; POST records the truck details (vehicle, batch, slump, …).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.schemas.transaction import TruckActionResult, TruckFillSubmit, TruckFillView
from app.services.dispatch_service import DispatchService

router = APIRouter(prefix="/external", tags=["dispatch-token"])


@router.get("/dispatch", response_model=TruckFillView)
async def view_truck_fill(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    return await DispatchService(db).get_fill_view(token)


@router.post("/dispatch", response_model=TruckActionResult)
async def submit_truck_fill(
    data: TruckFillSubmit,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    return await DispatchService(db).submit_fill(token, data)
