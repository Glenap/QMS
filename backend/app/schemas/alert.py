"""schemas/alert.py — IS-456/10262 quality alerts + the RMC-issue notification."""

from datetime import datetime

from pydantic import BaseModel

from app.models.quality import AlertLevel, AlertStatus


class AlertResponse(BaseModel):
    alert_id: int
    level: AlertLevel
    category: str
    title: str
    message: str
    sample_id: int | None
    pour_id: int | None
    supplier_id: int | None
    supplier_name: str | None = None
    status: AlertStatus
    created_at: datetime
    acknowledged_at: datetime | None = None

    model_config = {"from_attributes": True}


class AlertCount(BaseModel):
    count: int


class RmcNotify(BaseModel):
    """A QE/PM composes an issue email to an RMC supplier about a quality problem."""

    subject: str
    message: str
