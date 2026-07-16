// RMC suppliers + their confirmation handshake.

import type { ConfirmationStatus } from './confirmation';

// Contractor approval of a client-registered RMC/lab (see Project.registration_by).
export type ApprovalStatus = 'NOT_REQUIRED' | 'PENDING' | 'ACCEPTED' | 'REJECTED';

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
  mix_design_document_id?: number | null;
}

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
  is_blocked: boolean;
  block_reason: string | null;
  registered_by: 'CONTRACTOR' | 'CLIENT';
  approval_status: ApprovalStatus;
  approval_reason: string | null;
  mix_design_document_id: number | null;
  mix_design_document_name: string | null;
  mix_submission_token: string | null;
  created_at: string;
}

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
