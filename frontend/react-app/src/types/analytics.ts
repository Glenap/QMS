// Phase 6: analytics.
// Read-only metric bundles from /projects/{id}/analytics/*. All fields are
// additive — new metrics append, so dashboards/forms can grow without churn.

export interface OverviewKpis {
  pour_count: number;
  pour_volume_cum: number;
  test_count: number;
  pass_count: number;
  fail_count: number;
  critical_count: number;
  pass_rate_pct: number | null;
  avg_strength_mpa: number | null;
  ncr_open: number;
  ncr_under_review: number;
  ncr_closed: number;
  avg_days_to_close: number | null;
  truck_total: number;
  truck_accepted: number;
  truck_rejected: number;
  acceptance_pct: number | null;
}

export interface GradeTrendPoint {
  period: string; // 'YYYY-MM'
  grade_name: string;
  test_count: number;
  pass_count: number;
  pass_rate_pct: number | null;
}

export interface StrengthBucket {
  label: string;
  count: number;
}

export interface ResultBreakdown {
  status: string;
  count: number;
}

export interface QualityAnalytics {
  grade_trend: GradeTrendPoint[];
  strength_distribution: StrengthBucket[];
  result_breakdown: ResultBreakdown[];
}

export interface SupplierScore {
  supplier_id: number;
  supplier_name: string;
  pour_count: number;
  pour_volume_cum: number;
  test_count: number;
  pass_count: number;
  pass_rate_pct: number | null;
  avg_strength_mpa: number | null;
}

export interface SupplierNcrCount {
  supplier_id: number;
  supplier_name: string;
  open_count: number;
  closed_count: number;
  critical_count: number;
  total: number;
}

export interface QualityFilters {
  date_from?: string; // ISO date
  date_to?: string; // ISO date
  grade_id?: number;
  supplier_id?: number;
  tower_id?: number;
  contractor_id?: number;
  component_id?: number;
  sample_id?: number;
}

// ── Phase 5B: the four IS-456/10262 statistical charts ──────────────────────

export interface RunPoint {
  test_date: string;
  observed_mpa: number;
  grade_name: string | null;
  tower_name: string | null;
  reference: string | null;
}
export interface RunChart {
  points: RunPoint[];
  grade_name: string | null;
  fck: number | null;
  individual_min: number | null;
  target_mean: number | null;
  mean: number | null;
}

export interface CurvePoint { x: number; y: number }
export interface DistributionCurve {
  sample_count: number;
  mean: number | null;
  std_dev: number | null;
  fck: number | null;
  curve: CurvePoint[];
  histogram: StrengthBucket[];
}

export interface TargetMeanRow {
  grade_name: string;
  fck: number;
  target_mean: number;
  actual_mean: number | null;
  sample_count: number;
}
export interface TargetMeanChart { rows: TargetMeanRow[] }

export interface AgePoint {
  test_age_days: number;
  observed_mpa: number;
  required_mpa: number | null;
}
export interface StrengthAgeChart {
  points: AgePoint[];
  grade_name: string | null;
  reference: string | null;
}
