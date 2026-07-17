// Public lab cube-report API — no auth, token in query string.
// See backend/app/routers/lab_report.py.
//
// Uses a bare axios instance: this runs on the public /external/lab-report page
// where there is no logged-in user, so the auth interceptors must be skipped
// (mirrors api/dispatchFill.ts). The submit is multipart so the lab can attach a
// PDF — let axios set the multipart boundary itself.

import axios from 'axios';
import type { LabReportResult, LabReportStart, LabReportView } from '../types/master';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const publicApi = axios.create({ baseURL });

export interface LabReportSubmitFields {
  test_age_days: number;
  observed_strength_mpa: number;
  test_date?: string | null;
  lab_report_reference?: string | null;
}

export const labReportApi = {
  view(token: string): Promise<LabReportView> {
    return publicApi
      .get<LabReportView>('/external/lab-report', { params: { token } })
      .then((r) => r.data);
  },

  start(token: string, data: LabReportStart): Promise<LabReportView> {
    return publicApi
      .post<LabReportView>('/external/lab-report/start', data, {
        params: { token },
        headers: { 'Content-Type': 'application/json' },
      })
      .then((r) => r.data);
  },

  submit(
    token: string,
    fields: LabReportSubmitFields,
    file?: File | null,
  ): Promise<LabReportResult> {
    const fd = new FormData();
    fd.append('test_age_days', String(fields.test_age_days));
    fd.append('observed_strength_mpa', String(fields.observed_strength_mpa));
    if (fields.test_date) fd.append('test_date', fields.test_date);
    if (fields.lab_report_reference) fd.append('lab_report_reference', fields.lab_report_reference);
    if (file) fd.append('file', file);
    return publicApi
      .post<LabReportResult>('/external/lab-report', fd, { params: { token } })
      .then((r) => r.data);
  },

  createOcrJob(token: string, file: File): Promise<{ job_id: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return publicApi
      .post<{ job_id: string }>('/external/lab-report/ocr', formData, { params: { token } })
      .then((r) => r.data);
  },

  getOcrJob(token: string, jobId: string): Promise<any> {
    return publicApi
      .get<any>(`/external/lab-report/ocr/${jobId}`, { params: { token } })
      .then((r) => r.data);
  },
};
