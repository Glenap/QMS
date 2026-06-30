// Dispatch + gate API — project-scoped wrappers over /projects/{id}/dispatches
// and /projects/{id}/gate/{token}. See backend/app/routers/dispatches.py.

import { api } from './client';
import type {
  ActionRequired,
  DispatchCreate,
  DispatchResponse,
  GateTruckView,
  InsituSubmit,
  QEInboxCount,
  QEReviewItem,
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

  // Supervisor flags a mismatch on an admitted truck → QE inbox.
  gateActionRequired(
    projectId: number,
    token: string,
    data: ActionRequired,
  ): Promise<GateTruckView> {
    return api
      .post<GateTruckView>(`/projects/${projectId}/gate/${token}/action-required`, data)
      .then((r) => r.data);
  },

  // ── QE inbox + in-situ slump sign-off (QUALITY_ENGINEER) ──────────────────

  qeInbox(projectId: number): Promise<QEReviewItem[]> {
    return api
      .get<QEReviewItem[]>(`/projects/${projectId}/qe-inbox`)
      .then((r) => r.data);
  },

  qeInboxCount(projectId: number): Promise<QEInboxCount> {
    return api
      .get<QEInboxCount>(`/projects/${projectId}/qe-inbox/count`)
      .then((r) => r.data);
  },

  recordInsitu(
    projectId: number,
    dispatchId: number,
    data: InsituSubmit,
  ): Promise<GateTruckView> {
    return api
      .post<GateTruckView>(`/projects/${projectId}/dispatches/${dispatchId}/insitu`, data)
      .then((r) => r.data);
  },
};
