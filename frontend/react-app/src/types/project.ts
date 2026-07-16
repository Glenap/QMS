// Projects, towers, membership, contractors, access.
// Mirrors backend app/schemas/master.py.

export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';

export type ProjectType =
  | 'RESIDENTIAL'
  | 'COMMERCIAL'
  | 'MIXED_USE'
  | 'INFRASTRUCTURE';

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

export type RegistrationBy = 'CONTRACTOR' | 'CLIENT';

export interface ProjectCreate {
  project_name: string;
  project_type?: ProjectType | null;
  project_code?: string | null;
  status?: ProjectStatus;
  // Who registers RMC suppliers + labs: CONTRACTOR (default) or CLIENT.
  registration_by?: RegistrationBy;
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
  registration_by: RegistrationBy;
  city: string | null;
  state: string | null;
  start_date: string | null;
  end_date: string | null;
  no_of_towers: number | null;
  // Contractor viewer only: their allotted-tower scope label (else null).
  assigned_scope?: string | null;
  created_at: string;
}

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
  // The viewer's per-project designation (ProjectRole value) or null. Field
  // capabilities (cast pours, work the gate…) are gated on this, not the org role.
  project_role: string | null;
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
