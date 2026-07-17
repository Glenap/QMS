export type OcrJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface OcrJobCreate {
  document_id: number;
  project_id: number;
}

export interface OcrJobResponse {
  job_id: string;
  project_id: number;
  document_id: number | null;
  uploaded_by: number | null;
  status: OcrJobStatus;
  doc_type: string | null;
  page_count: number | null;
  is_digital: boolean | null;
  result_json: {
    fields: Record<string, { value: any; confidence: number; method: string }>;
    domain_data: Record<string, any>;
    tables: any[][][];
    raw_text: string;
  } | null;
  overall_confidence: number | null;
  error_message: string | null;
  processing_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface OcrFieldCorrectionCreate {
  doc_type: string;
  original_fields: Record<string, any>;
  final_fields: Record<string, any>;
}
