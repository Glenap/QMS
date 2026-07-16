// Pours API — project-scoped wrappers over /projects/{id}/pours.
// See backend/app/routers/pours.py.

import { api } from './client';
import type { PourCreate, PourResponse } from '../types/master';

export const poursApi = {
  // QUALITY_ENGINEER only — record a pour from an accepted delivery.
  create(projectId: number, data: PourCreate): Promise<PourResponse> {
    return api
      .post<PourResponse>(`/projects/${projectId}/pours`, data)
      .then((r) => r.data);
  },

  // Anyone who can view the project.
  list(projectId: number): Promise<PourResponse[]> {
    return api
      .get<PourResponse[]>(`/projects/${projectId}/pours`)
      .then((r) => r.data);
  },

  get(projectId: number, pourId: number): Promise<PourResponse> {
    return api
      .get<PourResponse>(`/projects/${projectId}/pours/${pourId}`)
      .then((r) => r.data);
  },
};
