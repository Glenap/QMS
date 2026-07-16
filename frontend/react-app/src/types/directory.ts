// Org-wide RMC / lab directories (cross-project roll-ups). See
// backend/app/routers/directory.py — read-only lists of every supplier / lab the
// caller's organisation can see, with the project + contractor each is under.

import type { LabType } from './lab';

export interface SupplierDirectoryItem {
  supplier_id: number;
  supplier_name: string;
  project_id: number | null;
  project_name: string | null;
  contractor_org_id: number;
  contractor_org_name: string | null;
  contact_email: string | null;
  plant_location: string | null;
  status: string; // confirmation: PENDING | CONFIRMED | DECLINED
  approval_status: string; // NOT_REQUIRED | PENDING | ACCEPTED | REJECTED
  registered_by: string; // CONTRACTOR | CLIENT
  is_blocked: boolean;
}

export interface LabDirectoryItem {
  lab_id: number;
  lab_name: string;
  lab_type: LabType;
  project_id: number | null;
  project_name: string | null;
  contractor_org_id: number;
  contractor_org_name: string | null;
  contact_email: string | null;
  city: string | null;
  status: string;
  approval_status: string;
  registered_by: string;
  is_blocked: boolean;
}
