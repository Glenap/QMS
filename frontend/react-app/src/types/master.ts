// TypeScript mirrors of the backend master-data Pydantic schemas
// (backend/app/schemas/master.py). Keep these in sync with the API.

// ── Enums (mirror app.models.master) ───────────────────────────────────────

// app.models.master.ProjectStatus
export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';

// app.models.master.ProjectType
export type ProjectType =
  | 'RESIDENTIAL'
  | 'COMMERCIAL'
  | 'MIXED_USE'
  | 'INFRASTRUCTURE';

// app.models.master.LabType
export type LabType = 'IN_HOUSE' | 'THIRD_PARTY';

// ── Towers ──────────────────────────────────────────────────────────────────

export interface TowerCreate {
  tower_name: string;
  tower_code?: string | null;
  tower_description?: string | null;
  tower_type?: string | null;
  floors_total?: number | null;
  no_of_flats?: number | null;
  flats_per_floor?: number | null;
  no_of_basements?: number | null;
  floor_height_m?: number | null;
  start_label?: string | null;
  construction_start_date?: string | null; // ISO date (YYYY-MM-DD)
}

export interface TowerResponse {
  tower_id: number;
  project_id: number;
  tower_name: string;
  tower_code: string | null;
  tower_type: string | null;
  floors_total: number | null;
  no_of_flats: number | null;
}

// ── Projects ──────────────────────────────────────────────────────────────

export interface ProjectCreate {
  project_name: string;
  project_type?: ProjectType | null;
  project_code?: string | null;
  status?: ProjectStatus;
  gst_number?: string | null;
  // Location
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  pin_code?: string | null;
  geo_coordinates?: string | null;
  project_location?: string | null;
  site_area_sqm?: number | null;
  // Timeline & scope
  start_date?: string | null; // ISO date
  end_date?: string | null; // ISO date
  builtup_area_sqft?: number | null;
  no_of_towers?: number | null;
  no_of_basements?: number | null;
  max_floors?: number | null;
  no_of_flats?: number | null;
  // Quality parameters
  acceptance_criteria?: string | null;
  min_cube_samples?: string | null;
  early_test_age_days?: number | null;
  mid_test_age_days?: number | null;
  final_test_age_days?: number | null;
  characteristic_strength_pct?: number | null;
  ncr_trigger?: string | null;
  // Nested towers (optional)
  towers?: TowerCreate[];
}

export interface ProjectResponse {
  project_id: number;
  org_id: number;
  project_name: string;
  project_type: ProjectType | null;
  project_code: string | null;
  project_location: string | null;
  status: ProjectStatus;
  city: string | null;
  state: string | null;
  start_date: string | null;
  end_date: string | null;
  no_of_towers: number | null;
  // Contractor viewer only: their allotted-tower scope label (else null).
  assigned_scope?: string | null;
  created_at: string;
}

// ── Project-scoped: membership, contractors, access ─────────────────────────

export type ProjectRoleValue =
  | 'CLIENT_LEAD'
  | 'CONTRACTOR_LEAD'
  | 'PROJECT_MANAGER'
  | 'QUALITY_ENGINEER'
  | 'SUPERVISOR';

export type ProjectMemberStatus = 'ACTIVE' | 'UNVERIFIED' | 'INVITED' | 'DEACTIVATED';
export type ContractorLinkStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface ProjectAccess {
  side: 'CLIENT' | 'CONTRACTOR';
  can_manage_client_side: boolean;
  can_manage_contractor_side: boolean;
  is_contractor_admin: boolean;
}

export interface ProjectDetail extends ProjectResponse {
  access: ProjectAccess;
}

export interface ProjectMember {
  email: string;
  full_name: string | null;
  project_role: ProjectRoleValue | string;
  status: ProjectMemberStatus;
  user_id: number | null;
  assigned_at: string | null;
}

export interface ProjectMemberCreate {
  email: string;
  project_role: ProjectRoleValue;
}

export interface ProjectContractor {
  pc_id: number;
  project_id: number;
  contractor_org_id: number;
  contractor_org_name: string;
  status: ContractorLinkStatus;
  scope: string | null;
  assigned_at: string;
  responded_at: string | null;
}

