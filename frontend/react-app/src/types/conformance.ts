// Conformance Analyser — per-photo defect classifications.
// Mirrors backend app/schemas/conformance.py. The defect taxonomy itself lives
// on the frontend (src/data/defectTaxonomy.ts); these are the persisted picks.

export type DefectPhase = 'PRE' | 'POST' | 'RCC';
export type FindingSeverity = 'LOW' | 'MED' | 'HIGH';

export interface ConformanceFinding {
  finding_id: number;
  project_id: number;
  document_id: number;
  phase: DefectPhase;
  defect_code: string;
  defect_label: string;
  severity: FindingSeverity;
  remediation_choice: 'A' | 'B' | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConformanceFindingUpsert {
  document_id: number;
  phase: DefectPhase;
  defect_code: string;
  defect_label: string;
  severity: FindingSeverity;
  remediation_choice?: 'A' | 'B' | null;
  notes?: string | null;
}
