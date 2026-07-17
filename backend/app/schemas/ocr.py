"""ocr.py — OCR Pipeline Schemas."""

from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field

from app.models.quality import OcrJobStatus


class OcrJobCreate(BaseModel):
    document_id: int
    project_id: int


class OcrJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    job_id: str
    project_id: int
    document_id: int | None
    uploaded_by: int | None
    status: OcrJobStatus
    doc_type: str | None
    page_count: int | None
    is_digital: bool | None
    result_json: dict[str, Any] | None
    overall_confidence: float | None
    error_message: str | None
    processing_ms: int | None
    created_at: datetime
    completed_at: datetime | None


class OcrFieldCorrectionCreate(BaseModel):
    doc_type: str
    original_fields: dict[str, Any]
    final_fields: dict[str, Any]
