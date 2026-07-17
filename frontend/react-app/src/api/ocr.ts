// OCR API wrappers over /projects/{id}/ocr

import { api } from './client';
import type { OcrJobCreate, OcrJobResponse, OcrFieldCorrectionCreate } from '../types/ocr';

export const ocrApi = {
  createJob(projectId: number, data: OcrJobCreate): Promise<{ job_id: string }> {
    return api
      .post<{ job_id: string }>(`/projects/${projectId}/ocr`, data)
      .then((r) => r.data);
  },

  getJob(projectId: number, jobId: string): Promise<OcrJobResponse> {
    return api
      .get<OcrJobResponse>(`/projects/${projectId}/ocr/${jobId}`)
      .then((r) => r.data);
  },

  submitCorrections(
    projectId: number,
    jobId: string,
    data: OcrFieldCorrectionCreate,
  ): Promise<void> {
    return api
      .post(`/projects/${projectId}/ocr/${jobId}/corrections`, data)
      .then(() => undefined);
  },
};
