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
    # Who registers RMC suppliers + labs: CONTRACTOR (default) or CLIENT (the
    # client registers them and the contractor accepts/rejects each).
    registration_by: Literal["CONTRACTOR", "CLIENT"] = "CONTRACTOR"
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
    registration_by: str = "CONTRACTOR"
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


class ProjectStatusUpdate(BaseModel):
    """The owning client admin sets a project's lifecycle status. Completing a
    project frees its assigned team members for reassignment."""
    status: ProjectStatus


# ---------------------------------------------------------------------------
# Suppliers
# ---------------------------------------------------------------------------

class SupplierCreate(BaseModel):
    supplier_name: str
    # Client-registration mode only: which accepted contractor holds this
    # registration. Required when the project has more than one — picking for
    # the caller attached it to whichever org sorted first.
    contractor_org_id: int | None = None
    plant_name: str | None = None
    plant_location: str | None = None
    gst_number: str | None = None
    pan_number: str | None = None
    plant_distance_km: float | None = None
    transit_time_mins: int | None = None
    # Required: the RMC interacts only via tokenised email links (mix-design
    # request, truck dispatch, result), so a contact email is mandatory.
    contact_email: EmailStr
    contact_phone: str | None = None
    primary_contact_name: str | None = None
    primary_contact_designation: str | None = None
    dispatch_manager_name: str | None = None
    dispatch_mobile: str | None = None
    plant_capacity_cum_hr: float | None = None
    no_transit_mixers: int | None = None
    no_concrete_pumps: int | None = None
    qms_certification: str | None = None
    mix_design_document_id: int | None = None


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
    is_blocked: bool = False
    block_reason: str | None = None
    # Client-registered RMC approval (see Project.registration_by).
    registered_by: str = "CONTRACTOR"
    approval_status: str = "NOT_REQUIRED"
    approval_reason: str | None = None
    mix_design_document_id: int | None = None
    mix_design_document_name: str | None = None
    mix_submission_token: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BlockRequest(BaseModel):
    """Reason a QE/PM/contractor gives when blocking an RMC supplier or lab."""

    reason: str


class ApprovalReject(BaseModel):
    """Reason the contractor gives when rejecting a client-registered RMC/lab."""

    reason: str | None = None


# ---------------------------------------------------------------------------
# Testing labs
# ---------------------------------------------------------------------------

class LabCreate(BaseModel):
    lab_name: str
    # Client-registration mode only: which accepted contractor holds this
    # registration. Required when the project has more than one — picking for
    # the caller attached it to whichever org sorted first.
    contractor_org_id: int | None = None
    lab_type: LabType = LabType.THIRD_PARTY
    registration_number: str | None = None
    gst_number: str | None = None
    accreditation_no: str | None = None
    address_line1: str | None = None
    city: str | None = None
    state: str | None = None
    # Required: the lab interacts only via tokenised email links, so we must be
    # able to reach it.
    contact_email: EmailStr
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
    is_blocked: bool = False
    block_reason: str | None = None
    # Client-registered lab approval (see Project.registration_by).
    registered_by: str = "CONTRACTOR"
    approval_status: str = "NOT_REQUIRED"
    approval_reason: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Org-wide directories (all RMCs / labs across the caller's projects)
# ---------------------------------------------------------------------------

class SupplierDirectoryItem(BaseModel):
    """One RMC in the organisation-wide directory: which project it's registered
    for and which contractor holds it. Read-only cross-project roll-up."""

    supplier_id: int
    supplier_name: str
    project_id: int | None
    project_name: str | None
    contractor_org_id: int
    contractor_org_name: str | None
    contact_email: str | None
    plant_location: str | None
    status: str
    approval_status: str
    registered_by: str
    is_blocked: bool


class LabDirectoryItem(BaseModel):
    """One testing lab in the organisation-wide directory (project + contractor)."""

    lab_id: int
    lab_name: str
    lab_type: LabType
    project_id: int | None
    project_name: str | None
    contractor_org_id: int
    contractor_org_name: str | None
    contact_email: str | None
    city: str | None
    status: str
    approval_status: str
    registered_by: str
    is_blocked: bool


# ---------------------------------------------------------------------------
# Project membership, contractors, and access (project-scoped model)
# ---------------------------------------------------------------------------

class ProjectMemberCreate(BaseModel):
    """Assign an existing team member to a project with a per-project designation.
    The email must belong to an accepted member of the caller's org — team
    onboarding happens up front via /auth/invite, not here."""
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
    # The viewer's per-project designation (ProjectRole value) or None. Field
    # capabilities (cast pours, work the gate…) come from this, not the org role.
    project_role: str | None = None


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
    contractor_name: str | None = None
    # RMC submission detail (the screenshot form) — surfaced so the QE can review.
    mix_design_ref: str | None = None
    mix_type: str | None = None
    exposure_condition: str | None = None
    cement_type: CementType | None = None
    cement_kg: float | None = None
    flyash_kg: float | None = None
    ggbs_kg: float | None = None
    total_binder_kg: float | None = None
    wc_ratio: float | None = None
    free_water_l: float | None = None
    water_kg: float | None = None
    coarse_20mm_kg: float | None = None
    coarse_10mm_kg: float | None = None
    fine_agg_kg: float | None = None
    admixture_brand: str | None = None
    admixture_pct: float | None = None
    target_mean_strength_mpa: float | None = None
    max_aggregate_size_mm: int | None = None
    slump_range_mm: str | None = None
    trial_mix_date: date | None = None
    strength_28day_mpa: float | None = None
    document_id: int | None = None
    # QE review outcome.
    approval_status: MixApprovalStatus | None = None
    rejection_reason: str | None = None
    observed_28day_strength_mpa: float | None = None
    approval_date: date | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MixDesignSubmit(BaseModel):
    """One mix design the RMC submits for a requested grade (public token page)."""

    grade_id: int
    mix_design_ref: str | None = None
    mix_type: str | None = None
    exposure_condition: str | None = None
    cement_type: CementType | None = None
    cement_kg: float | None = None
    flyash_kg: float | None = None
    ggbs_kg: float | None = None
    total_binder_kg: float | None = None
    wc_ratio: float | None = None
    free_water_l: float | None = None
    water_kg: float | None = None
    coarse_20mm_kg: float | None = None
    coarse_10mm_kg: float | None = None
    fine_agg_kg: float | None = None
    admixture_brand: str | None = None
    admixture_pct: float | None = None
    target_mean_strength_mpa: float | None = None
    max_aggregate_size_mm: int | None = None
    slump_range_mm: str | None = None
    trial_mix_date: date | None = None


class MixDesignReview(BaseModel):
    """The QE's decision on a submitted mix design."""

    approval_status: MixApprovalStatus  # APPROVED | IN_PROGRESS | REJECTED
    rejection_reason: str | None = None
    observed_28day_strength_mpa: float | None = None


class RequiredGradesUpdate(BaseModel):
    """The grades a contractor wants this RMC supplier to submit mix designs for."""

    grade_ids: list[int]


class RequiredGradeInfo(BaseModel):
    grade_id: int
    grade_name: str | None = None
    mix_design_id: int | None = None
    approval_status: MixApprovalStatus | None = None


class MixSubmissionView(BaseModel):
    """Public token view for the RMC mix-design submission page."""

    supplier_name: str
    project_name: str | None = None
    registered_by: str | None = None
    required_grades: list[RequiredGradeInfo] = []


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
