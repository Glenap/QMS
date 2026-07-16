"""
schemas/transaction.py
----------------------
Pydantic v2 request/response models for live site operations — pours (Phase 2)
and RMC dispatch + gate scan / truck token flow (Phase 3).

Responses are scalar-only and carry a few denormalised display names (tower,
floor, component, grade, supplier) so the pour list/table renders without the
frontend issuing extra lookups.
"""

from datetime import date, datetime

from pydantic import BaseModel

from app.models.transaction import (
    ActionItemStatus,
    ActionReason,
    ActionResolution,
    InsituResult,
    PourStatus,
    TruckStatus,
)


class PourCreate(BaseModel):
    """The QE records a pour from an accepted delivery. Grade, supplier and
    volume are taken from the delivery; the QE supplies the placement location
    (tower → floor → component) and pour metadata."""

    dispatch_id: int
    tower_id: int
    floor_id: int
    component_id: int
    supplier_vertical_id: int | None = None
    mix_design_id: int | None = None
    pour_date: date
    pour_reference: str | None = None
    sub_contractor_name: str | None = None


class PourResponse(BaseModel):
    pour_id: int
    project_id: int
    dispatch_id: int | None = None
    tower_id: int
    tower_name: str | None = None
    floor_id: int
    floor_label: str | None = None
    component_id: int
    component_type: str | None = None
    grade_id: int
    grade_name: str | None = None
    supplier_horizontal_id: int
    supplier_name: str | None = None
    pour_date: date
    pour_reference: str | None
    volume_cum: float | None
    sub_contractor_name: str | None
    status: PourStatus
    volume_actual_cum: float | None
    completion_notes: str | None
    completed_at: datetime | None
    created_at: datetime


# ── Phase 3: RMC dispatch + gate scan (truck token flow) ────────────────────


class DispatchCreate(BaseModel):
    """QE orders a truckload of concrete of a grade from a project supplier. The
    pour that records the delivery is created later, from the accepted truck."""

    supplier_id: int
    grade_id: int
    volume_ordered_cum: float


class TruckInfo(BaseModel):
    """The single truck/token tied to a dispatch (1:1)."""

    dispatch_token_id: int
    token: str
    status: TruckStatus
    vehicle_number: str | None
    driver_name: str | None
    batch_number: str | None
    challan_number: str | None
    volume_cum: float | None
    wc_ratio_actual: float | None
    slump_at_plant_mm: float | None
    filled_at: datetime | None
    arrived_at: datetime | None
    accepted_at: datetime | None
    rejection_reason: str | None
    expires_at: datetime


class DispatchResponse(BaseModel):
    dispatch_id: int
    pour_id: int | None
    supplier_id: int
    supplier_name: str | None = None
    grade_id: int
    grade_name: str | None = None
    volume_ordered_cum: float | None
    volume_received_cum: float | None
    volume_remaining_cum: float | None
    slump_at_site_mm: float | None
    is_complete: bool
    truck: TruckInfo | None = None
    created_at: datetime


class TruckFillView(BaseModel):
    """What the supplier sees on the public truck-fill page (token only)."""

    project_name: str | None = None
    supplier_name: str | None = None
    grade_name: str | None = None
    volume_ordered_cum: float | None = None
    status: TruckStatus
    expires_at: datetime
    is_editable: bool


class TruckFillSubmit(BaseModel):
    """Truck details the supplier records at the plant before dispatch."""

    vehicle_number: str
    driver_name: str | None = None
    batch_number: str | None = None
    challan_number: str | None = None
    volume_cum: float | None = None
    wc_ratio_actual: float | None = None
    slump_at_plant_mm: float | None = None


class TruckActionResult(BaseModel):
    status: TruckStatus
    message: str


class GateTruckView(BaseModel):
    """What the site supervisor sees when scanning a truck token at the gate."""

    dispatch_id: int
    project_name: str | None = None
    supplier_name: str | None = None
    grade_name: str | None = None
    volume_ordered_cum: float | None = None
    slump_at_site_mm: float | None = None
    # Concrete placement window: how long the load has been in transit
    # (dispatch → now/arrival) against the IS-456 90-minute limit. A truck that
    # arrives past the window is auto-rejected at the gate scan.
    dispatch_time: datetime | None = None
    transit_minutes: int | None = None
    placement_window_minutes: int | None = None
    # QE in-situ slump check (Phase 4B): the latest test on this delivery, if any.
    target_slump_mm: str | None = None
    insitu: "InsituTestInfo | None" = None
    truck: TruckInfo


class TruckArrive(BaseModel):
    slump_at_site_mm: float | None = None


class TruckReject(BaseModel):
    rejection_reason: str


# ── Phase 4B: mismatch action items + QE in-situ slump gate ──────────────────


class ActionRequired(BaseModel):
    """Supervisor flags a mismatch on an admitted delivery for the QE."""

    reason: ActionReason
    message: str


class ActionItemResponse(BaseModel):
    action_item_id: int
    project_id: int
    dispatch_id: int
    reason: ActionReason
    message: str
    status: ActionItemStatus
    resolution: ActionResolution | None
    created_at: datetime
    resolved_at: datetime | None


class InsituSubmit(BaseModel):
    """The QE's in-situ slump-cone test + decision on a PENDING_QE delivery."""

    measured_slump_mm: float
    decision: ActionResolution  # APPROVED → accept the load, REJECTED → reject it
    rejection_reason: str | None = None
    notes: str | None = None


class InsituTestInfo(BaseModel):
    measured_slump_mm: float
    target_slump_mm: str | None
    result: InsituResult
    notes: str | None
    tested_at: datetime


class QEReviewItem(BaseModel):
    """One delivery awaiting the QE's in-situ sign-off (the QE inbox)."""

    dispatch_id: int
    token: str
    supplier_name: str | None = None
    grade_name: str | None = None
    target_slump_mm: str | None = None
    slump_at_site_mm: float | None = None
    volume_cum: float | None = None
    pour_reference: str | None = None
    action_item: ActionItemResponse | None = None
    created_at: datetime


class QEInboxCount(BaseModel):
    count: int


# GateTruckView forward-references InsituTestInfo (defined above) — resolve it.
GateTruckView.model_rebuild()