export interface ProjectContractorCreate {
  contractor_org_id?: number | null;
  org_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  // Towers this contractor works on. Empty = entire project. The backend turns
  // these into the readable `scope` label.
  tower_ids?: number[];
  scope?: string | null;
}

export interface AssignedProject {
  pc_id: number;
  project_id: number;
  project_name: string;
  project_code: string | null;
  city: string | null;
  state: string | null;
  status: ContractorLinkStatus;
  scope: string | null;
  assigned_at: string;
}

// A project an existing contractor is already engaged on (busy-warning popup).
export interface ContractorEngagement {
  project_id: number;
  project_name: string;
  start_date: string | null; // ISO date
  end_date: string | null;   // ISO date
  status: ContractorLinkStatus; // PENDING | ACCEPTED
}

// A contractor org the client may re-use on another project.
export interface AvailableContractor {
  contractor_org_id: number;
  org_name: string;
  contact_email: string | null;
  engagements: ContractorEngagement[];
}

// ── Suppliers ─────────────────────────────────────────────────────────────

export interface SupplierCreate {
  supplier_name: string;
  plant_name?: string | null;
  plant_location?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  plant_distance_km?: number | null;
  transit_time_mins?: number | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  primary_contact_name?: string | null;
  primary_contact_designation?: string | null;
  dispatch_manager_name?: string | null;
  dispatch_mobile?: string | null;
  plant_capacity_cum_hr?: number | null;
  no_transit_mixers?: number | null;
  no_concrete_pumps?: number | null;
  qms_certification?: string | null;
}

// PENDING until the supplier/lab confirms (or declines) via the email link.
export type ConfirmationStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED';

export interface SupplierResponse {
  supplier_id: number;
  contractor_org_id: number;
  contractor_org_name: string | null;
  supplier_name: string;
  plant_name: string | null;
  plant_location: string | null;
  gst_number: string | null;
  plant_distance_km: number | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  status: ConfirmationStatus;
  confirmed_at: string | null;
  created_at: string;
}

// ── Testing labs ────────────────────────────────────────────────────────────

export interface LabCreate {
  lab_name: string;
  lab_type?: LabType;
  registration_number?: string | null;
  gst_number?: string | null;
  accreditation_no?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  lab_manager_name?: string | null;
  alternate_phone?: string | null;
  nabl_accredited?: string | null;
  nabl_certificate_no?: string | null;
  nabl_expiry_date?: string | null; // ISO date
  ctm_calibration_status?: string | null;
  ctm_calibration_expiry?: string | null; // ISO date
  ctm_capacity_kn?: number | null;
}

export interface LabResponse {
  lab_id: number;
  contractor_org_id: number;
  contractor_org_name: string | null;
  lab_name: string;
  lab_type: LabType;
  registration_number: string | null;
  accreditation_no: string | null;
  city: string | null;
  state: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  status: ConfirmationStatus;
  confirmed_at: string | null;
  created_at: string;
}

// ── Reference catalogs (grades, components) ─────────────────────────────────

export type GradeType = 'NORMAL' | 'FREE_FLOW';

export interface GradeResponse {
  grade_id: number;
  grade_name: string;
  grade_type: GradeType;
  min_strength_mpa: number;
  grade_variant: string | null;
}

export type ComponentTypeValue =
  | 'COLUMN' | 'SLAB' | 'BEAM' | 'RAFT'
  | 'SHEAR_WALL' | 'STAIRCASE' | 'LIFT_CORE' | 'FOUNDATION';

export interface ComponentResponse {
  component_id: number;
  component_type: ComponentTypeValue;
  description: string | null;
}

// ── Floors (per tower) ──────────────────────────────────────────────────────

export interface FloorCreate {
  floor_label: string;
  floor_number?: number | null;
}

export interface FloorGenerate {
  count: number;
  start_number?: number;
  label_prefix?: string;
}

export interface FloorResponse {
  floor_id: number;
  tower_id: number;
  floor_label: string;
  floor_number: number | null;
}

// ── Mix designs ─────────────────────────────────────────────────────────────

export type MixApprovalStatus = 'APPROVED' | 'REJECTED' | 'IN_PROGRESS';
export type CementType = 'OPC_43' | 'OPC_53';

