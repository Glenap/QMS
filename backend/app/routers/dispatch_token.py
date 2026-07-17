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


from fastapi import BackgroundTasks, UploadFile, File
from app.services.ocr_service import OcrService
from app.schemas.ocr import OcrJobResponse

@router.post("/dispatch/ocr", response_model=dict, status_code=202)
async def create_dispatch_ocr_job(
    token: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    view = await DispatchService(db).get_fill_view(token)
    
    pdf_bytes = await file.read()
    service = OcrService(db)
    job_id = await service.create_anonymous_job(view.project_id)
    
    background_tasks.add_task(service.process_job_in_background, job_id, pdf_bytes)
    
    return {"job_id": job_id}


@router.get("/dispatch/ocr/{job_id}", response_model=OcrJobResponse)
async def get_dispatch_ocr_job(
    token: str,
    job_id: str,
    db: AsyncSession = Depends(get_db),
):
    view = await DispatchService(db).get_fill_view(token)
    service = OcrService(db)
    return await service.get_job(job_id, view.project_id)
