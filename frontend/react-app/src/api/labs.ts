// Testing labs API — project-scoped wrappers over /projects/{id}/labs.
// See backend/app/routers/labs.py.

import { api } from './client';
import type { LabCreate, LabResponse } from '../types/master';

export const labsApi = {
  // Contractor side (CONTRACTOR_ADMIN of an accepted org, or CONTRACTOR_LEAD).
  create(projectId: number, data: LabCreate): Promise<LabResponse> {
    return api
      .post<LabResponse>(`/projects/${projectId}/labs`, data)
      .then((r) => r.data);
  },

  // Anyone who can view the project.
  list(projectId: number): Promise<LabResponse[]> {
    return api
      .get<LabResponse[]>(`/projects/${projectId}/labs`)
      .then((r) => r.data);
  },

  // Re-send the confirmation email (contractor side).
  resendConfirmation(projectId: number, labId: number): Promise<LabResponse> {
    return api
      .post<LabResponse>(`/projects/${projectId}/labs/${labId}/resend-confirmation`)
      .then((r) => r.data);
  },

  // Block / unblock (QE, PM, or contractor). Block needs a reason.
  block(projectId: number, labId: number, reason: string): Promise<LabResponse> {
    return api
      .post<LabResponse>(`/projects/${projectId}/labs/${labId}/block`, { reason })
      .then((r) => r.data);
  },
  unblock(projectId: number, labId: number): Promise<LabResponse> {
    return api
      .post<LabResponse>(`/projects/${projectId}/labs/${labId}/unblock`)
      .then((r) => r.data);
  },

  // Contractor accepts / rejects a client-registered lab.
  approve(projectId: number, labId: number): Promise<LabResponse> {
    return api
      .post<LabResponse>(`/projects/${projectId}/labs/${labId}/approve`)
      .then((r) => r.data);
  },
  reject(projectId: number, labId: number, reason?: string): Promise<LabResponse> {
    return api
      .post<LabResponse>(`/projects/${projectId}/labs/${labId}/reject`, { reason })
      .then((r) => r.data);
  },
};