export interface MixDesignCreate {
  supplier_id: number;
  grade_id: number;
  contractor_name?: string | null;
  cement_kg?: number | null;
  flyash_kg?: number | null;
  water_kg?: number | null;
  fine_agg_kg?: number | null;
  coarse_20mm_kg?: number | null;
  coarse_10mm_kg?: number | null;
  admixture_kg?: number | null;
  admixture_brand?: string | null;
  wc_ratio?: number | null;
  cement_type?: CementType | null;
  trial_mix_date?: string | null;
  strength_7day_mpa?: number | null;
  strength_28day_mpa?: number | null;
  approval_status?: MixApprovalStatus | null;
}

export interface MixDesignResponse {
  mix_design_id: number;
  project_id: number | null;
  supplier_id: number;
  supplier_name: string | null;
  grade_id: number;
  grade_name: string | null;
  contractor_name: string | null;
  wc_ratio: number | null;
  cement_type: CementType | null;
  approval_status: MixApprovalStatus | null;
  strength_28day_mpa: number | null;
  created_at: string;
}

// ── Supplier / lab confirmation handshake (public, token-based) ──────────────

export interface SupplierConfirmationView {
  supplier_name: string;
  plant_name: string | null;
  plant_location: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  primary_contact_name: string | null;
  status: ConfirmationStatus;
  project_name: string | null;
  registered_by: string | null;
}

export interface SupplierConfirmSubmit {
  action: 'CONFIRM' | 'DECLINE';
  contact_email?: string | null;
  contact_phone?: string | null;
  primary_contact_name?: string | null;
  plant_location?: string | null;
}

export interface LabConfirmationView {
  lab_name: string;
  lab_type: LabType;
  contact_email: string | null;
  contact_phone: string | null;
  lab_manager_name: string | null;
  city: string | null;
  state: string | null;
  status: ConfirmationStatus;
  project_name: string | null;
  registered_by: string | null;
}

export interface LabConfirmSubmit {
  action: 'CONFIRM' | 'DECLINE';
  contact_email?: string | null;
  contact_phone?: string | null;
  lab_manager_name?: string | null;
  nabl_certificate_no?: string | null;
}

export interface ConfirmationResult {
  status: ConfirmationStatus;
  message: string;
}

// ── Pours (transaction) ─────────────────────────────────────────────────────

export type PourStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface PourCreate {
  tower_id: number;
  floor_id: number;
  component_id: number;
  grade_id: number;
  supplier_horizontal_id: number;
  supplier_vertical_id?: number | null;
  mix_design_id?: number | null;
  pour_date: string; // ISO date
  pour_reference?: string | null;
  volume_cum?: number | null;
  sub_contractor_name?: string | null;
}

export interface PourComplete {
  volume_actual_cum?: number | null;
  completion_notes?: string | null;
}

export interface PourResponse {
  pour_id: number;
  project_id: number;
  tower_id: number;
  tower_name: string | null;
  floor_id: number;
  floor_label: string | null;
  component_id: number;
  component_type: string | null;
  grade_id: number;
  grade_name: string | null;
  supplier_horizontal_id: number;
  supplier_name: string | null;
  pour_date: string;
  pour_reference: string | null;
  volume_cum: number | null;
  sub_contractor_name: string | null;
  status: PourStatus;
  volume_actual_cum: number | null;
  completion_notes: string | null;
  completed_at: string | null;
  created_at: string;
}

// ── RMC dispatch + gate scan (truck token flow) ─────────────────────────────

// app.models.transaction.TruckStatus
export type TruckStatus = 'PENDING' | 'FILLED' | 'ARRIVED' | 'ACCEPTED' | 'REJECTED';

export interface DispatchCreate {
  pour_id: number;
  supplier_id: number;
  grade_id: number;
  volume_ordered_cum: number;
}

export interface TruckInfo {
  dispatch_token_id: number;
  token: string;
  status: TruckStatus;
  vehicle_number: string | null;
  driver_name: string | null;
  batch_number: string | null;
  challan_number: string | null;
  volume_cum: number | null;
  wc_ratio_actual: number | null;
  slump_at_plant_mm: number | null;
  filled_at: string | null;
  arrived_at: string | null;
  accepted_at: string | null;
  rejection_reason: string | null;
  expires_at: string;
}

