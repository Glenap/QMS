"""documents.py — project document store DTOs."""

import enum
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentCategory(str, enum.Enum):
    """Optional tag for a project document. Mirrors ``audit.DocumentType`` plus a
    catch-all so any supporting file can still be filed."""

    MIX_DESIGN = "MIX_DESIGN"
    RMC_DETAIL = "RMC_DETAIL"
    POUR_RECORD = "POUR_RECORD"
    GRADE_DETAIL = "GRADE_DETAIL"
    CUBE_TEST_REGISTER = "CUBE_TEST_REGISTER"
    NCR_REPORT = "NCR_REPORT"  # PDF attached to a notify-RMC on an NCR
    # Conformance Analyser site photos, tagged by phase.
    CONFORMANCE_PRE = "CONFORMANCE_PRE"
    CONFORMANCE_POST = "CONFORMANCE_POST"
    CONFORMANCE_RCC = "CONFORMANCE_RCC"
    # Reference code-standard PDFs the analytics clause tags link to.
    CODE_IS456 = "CODE_IS456"
    CODE_IS10262 = "CODE_IS10262"
    CODE_ACI = "CODE_ACI"
    OTHER = "OTHER"


class DocumentApprovalStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    document_id: int
    project_id: int
    document_type: str | None
    title: str | None
    original_filename: str
    content_type: str | None
    size_bytes: int
    uploaded_by: int | None
    uploaded_by_name: str | None
    approval_status: str
    rejection_reason: str | None = None
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    uploaded_at: datetime


class DocumentReview(BaseModel):
    approval_status: DocumentApprovalStatus  # APPROVED | REJECTED | PENDING
    rejection_reason: str | None = None
