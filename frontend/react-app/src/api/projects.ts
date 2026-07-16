// Projects API — typed wrappers over the backend /projects endpoints.
// See backend/app/routers/projects.py.

import { api } from './client';
import type {
  AssignedProject,
  AvailableContractor,
  ProjectContractor,
  ProjectContractorCreate,
  ProjectCreate,
  ProjectDetail,
  ProjectMember,
  ProjectMemberCreate,
  ProjectResponse,
  ProjectStatus,
  TowerResponse,
} from '../types/master';

export const projectsApi = {
  // CLIENT_ADMIN only.
  create(data: ProjectCreate): Promise<ProjectResponse> {
    return api.post<ProjectResponse>('/projects', data).then((r) => r.data);
  },

  // Scoped to the caller (admins: all org projects; users: assigned only).
  list(): Promise<ProjectResponse[]> {
    return api.get<ProjectResponse[]>('/projects').then((r) => r.data);
  },

  detail(id: number): Promise<ProjectDetail> {
    return api.get<ProjectDetail>(`/projects/${id}`).then((r) => r.data);
  },

  towers(id: number): Promise<TowerResponse[]> {
    return api.get<TowerResponse[]>(`/projects/${id}/towers`).then((r) => r.data);
  },

  // Owning CLIENT_ADMIN sets the lifecycle status. Completing a project frees
  // its team members for reassignment.
  updateStatus(id: number, status: ProjectStatus): Promise<ProjectResponse> {
    return api.patch<ProjectResponse>(`/projects/${id}/status`, { status }).then((r) => r.data);
  },

  // ── Members ──────────────────────────────────────────────────────────────
  members(id: number): Promise<ProjectMember[]> {
    return api.get<ProjectMember[]>(`/projects/${id}/members`).then((r) => r.data);
  },
  assignMember(id: number, data: ProjectMemberCreate): Promise<ProjectMember> {
    return api.post<ProjectMember>(`/projects/${id}/members`, data).then((r) => r.data);
  },

  // ── Contractors (client side) ──────────────────────────────────────────────
  contractors(id: number): Promise<ProjectContractor[]> {
    return api.get<ProjectContractor[]>(`/projects/${id}/contractors`).then((r) => r.data);
  },
  // Reusable contractor orgs (not yet on this project) + their other engagements.
  availableContractors(id: number): Promise<AvailableContractor[]> {
    return api.get<AvailableContractor[]>(`/projects/${id}/available-contractors`).then((r) => r.data);
  },
  addContractor(id: number, data: ProjectContractorCreate): Promise<ProjectContractor> {
    return api.post<ProjectContractor>(`/projects/${id}/contractors`, data).then((r) => r.data);
  },

  // ── Contractor accept screen ───────────────────────────────────────────────
  assigned(): Promise<AssignedProject[]> {
    return api.get<AssignedProject[]>('/projects/assigned').then((r) => r.data);
  },
  acceptAssigned(pcId: number): Promise<ProjectContractor> {
    return api.post<ProjectContractor>(`/projects/assigned/${pcId}/accept`).then((r) => r.data);
  },
  declineAssigned(pcId: number): Promise<ProjectContractor> {
    return api.post<ProjectContractor>(`/projects/assigned/${pcId}/decline`).then((r) => r.data);
  },
};
