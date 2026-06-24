// Floors API — nested under a tower of a project.
// See backend/app/routers/floors.py.

import { api } from './client';
import type { FloorCreate, FloorGenerate, FloorResponse } from '../types/master';

export const floorsApi = {
  list(projectId: number, towerId: number): Promise<FloorResponse[]> {
    return api
      .get<FloorResponse[]>(`/projects/${projectId}/towers/${towerId}/floors`)
      .then((r) => r.data);
  },
  create(projectId: number, towerId: number, data: FloorCreate): Promise<FloorResponse> {
    return api
      .post<FloorResponse>(`/projects/${projectId}/towers/${towerId}/floors`, data)
      .then((r) => r.data);
  },
  generate(projectId: number, towerId: number, data: FloorGenerate): Promise<FloorResponse[]> {
    return api
      .post<FloorResponse[]>(`/projects/${projectId}/towers/${towerId}/floors/generate`, data)
      .then((r) => r.data);
  },
};
