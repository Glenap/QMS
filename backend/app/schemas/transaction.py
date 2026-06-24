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

from app.models.transaction import PourStatus, TruckStatus


class PourCreate(BaseModel):
    tower_id: int
    floor_id: int
    component_id: int
    grade_id: int
    supplier_horizontal_id: int
    supplier_vertical_id: int | None = None
    mix_design_id: int | None = None
    pour_date: date
    pour_reference: str | None = None
    volume_cum: float | None = None
    sub_contractor_name: str | None = None


class PourComplete(BaseModel):
    volume_actual_cum: float | None = None
    completion_notes: str | None = None


class PourResponse(BaseModel):
    pour_id: int
    project_id: int
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
    """QE orders a truckload of concrete from a project supplier for a pour."""

    pour_id: int
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
    truck: TruckInfo


class TruckArrive(BaseModel):
    slump_at_site_mm: float | None = None


class TruckReject(BaseModel):
    rejection_reason: str
