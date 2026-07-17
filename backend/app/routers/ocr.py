"""ocr.py — API router for Intelligent Document Processing.

Routes:
  GET  /projects/{id}/ocr/{job_id}            — Poll job status
  POST /projects/{id}/ocr/{job_id}/corrections — Submit user corrections
"""

from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.project_access import require_project
from app.database.session import get_db
from app.models.auth import User
from app.models.master import Project
from app.schemas.ocr import OcrFieldCorrectionCreate, OcrJobResponse, OcrJobCreate
from app.services.ocr_service import OcrService
from app.services.document_service import DocumentService

router = APIRouter(prefix="/projects/{project_id}/ocr", tags=["OCR"])


@router.post(
    "",
    response_model=dict,
    status_code=202,
    summary="Queue an OCR extraction job for a document",
)
async def create_ocr_job(
    data: OcrJobCreate,
    background_tasks: BackgroundTasks,
    project: Project = Depends(require_project),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await DocumentService(db).get_for_download(project, data.document_id)
    service = OcrService(db)
    job_id = await service.create_job(project, doc, user)
    
    # Run the processing in the background so we don't block the HTTP response
    background_tasks.add_task(service.process_job_in_background, job_id)
    
    return {"job_id": job_id}


@router.get(
    "/{job_id}",
    response_model=OcrJobResponse,
    summary="Get OCR job status",
)
async def get_ocr_job(
    job_id: str,
    project: Project = Depends(require_project),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = OcrService(db)
    return await service.get_job(job_id, project.project_id)


@router.post(
    "/{job_id}/corrections",
    status_code=204,
    summary="Submit user corrections for an OCR job",
)
async def submit_ocr_corrections(
    job_id: str,
    data: OcrFieldCorrectionCreate,
    project: Project = Depends(require_project),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = OcrService(db)
    await service.submit_corrections(job_id, project.project_id, user, data)
