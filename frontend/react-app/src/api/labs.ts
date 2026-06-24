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
};
