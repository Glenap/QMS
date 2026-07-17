"""ocr_service.py — Service layer for OCR background jobs.

Handles queuing, background execution, and fetching job status.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.storage import storage
from app.models.auth import User
from app.models.master import Document, Project
from app.models.quality import OcrJob, OcrJobStatus
from app.ocr.correction_learner import record_corrections
from app.ocr.pipeline import run_ocr_pipeline
from app.schemas.ocr import OcrFieldCorrectionCreate, OcrJobResponse

logger = logging.getLogger(__name__)


class OcrService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_job(self, job_id: str, project_id: int) -> OcrJobResponse:
        """Fetch status and results of an OCR job."""
        stmt = select(OcrJob).where(
            OcrJob.job_id == job_id, OcrJob.project_id == project_id
        )
        res = await self.session.execute(stmt)
        job = res.scalar_one_or_none()
        if not job:
            raise NotFoundError("OCR Job")
        return OcrJobResponse.model_validate(job)

    async def create_job(
        self, project: Project, document: Document, user: User
    ) -> str:
        """Create a QUEUED job and return the job ID."""
        job_id = str(uuid.uuid4())
        job = OcrJob(
            job_id=job_id,
            project_id=project.project_id,
            document_id=document.document_id,
            uploaded_by=user.user_id,
            status=OcrJobStatus.QUEUED,
        )
        self.session.add(job)
        await self.session.commit()
        return job_id

    async def create_anonymous_job(self, project_id: int) -> str:
        """Create a QUEUED job for external/token uploads (no User or Document)."""
        job_id = str(uuid.uuid4())
        job = OcrJob(
            job_id=job_id,
            project_id=project_id,
            document_id=None,
            uploaded_by=None,
            status=OcrJobStatus.QUEUED,
        )
        self.session.add(job)
        await self.session.commit()
        return job_id

    async def process_job_in_background(self, job_id: str, pdf_bytes: bytes | None = None) -> None:
        """Run the heavy extraction pipeline in the background."""
        # Note: In a real distributed system this would run in a Celery/Redis worker.
        # Here we run it in FastAPI BackgroundTasks, but we need a fresh DB session.
        from app.database.session import AsyncSessionLocal
        from app.ai.llm import get_llm

        async with AsyncSessionLocal() as db:
            stmt = select(OcrJob).where(OcrJob.job_id == job_id)
            job = (await db.execute(stmt)).scalar_one_or_none()
            if not job or job.status != OcrJobStatus.QUEUED:
                return

            job.status = OcrJobStatus.PROCESSING
            await db.commit()

            try:
                # Load the PDF document
                if not pdf_bytes:
                    if not job.document_id:
                        raise ValueError("No pdf_bytes provided and job has no document_id")
                        
                    doc_stmt = select(Document).where(Document.document_id == job.document_id)
                    doc = (await db.execute(doc_stmt)).scalar_one_or_none()
                    if not doc:
                        raise ValueError("Document not found in database")
                    pdf_bytes = storage.path_for(doc.stored_key).read_bytes()

                llm = get_llm()
                
                # Execute Pipeline
                result = await run_ocr_pipeline(pdf_bytes, llm)
                
                if result.error:
                    job.status = OcrJobStatus.FAILED
                    job.error_message = result.error
                else:
                    job.status = OcrJobStatus.COMPLETED
                    job.doc_type = result.doc_type
                    job.page_count = result.page_count
                    job.is_digital = result.is_mostly_digital
                    job.overall_confidence = result.overall_confidence
                    job.processing_ms = result.processing_ms
                    job.result_json = {
                        "fields": result.fields,
                        "domain_data": result.domain_data,
                        "tables": result.tables,
                        "raw_text": result.raw_text,
                    }

            except Exception as e:
                logger.exception(f"OCR Pipeline failed for job {job_id}")
                job.status = OcrJobStatus.FAILED
                job.error_message = str(e)
            finally:
                job.completed_at = datetime.now(UTC)
                await db.commit()

    async def submit_corrections(
        self, job_id: str, project_id: int, user: User, data: OcrFieldCorrectionCreate
    ) -> None:
        """Save user corrections to improve future extraction."""
        # Validate job belongs to this project
        await self.get_job(job_id, project_id)
        await record_corrections(
            self.session,
            job_id=job_id,
            doc_type=data.doc_type,
            user_id=user.user_id,
            original_fields=data.original_fields,
            final_fields=data.final_fields,
        )
        await self.session.commit()
