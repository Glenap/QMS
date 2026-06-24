// Mix designs API — project-scoped wrappers over /projects/{id}/mix-designs.
// See backend/app/routers/mix_designs.py.

import { api } from './client';
import type { MixDesignCreate, MixDesignResponse } from '../types/master';

export const mixDesignsApi = {
  list(projectId: number): Promise<MixDesignResponse[]> {
    return api
      .get<MixDesignResponse[]>(`/projects/${projectId}/mix-designs`)
      .then((r) => r.data);
  },
  create(projectId: number, data: MixDesignCreate): Promise<MixDesignResponse> {
    return api
      .post<MixDesignResponse>(`/projects/${projectId}/mix-designs`, data)
      .then((r) => r.data);
  },
};
