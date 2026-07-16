// Testing labs + their confirmation handshake.

import type { ConfirmationStatus } from './confirmation';
import type { ApprovalStatus } from './supplier';

// app.models.master.LabType
export type LabType = 'IN_HOUSE' | 'THIRD_PARTY';

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
  is_blocked: boolean;
  block_reason: string | null;
  registered_by: 'CONTRACTOR' | 'CLIENT';
  approval_status: ApprovalStatus;
  approval_reason: string | null;
  created_at: string;
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
