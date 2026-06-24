"""
schemas/master.py
-----------------
Pydantic v2 request/response models for master data: projects (+towers),
suppliers and testing labs.

Response models are scalar-only (no ORM relationships) so they never trigger
async lazy-loading. Where nested data is returned, the service builds it
explicitly from objects it already holds.
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr

from app.models.master import (
    CementType,
    ComponentType,
    GradeType,
    LabType,
    MixApprovalStatus,
    ProjectStatus,
    ProjectType,
)

# ---------------------------------------------------------------------------
# Towers
# ---------------------------------------------------------------------------

class TowerCreate(BaseModel):
    tower_name: str
    tower_code: str | None = None
    tower_description: str | None = None
    tower_type: str | None = None
    floors_total: int | None = None
    no_of_flats: int | None = None
    flats_per_floor: int | None = None
    no_of_basements: int | None = None
    floor_height_m: float | None = None
    start_label: str | None = None
    construction_start_date: date | None = None


class TowerResponse(BaseModel):
    tower_id: int
    project_id: int
    tower_name: str
    tower_code: str | None
    tower_type: str | None
    floors_total: int | None
    no_of_flats: int | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

class ProjectCreate(BaseModel):
    project_name: str
    project_type: ProjectType | None = None
    project_code: str | None = None
    status: ProjectStatus = ProjectStatus.ACTIVE
    gst_number: str | None = None
    # Location
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    pin_code: str | None = None
    geo_coordinates: str | None = None
    project_location: str | None = None
    site_area_sqm: float | None = None
    # Timeline & scope
    start_date: date | None = None
    end_date: date | None = None
    builtup_area_sqft: float | None = None
    no_of_towers: int | None = None
    no_of_basements: int | None = None
    max_floors: int | None = None
    no_of_flats: int | None = None
    # Quality parameters
    acceptance_criteria: str | None = None
    min_cube_samples: str | None = None
    early_test_age_days: int | None = None
    mid_test_age_days: int | None = None
    final_test_age_days: int | None = None
    characteristic_strength_pct: float | None = None
    ncr_trigger: str | None = None
    # Nested towers (optional)
    towers: list[TowerCreate] = []


class ProjectResponse(BaseModel):
    project_id: int
    org_id: int
    project_name: str
    project_type: ProjectType | None
    project_code: str | None
    project_location: str | None
    status: ProjectStatus
    city: str | None
    state: str | None
    start_date: date | None
    end_date: date | None
    no_of_towers: int | None
    # For a contractor viewer: the towers their org is allotted on this project
    # (their ProjectContractor scope label). None for client-side viewers.
    assigned_scope: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Suppliers
# ---------------------------------------------------------------------------

class SupplierCreate(BaseModel):
    supplier_name: str
    plant_name: str | None = None
    plant_location: str | None = None
    gst_number: str | None = None
    pan_number: str | None = None
    plant_distance_km: float | None = None
    transit_time_mins: int | None = None
    contact_email: EmailStr | None = None
    contact_phone: str | None = None
    primary_contact_name: str | None = None
    primary_contact_designation: str | None = None
    dispatch_manager_name: str | None = None
    dispatch_mobile: str | None = None
    plant_capacity_cum_hr: float | None = None
    no_transit_mixers: int | None = None
    no_concrete_pumps: int | None = None
    qms_certification: str | None = None


class SupplierResponse(BaseModel):
    supplier_id: int
    contractor_org_id: int
    contractor_org_name: str | None = None
    project_id: int | None
    supplier_name: str
    plant_name: str | None
    plant_location: str | None
    gst_number: str | None
    plant_distance_km: float | None
    contact_email: str | None
    contact_phone: str | None
    is_active: bool
    status: str
    confirmed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Testing labs
# ---------------------------------------------------------------------------

class LabCreate(BaseModel):
    lab_name: str
    lab_type: LabType = LabType.THIRD_PARTY
    registration_number: str | None = None
    gst_number: str | None = None
    accreditation_no: str | None = None
    address_line1: str | None = None
    city: str | None = None
    state: str | None = None
    contact_email: EmailStr | None = None
    contact_phone: str | None = None
    lab_manager_name: str | None = None
    alternate_phone: str | None = None
    nabl_accredited: str | None = None
    nabl_certificate_no: str | None = None
    nabl_expiry_date: date | None = None
    ctm_calibration_status: str | None = None
    ctm_calibration_expiry: date | None = None
    ctm_capacity_kn: float | None = None


class LabResponse(BaseModel):
    lab_id: int
    contractor_org_id: int
    contractor_org_name: str | None = None
    project_id: int | None
    lab_name: str
    lab_type: LabType
    registration_number: str | None
    accreditation_no: str | None
    city: str | None
    state: str | None
    contact_email: str | None
    contact_phone: str | None
    is_active: bool
    status: str
    confirmed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Project membership, contractors, and access (project-scoped model)
# ---------------------------------------------------------------------------

class ProjectMemberCreate(BaseModel):
    """Assign someone to a project. If a user with this email already exists in
    the caller's org they're assigned directly; otherwise they're invited."""
    email: EmailStr
    project_role: str  # app.models.auth.ProjectRole value


class ProjectMemberResponse(BaseModel):
    email: str
    full_name: str | None
    project_role: str
    status: str  # ACTIVE | UNVERIFIED | INVITED
    user_id: int | None
    assigned_at: datetime | None


