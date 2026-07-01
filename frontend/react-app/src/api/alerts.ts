// Quality alerts API — the IS-456/10262 alert feed for the QE + PM.
// See backend/app/routers/alerts.py.

import { api } from './client';
import type { AlertCount, AlertResponse } from '../types/master';

export const alertsApi = {
  list(projectId: number): Promise<AlertResponse[]> {
    return api.get<AlertResponse[]>(`/projects/${projectId}/alerts`).then((r) => r.data);
  },
  count(projectId: number): Promise<AlertCount> {
    return api.get<AlertCount>(`/projects/${projectId}/alerts/count`).then((r) => r.data);
  },
  acknowledge(projectId: number, alertId: number): Promise<AlertResponse> {
    return api
      .post<AlertResponse>(`/projects/${projectId}/alerts/${alertId}/acknowledge`)
      .then((r) => r.data);
  },
};
