// Pours API — project-scoped wrappers over /projects/{id}/pours.
// See backend/app/routers/pours.py.

import { api } from './client';
import type { PourComplete, PourCreate, PourResponse } from '../types/master';

export const poursApi = {
  // QUALITY_ENGINEER only.
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

  // QUALITY_ENGINEER only.
  complete(projectId: number, pourId: number, data: PourComplete): Promise<PourResponse> {
    return api
      .patch<PourResponse>(`/projects/${projectId}/pours/${pourId}/complete`, data)
      .then((r) => r.data);
  },
};
