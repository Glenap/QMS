// RMC dispatch + gate scan (truck token flow).

// app.models.transaction.TruckStatus
export type TruckStatus =
  | 'PENDING' | 'FILLED' | 'ARRIVED' | 'PENDING_QE' | 'ACCEPTED' | 'REJECTED';

// Phase 4B mismatch action items + QE in-situ slump gate.
export type ActionReason = 'GRADE_MISMATCH' | 'SLUMP_MISMATCH' | 'VOLUME_MISMATCH' | 'OTHER';
export type ActionResolution = 'APPROVED' | 'REJECTED';
export type InsituResult = 'PASS' | 'FAIL';

export interface ActionRequired {
  reason: ActionReason;
  message: string;
}

export interface ActionItemResponse {
  action_item_id: number;
  project_id: number;
  dispatch_id: number;
  reason: ActionReason;
  message: string;
  status: 'OPEN' | 'RESOLVED';
  resolution: ActionResolution | null;
  created_at: string;
  resolved_at: string | null;
}

export interface InsituSubmit {
  measured_slump_mm: number;
  decision: ActionResolution;
  rejection_reason?: string | null;
  notes?: string | null;
}

export interface InsituTestInfo {
  measured_slump_mm: number;
  target_slump_mm: string | null;
  result: InsituResult;
  notes: string | null;
  tested_at: string;
}

export interface QEReviewItem {
  dispatch_id: number;
  token: string;
  supplier_name: string | null;
  grade_name: string | null;
  target_slump_mm: string | null;
  slump_at_site_mm: number | null;
  volume_cum: number | null;
  pour_reference: string | null;
  action_item: ActionItemResponse | null;
  created_at: string;
}

export interface QEInboxCount {
  count: number;
}

export interface DispatchCreate {
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
  // Concrete placement window: minutes in transit (dispatch → now/arrival) vs
  // the 90-min IS-456 limit. A truck arriving past the window is auto-rejected.
  dispatch_time: string | null;
  transit_minutes: number | null;
  placement_window_minutes: number | null;
  target_slump_mm: string | null;
  insitu: InsituTestInfo | null;
  truck: TruckInfo;
}

export interface TruckArrive {
  slump_at_site_mm?: number | null;
}

export interface TruckReject {
  rejection_reason: string;
}