export interface DispatchResponse {
  dispatch_id: number;
  pour_id: number | null;
  supplier_id: number;
  supplier_name: string | null;
  grade_id: number;
  grade_name: string | null;
  volume_ordered_cum: number | null;
  volume_received_cum: number | null;
  volume_remaining_cum: number | null;
  slump_at_site_mm: number | null;
  is_complete: boolean;
  truck: TruckInfo | null;
  created_at: string;
}

// Public truck-fill page (supplier, token-based).
export interface TruckFillView {
  project_name: string | null;
  supplier_name: string | null;
  grade_name: string | null;
  volume_ordered_cum: number | null;
  status: TruckStatus;
  expires_at: string;
  is_editable: boolean;
}

export interface TruckFillSubmit {
  vehicle_number: string;
  driver_name?: string | null;
  batch_number?: string | null;
  challan_number?: string | null;
  volume_cum?: number | null;
  wc_ratio_actual?: number | null;
  slump_at_plant_mm?: number | null;
}

export interface TruckActionResult {
  status: TruckStatus;
  message: string;
}

// Supervisor gate scan.
export interface GateTruckView {
  dispatch_id: number;
  project_name: string | null;
  supplier_name: string | null;
  grade_name: string | null;
  volume_ordered_cum: number | null;
  slump_at_site_mm: number | null;
  truck: TruckInfo;
}

export interface TruckArrive {
  slump_at_site_mm?: number | null;
}

export interface TruckReject {
  rejection_reason: string;
}

// ── Cube samples, tests + auto-NCRs (Phase 4) ───────────────────────────────

// app.models.quality.ResultStatus
export type ResultStatus = 'PENDING' | 'PASS' | 'FAIL' | 'CRITICAL_FAILURE';
// app.models.quality.NCRStatus
export type NCRStatus = 'OPEN' | 'UNDER_REVIEW' | 'CLOSED';

export interface CubeSampleCreate {
  sample_reference?: string | null;
  cast_date: string; // ISO date
  no_of_cubes?: number;
  lab_id?: number | null;
  lab_dispatch_date?: string | null; // ISO date
  expected_result_date?: string | null; // ISO date
  lab_dispatch_notes?: string | null;
}

export interface CubeTestCreate {
  test_age_days: number;
  test_date: string; // ISO date
  observed_strength_mpa: number;
  required_strength_mpa?: number | null; // omit → engine derives from grade + age
  lab_id?: number | null;
  lab_report_reference?: string | null;
}

export interface CubeTestResponse {
  test_id: number;
  sample_id: number;
  test_age_days: number;
  test_date: string;
  observed_strength_mpa: number;
  required_strength_mpa: number;
  result_status: ResultStatus;
  lab_id: number | null;
  lab_name: string | null;
  lab_report_reference: string | null;
  ncr_id: number | null;
  ncr_number: string | null;
  created_at: string;
}

export interface CubeSampleResponse {
  sample_id: number;
  pour_id: number;
  sample_reference: string | null;
  cast_date: string;
  no_of_cubes: number;
  lab_id: number | null;
  lab_name: string | null;
  lab_dispatch_date: string | null;
  expected_result_date: string | null;
  lab_dispatch_notes: string | null;
  created_at: string;
  pour_reference: string | null;
  tower_name: string | null;
  floor_label: string | null;
  component_type: string | null;
  grade_name: string | null;
  grade_min_strength_mpa: number | null;
  tests: CubeTestResponse[];
}

export interface NCRResponse {
  ncr_id: number;
  ncr_number: string | null;
  test_id: number;
  pour_id: number;
  status: NCRStatus;
  root_cause: string | null;
  raised_at: string;
  closed_at: string | null;
  result_status: ResultStatus | null;
  observed_strength_mpa: number | null;
  required_strength_mpa: number | null;
  test_age_days: number | null;
  sample_reference: string | null;
  grade_name: string | null;
  tower_name: string | null;
  floor_label: string | null;
  component_type: string | null;
}
