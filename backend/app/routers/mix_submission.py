"""mix_submission.py router — PUBLIC tokenised mix-design submission for RMCs.

No authentication: access is gated by the per-supplier ``mix_submission_token``
minted when the contractor names the grades it wants. The RMC submits one mix
design per requested grade; each lands as PENDING for the QE to review.
"""

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.schemas.master import (
    MixDesignResponse,
    MixDesignSubmit,
    MixSubmissionView,
)
from app.services.mixdesign_service import MixDesignService

router = APIRouter(prefix="/external/mix-design", tags=["mix-submission"])


@router.get("", response_model=MixSubmissionView)
async def view_mix_submission(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    return await MixDesignService(db).submission_view(token)


@router.post("", response_model=MixDesignResponse)
async def submit_mix_design(
    token: str,
    payload: str = Form(...),  # MixDesignSubmit as JSON (multipart rides the PDF)
    file: UploadFile = File(...),  # the mix-design PDF is mandatory
    db: AsyncSession = Depends(get_db),
):
    data = MixDesignSubmit.model_validate_json(payload)
    content = await file.read()
    return await MixDesignService(db).submit(
        token,
        data,
        pdf_filename=file.filename or "mix-design.pdf",
        pdf_content=content,
        pdf_content_type=file.content_type,
    )


from fastapi import BackgroundTasks
from app.services.ocr_service import OcrService
from app.schemas.ocr import OcrJobResponse

@router.post("/ocr", response_model=dict, status_code=202)
async def create_mix_ocr_job(
    token: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    view = await MixDesignService(db).submission_view(token)
    
    pdf_bytes = await file.read()
    service = OcrService(db)
    job_id = await service.create_anonymous_job(view.project_id)
    
    background_tasks.add_task(service.process_job_in_background, job_id, pdf_bytes)
    
    return {"job_id": job_id}


@router.get("/ocr/{job_id}", response_model=OcrJobResponse)
async def get_mix_ocr_job(
    token: str,
    job_id: str,
    db: AsyncSession = Depends(get_db),
):
    view = await MixDesignService(db).submission_view(token)
    service = OcrService(db)
    return await service.get_job(job_id, view.project_id)
