// Pours (transaction).

export type PourStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// A pour is recorded from an accepted delivery: grade, supplier and volume come
// from the dispatch; the QE supplies the placement location + metadata.
export interface PourCreate {
  dispatch_id: number;
  tower_id: number;
  floor_id: number;
  component_id: number;
  supplier_vertical_id?: number | null;
  mix_design_id?: number | null;
  pour_date: string; // ISO date
  pour_reference?: string | null;
  sub_contractor_name?: string | null;
}

export interface PourResponse {
  pour_id: number;
  project_id: number;
  dispatch_id: number | null;
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
