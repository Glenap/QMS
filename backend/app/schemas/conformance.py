"""schemas/conformance.py — DTOs for the Conformance Analyser defect findings.

An inspector classifies each conformance photo against the curated defect
taxonomy (carried on the frontend); the backend persists the assignment.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class ConformanceFindingUpsert(BaseModel):
    document_id: int  # the conformance photo (a master.documents row)
    phase: Literal["PRE", "POST", "RCC"]
    defect_code: str
    defect_label: str
    severity: Literal["LOW", "MED", "HIGH"]
    remediation_choice: Literal["A", "B"] | None = None
    notes: str | None = None


class ConformanceFindingResponse(BaseModel):
    finding_id: int
    project_id: int
    document_id: int
    phase: str
    defect_code: str
    defect_label: str
    severity: str
    remediation_choice: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
