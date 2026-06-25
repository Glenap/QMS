// Traceability API — lineage lookup. Search finds cube samples by any reference
// (sample / pour / NCR / challan / vehicle); detail walks one sample's full
// chain. See backend/app/routers/traceability.py.

import { api } from './client';
import type { TraceDetail, TraceRecord } from '../types/master';

export const traceabilityApi = {
  search(projectId: number, q: string): Promise<TraceRecord[]> {
    return api
      .get<TraceRecord[]>(`/projects/${projectId}/trace/search`, { params: { q } })
      .then((r) => r.data);
  },

  detail(projectId: number, sampleId: number): Promise<TraceDetail> {
    return api
      .get<TraceDetail>(`/projects/${projectId}/trace/${sampleId}`)
      .then((r) => r.data);
  },
};
