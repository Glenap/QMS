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
  sample_reference: string | null; // the cube number — the point's identity
  sample_id: number | null;
}

export interface CusumPoint {
  index: number; // cube number (1-based sequence)
  sample_reference: string | null;
  sample_id: number | null;
  test_date: string;
  observed_mpa: number;
  deviation: number; // observed − target mean
  cusum: number; // running cumulative sum
}
export interface CusumChart {
  points: CusumPoint[];
  grade_name: string | null;
  target_mean: number | null;
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
  target_mean: number | null; // RMC design target, else IS-10262 fck+1.65σ
  curve: CurvePoint[];
  histogram: StrengthBucket[];
}

// ── Graphical summary (Minitab-style descriptive report) ────────────────────
export interface HistogramBar {
  bin_low: number;
  bin_high: number;
  count: number;
}
export interface ProbPoint {
  value: number; // ordered observed strength
  theoretical: number; // theoretical normal quantile
}
export interface GraphicalSummary {
  sample_count: number;
  grade_name: string | null;
  fck: number | null;
  mean: number | null;
  std_dev: number | null;
  variance: number | null;
  skewness: number | null;
  kurtosis: number | null;
  minimum: number | null;
  q1: number | null;
  median: number | null;
  q3: number | null;
  maximum: number | null;
  ci_confidence: number;
  ci_mean_low: number | null;
  ci_mean_high: number | null;
  ad_statistic: number | null;
  ad_p_value: number | null;
  is_normal: boolean | null;
  bin_width: number | null;
  histogram: HistogramBar[];
  fit_curve: CurvePoint[]; // fitted normal PDF (density)
  kde_curve: CurvePoint[]; // Gaussian KDE (density)
  prob_points: ProbPoint[];
}

// ── Outlier scan (modified Thompson τ) ──────────────────────────────────────
export interface OutlierPoint {
  index: number; // 1-based chronological position
  value: number;
  is_outlier: boolean;
}
export interface OutlierAnalysis {
  sample_count: number;
  grade_name: string | null;
  mean: number | null;
  std_dev: number | null;
  outlier_count: number;
  clean_mean: number | null;
  clean_std_dev: number | null;
  tau: number | null;
  threshold: number | null; // τ·S — rejection distance from the mean
  points: OutlierPoint[];
  outliers: number[];
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

// ── Statistical tests (Student's t) ─────────────────────────────────────────

export type Alternative = 'two_sided' | 'greater' | 'less';
export type TTestBasis = 'fck' | 'target' | 'custom';

export interface OneSampleParams {
  grade_id?: number;
  tower_id?: number;
  supplier_id?: number;
  contractor_id?: number;
  basis?: TTestBasis;
  mu0?: number;
  confidence?: number;
  alternative?: Alternative;
  date_from?: string;
  date_to?: string;
}

export interface OneSampleTTest {
  sample_count: number;
  mean: number;
  std_dev: number;
  std_error: number;
  mu0: number;
  mu0_basis: TTestBasis;
  grade_name: string | null;
  values: number[];
  t_statistic: number;
  df: number;
  p_value: number;
  alternative: Alternative;
  confidence: number;
  ci_low: number;
  ci_high: number;
  significant: boolean;
  verdict: string;
}

export interface GroupFilter {
  grade_id?: number;
  tower_id?: number;
  supplier_id?: number;
  contractor_id?: number;
  date_from?: string;
  date_to?: string;
  label?: string;
}

export interface TwoSampleRequest {
  group_a: GroupFilter;
  group_b: GroupFilter;
  confidence: number;
  alternative: Alternative;
}

export interface GroupSummary {
  label: string;
  sample_count: number;
  mean: number | null;
  std_dev: number | null;
  values: number[];
}

export interface TwoSampleTTest {
  group_a: GroupSummary;
  group_b: GroupSummary;
  mean_diff: number;
  t_statistic: number;
  df: number;
  p_value: number;
  alternative: Alternative;
  confidence: number;
  ci_low: number;
  ci_high: number;
  significant: boolean;
  verdict: string;
}
