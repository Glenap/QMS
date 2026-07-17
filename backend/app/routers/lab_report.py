"""lab_report.py router — PUBLIC tokenised cube-report submission for labs.

No authentication: access is gated by the single long-lived token emailed to
the lab when the QE dispatches a cube sample. The lab first establishes the
testing day (anchoring the 7/14/28-day schedule), then submits each milestone
strength report — optionally with a PDF — which lands straight in the project's
cube results. A failing 28-day result auto-raises an NCR.
"""

from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.schemas.lab_report import (
    LabReportResult,
    LabReportStart,
    LabReportSubmit,
    LabReportView,
)
from app.services.cube_service import CubeService

router = APIRouter(prefix="/external/lab-report", tags=["lab-report"])


@router.get("", response_model=LabReportView)
async def view_lab_report(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    return await CubeService(db).get_report_view(token)


@router.post("/start", response_model=LabReportView)
async def start_testing(
    data: LabReportStart,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    return await CubeService(db).start_testing(token, data)


@router.post("", response_model=LabReportResult)
async def submit_lab_report(
    token: str,
    test_age_days: int = Form(...),
    observed_strength_mpa: float = Form(...),
    test_date: date | None = Form(None),
    lab_report_reference: str | None = Form(None),
    file: UploadFile = File(...),  # the signed lab report PDF is mandatory
    db: AsyncSession = Depends(get_db),
):
    pdf_content = await file.read()
    data = LabReportSubmit(
        test_age_days=test_age_days,
        observed_strength_mpa=observed_strength_mpa,
        test_date=test_date,
        lab_report_reference=lab_report_reference,
    )
    return await CubeService(db).submit_report(
        token,
        data,
        pdf_filename=file.filename,
        pdf_content=pdf_content,
        pdf_content_type=file.content_type,
    )


from fastapi import BackgroundTasks
from app.services.ocr_service import OcrService
from app.schemas.ocr import OcrJobResponse

@router.post("/ocr", response_model=dict, status_code=202)
async def create_lab_report_ocr_job(
    token: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    # Authenticate token and get project_id
    view = await CubeService(db).get_report_view(token)
    
    pdf_bytes = await file.read()
    service = OcrService(db)
    job_id = await service.create_anonymous_job(view.project_id)
    
    background_tasks.add_task(service.process_job_in_background, job_id, pdf_bytes)
    
    return {"job_id": job_id}


@router.get("/ocr/{job_id}", response_model=OcrJobResponse)
async def get_lab_report_ocr_job(
    token: str,
    job_id: str,
    db: AsyncSession = Depends(get_db),
):
    view = await CubeService(db).get_report_view(token)
    service = OcrService(db)
    return await service.get_job(job_id, view.project_id)