class ProjectContractorCreate(BaseModel):
    """Bring a contractor onto a project — either an existing contractor org
    (contractor_org_id) or a brand-new one (org_name + contact_email).

    ``tower_ids`` is the set of towers this contractor works on. An empty list
    means the whole project. The service turns the selected towers into a
    human-readable ``scope`` string (e.g. "Tower 1, Tower 3")."""
    contractor_org_id: int | None = None
    org_name: str | None = None
    contact_email: EmailStr | None = None
    contact_phone: str | None = None
    tower_ids: list[int] = []
    scope: str | None = None


class ProjectContractorResponse(BaseModel):
    pc_id: int
    project_id: int
    contractor_org_id: int
    contractor_org_name: str
    status: str  # PENDING | ACCEPTED | DECLINED
    scope: str | None
    assigned_at: datetime
    responded_at: datetime | None


class AssignedProjectResponse(BaseModel):
    """A contractor org's view of a project it's been assigned to (accept screen)."""
    pc_id: int
    project_id: int
    project_name: str
    project_code: str | None
    city: str | None
    state: str | None
    status: str
    scope: str | None
    assigned_at: datetime


class ContractorEngagement(BaseModel):
    """One project a contractor org is already engaged on (for the busy warning)."""
    project_id: int
    project_name: str
    start_date: date | None
    end_date: date | None
    status: str  # PENDING | ACCEPTED


class AvailableContractorResponse(BaseModel):
    """A contractor org the client may re-use on another project, plus the
    projects it's currently engaged on so the UI can warn before assigning."""
    contractor_org_id: int
    org_name: str
    contact_email: str | None
    engagements: list[ContractorEngagement]


class ProjectAccess(BaseModel):
    """The viewer's capabilities on a project — drives role-aware UI."""
    side: str  # CLIENT | CONTRACTOR
    can_manage_client_side: bool
    can_manage_contractor_side: bool
    is_contractor_admin: bool


class ProjectDetailResponse(ProjectResponse):
    access: ProjectAccess


# ---------------------------------------------------------------------------
# Reference catalogs (grades, components) — global, read-only
# ---------------------------------------------------------------------------

class GradeResponse(BaseModel):
    grade_id: int
    grade_name: str
    grade_type: GradeType
    min_strength_mpa: float
    grade_variant: str | None

    model_config = {"from_attributes": True}


class ComponentResponse(BaseModel):
    component_id: int
    component_type: ComponentType
    description: str | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Floors (per tower)
# ---------------------------------------------------------------------------

class FloorCreate(BaseModel):
    floor_label: str
    floor_number: int | None = None


class FloorGenerate(BaseModel):
    """Bulk-create floors numbered start_number..start_number+count-1."""
    count: int
    start_number: int = 1
    label_prefix: str = "L"


class FloorResponse(BaseModel):
    floor_id: int
    tower_id: int
    floor_label: str
    floor_number: int | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Mix designs (per project, per supplier+grade)
# ---------------------------------------------------------------------------

class MixDesignCreate(BaseModel):
    supplier_id: int
    grade_id: int
    contractor_name: str | None = None
    cement_kg: float | None = None
    flyash_kg: float | None = None
    water_kg: float | None = None
    fine_agg_kg: float | None = None
    coarse_20mm_kg: float | None = None
    coarse_10mm_kg: float | None = None
    admixture_kg: float | None = None
    admixture_brand: str | None = None
    wc_ratio: float | None = None
    cement_type: CementType | None = None
    trial_mix_date: date | None = None
    strength_7day_mpa: float | None = None
    strength_28day_mpa: float | None = None
    approval_status: MixApprovalStatus | None = None


class MixDesignResponse(BaseModel):
    mix_design_id: int
    project_id: int | None
    supplier_id: int
    supplier_name: str | None = None
    grade_id: int
    grade_name: str | None = None
    contractor_name: str | None
    wc_ratio: float | None
    cement_type: CementType | None
    approval_status: MixApprovalStatus | None
    strength_28day_mpa: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Supplier / lab confirmation handshake (passwordless, token-based)
# ---------------------------------------------------------------------------

class SupplierConfirmationView(BaseModel):
    """What the supplier sees when they open the confirmation link."""
    supplier_name: str
    plant_name: str | None
    plant_location: str | None
    contact_email: str | None
    contact_phone: str | None
    primary_contact_name: str | None
    status: str
    project_name: str | None
    registered_by: str | None  # contractor org that registered them


class SupplierConfirmSubmit(BaseModel):
    action: Literal["CONFIRM", "DECLINE"]
    # Optional corrections the supplier may apply while confirming.
    contact_email: EmailStr | None = None
    contact_phone: str | None = None
    primary_contact_name: str | None = None
    plant_location: str | None = None


class LabConfirmationView(BaseModel):
    """What the lab sees when they open the confirmation link."""
    lab_name: str
    lab_type: LabType
    contact_email: str | None
    contact_phone: str | None
    lab_manager_name: str | None
    city: str | None
    state: str | None
    status: str
    project_name: str | None
    registered_by: str | None


class LabConfirmSubmit(BaseModel):
    action: Literal["CONFIRM", "DECLINE"]
    contact_email: EmailStr | None = None
    contact_phone: str | None = None
    lab_manager_name: str | None = None
    nabl_certificate_no: str | None = None


class ConfirmationResult(BaseModel):
    status: str
    message: str
