// Pours (transaction).

export type PourStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface PourCreate {
  tower_id: number;
  floor_id: number;
  component_id: number;
  grade_id: number;
  supplier_horizontal_id: number;
  supplier_vertical_id?: number | null;
  mix_design_id?: number | null;
  pour_date: string; // ISO date
  pour_reference?: string | null;
  volume_cum?: number | null;
  sub_contractor_name?: string | null;
}

export interface PourComplete {
  volume_actual_cum?: number | null;
  completion_notes?: string | null;
}

export interface PourResponse {
  pour_id: number;
  project_id: number;
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
  volume_delivered_cum: number | null;
  volume_remaining_cum: number | null;
  created_at: string;
}
