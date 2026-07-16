// NCRs + lifecycle (Phase 5).

import type { ResultStatus } from './cube';

// app.models.quality.NCRStatus
export type NCRStatus = 'OPEN' | 'UNDER_REVIEW' | 'CLOSED';
// app.models.quality.ActionStatus
export type ActionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
// app.models.quality.RetestType — IS-456 in-situ verification method.
export type RetestType = 'CORE_CUTTING' | 'REBOUND_HAMMER' | 'UPV';
// app.models.quality.RetestResult
export type RetestResult = 'PASS' | 'FAIL';

export interface NCRResponse {
  ncr_id: number;
  ncr_number: string | null;
  test_id: number;
  pour_id: number;
  status: NCRStatus;
  root_cause: string | null;
  raised_by: number | null;
  raised_by_name: string | null;
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
  corrective_action_count: number;
  open_action_count: number;
  retest_count: number;
  open_retest_count: number;
}

export interface NCRUpdate {
  status?: NCRStatus;
  root_cause?: string | null;
}

export interface CorrectiveActionCreate {
  action_description: string;
  assigned_to?: number | null;
  due_date?: string | null; // ISO date
}

export interface CorrectiveActionUpdate {
  action_description?: string | null;
  assigned_to?: number | null;
  due_date?: string | null; // ISO date
  status?: ActionStatus;
}

export interface CorrectiveActionResponse {
  action_id: number;
  ncr_id: number;
  action_description: string;
  assigned_to: number | null;
  assigned_to_name: string | null;
  due_date: string | null;
  status: ActionStatus;
  created_at: string;
}

// ── Retests (IS-456 in-situ verification) ────────────────────────────────────

export interface RetestCreate {
  retest_type: RetestType;
  notes?: string | null;
}

export interface RetestResultUpdate {
  result?: RetestResult | null;
  test_date?: string | null; // ISO date
  observed_strength_mpa?: number | null;
  required_strength_mpa?: number | null;
  lab_id?: number | null;
  report_document_id?: number | null;
  notes?: string | null;
}

export interface RetestResponse {
  retest_id: number;
  ncr_id: number;
  retest_type: RetestType;
  result: RetestResult | null;
  test_date: string | null;
  observed_strength_mpa: number | null;
  required_strength_mpa: number | null;
  lab_id: number | null;
  lab_name: string | null;
  report_document_id: number | null;
  notes: string | null;
  ordered_by: number | null;
  ordered_by_name: string | null;
  created_at: string;
  completed_at: string | null;
  ncr_number: string | null;
  grade_name: string | null;
}

// ── RMC notifications (email the plant about an NCR) ──────────────────────────

export interface NcrNotifyRmc {
  subject?: string | null;
  message?: string | null;
  document_id?: number | null;
}

export interface NcrRmcNotificationResponse {
  notification_id: number;
  ncr_id: number;
  supplier_id: number | null;
  supplier_name: string | null;
  subject: string;
  message: string;
  report_document_id: number | null;
  sent_by: number | null;
  sent_by_name: string | null;
  sent_at: string;
}

// ── AI pattern insight (deterministic, cross-NCR) ────────────────────────────

export interface NcrPatternResponse {
  supplier_name: string | null;
  grade_name: string | null;
  window_days: number;
  supplier_grade_ncr_count: number;
  supplier_ncr_count: number;
  recurring_low_28d_count: number;
  summary: string;
}

export interface NCRDetailResponse extends NCRResponse {
  corrective_actions: CorrectiveActionResponse[];
  retests: RetestResponse[];
  rmc_notifications: NcrRmcNotificationResponse[];
}
