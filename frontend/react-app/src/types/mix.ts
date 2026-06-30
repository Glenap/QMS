// Mix designs — RMC-owned, QE-approved (Phase 4A).

export type MixApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS';
export type CementType = 'OPC_43' | 'OPC_53';

// The detailed mix design an RMC submits for a requested grade (public token page).
export interface MixDesignSubmit {
  grade_id: number;
  mix_design_ref?: string | null;
  mix_type?: string | null;
  exposure_condition?: string | null;
  cement_type?: CementType | null;
  cement_kg?: number | null;
  flyash_kg?: number | null;
  ggbs_kg?: number | null;
  total_binder_kg?: number | null;
  wc_ratio?: number | null;
  free_water_l?: number | null;
  water_kg?: number | null;
  coarse_20mm_kg?: number | null;
  coarse_10mm_kg?: number | null;
  fine_agg_kg?: number | null;
  admixture_brand?: string | null;
  admixture_pct?: number | null;
  target_mean_strength_mpa?: number | null;
  max_aggregate_size_mm?: number | null;
  slump_range_mm?: string | null;
  trial_mix_date?: string | null;
}

export interface MixDesignResponse {
  mix_design_id: number;
  project_id: number | null;
  supplier_id: number;
  supplier_name: string | null;
  grade_id: number;
  grade_name: string | null;
  contractor_name: string | null;
  mix_design_ref: string | null;
  mix_type: string | null;
  exposure_condition: string | null;
  cement_type: CementType | null;
  cement_kg: number | null;
  flyash_kg: number | null;
  ggbs_kg: number | null;
  total_binder_kg: number | null;
  wc_ratio: number | null;
  free_water_l: number | null;
  water_kg: number | null;
  coarse_20mm_kg: number | null;
  coarse_10mm_kg: number | null;
  fine_agg_kg: number | null;
  admixture_brand: string | null;
  admixture_pct: number | null;
  target_mean_strength_mpa: number | null;
  max_aggregate_size_mm: number | null;
  slump_range_mm: string | null;
  trial_mix_date: string | null;
  strength_28day_mpa: number | null;
  approval_status: MixApprovalStatus | null;
  rejection_reason: string | null;
  observed_28day_strength_mpa: number | null;
  approval_date: string | null;
  created_at: string;
}

// The QE's decision on a submitted mix design.
export interface MixDesignReview {
  approval_status: 'APPROVED' | 'REJECTED' | 'IN_PROGRESS';
  rejection_reason?: string | null;
  observed_28day_strength_mpa?: number | null;
}

// A grade the contractor requested from a supplier (+ its submission status).
export interface RequiredGradeInfo {
  grade_id: number;
  grade_name: string | null;
  mix_design_id: number | null;
  approval_status: MixApprovalStatus | null;
}

export interface RequiredGradesUpdate {
  grade_ids: number[];
}

// Public token view shown to the RMC on the submission page.
export interface MixSubmissionView {
  supplier_name: string;
  project_name: string | null;
  registered_by: string | null;
  required_grades: RequiredGradeInfo[];
}
