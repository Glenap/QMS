// Conformance API — per-photo defect findings. Mirrors backend
// app/routers/conformance.py (/projects/{id}/conformance/findings).

import { api } from './client';
import type { ConformanceFinding, ConformanceFindingUpsert } from '../types/conformance';

export const conformanceApi = {
  listFindings(projectId: number): Promise<ConformanceFinding[]> {
    return api
      .get<ConformanceFinding[]>(`/projects/${projectId}/conformance/findings`)
      .then((r) => r.data);
  },
  upsertFinding(projectId: number, data: ConformanceFindingUpsert): Promise<ConformanceFinding> {
    return api
      .put<ConformanceFinding>(`/projects/${projectId}/conformance/findings`, data)
      .then((r) => r.data);
  },
  deleteFinding(projectId: number, findingId: number): Promise<void> {
    return api
      .delete(`/projects/${projectId}/conformance/findings/${findingId}`)
      .then(() => undefined);
  },
};
