// Dispatch + gate API — project-scoped wrappers over /projects/{id}/dispatches
// and /projects/{id}/gate/{token}. See backend/app/routers/dispatches.py.

import { api } from './client';
import type {
  DispatchCreate,
  DispatchResponse,
  GateTruckView,
  TruckArrive,
  TruckReject,
} from '../types/master';

export const dispatchesApi = {
  // ── Dispatches (QUALITY_ENGINEER raises; any viewer reads) ────────────────

  create(projectId: number, data: DispatchCreate): Promise<DispatchResponse> {
    return api
      .post<DispatchResponse>(`/projects/${projectId}/dispatches`, data)
      .then((r) => r.data);
  },

  list(projectId: number, pourId?: number): Promise<DispatchResponse[]> {
    return api
      .get<DispatchResponse[]>(`/projects/${projectId}/dispatches`, {
        params: pourId != null ? { pour_id: pourId } : undefined,
      })
      .then((r) => r.data);
  },

  get(projectId: number, dispatchId: number): Promise<DispatchResponse> {
    return api
      .get<DispatchResponse>(`/projects/${projectId}/dispatches/${dispatchId}`)
      .then((r) => r.data);
  },

  // QUALITY_ENGINEER only — re-email the supplier the truck-fill link.
  resend(projectId: number, dispatchId: number): Promise<DispatchResponse> {
    return api
      .post<DispatchResponse>(`/projects/${projectId}/dispatches/${dispatchId}/resend`)
      .then((r) => r.data);
  },

  // ── Gate scan (SUPERVISOR) ────────────────────────────────────────────────

  gateLookup(projectId: number, token: string): Promise<GateTruckView> {
    return api
      .get<GateTruckView>(`/projects/${projectId}/gate/${token}`)
      .then((r) => r.data);
  },

  gateArrive(projectId: number, token: string, data: TruckArrive): Promise<GateTruckView> {
    return api
      .post<GateTruckView>(`/projects/${projectId}/gate/${token}/arrive`, data)
      .then((r) => r.data);
  },

  gateAccept(projectId: number, token: string): Promise<GateTruckView> {
    return api
      .post<GateTruckView>(`/projects/${projectId}/gate/${token}/accept`)
      .then((r) => r.data);
  },

  gateReject(projectId: number, token: string, data: TruckReject): Promise<GateTruckView> {
    return api
      .post<GateTruckView>(`/projects/${projectId}/gate/${token}/reject`, data)
      .then((r) => r.data);
  },
};
