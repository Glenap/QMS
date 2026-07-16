// NCR lifecycle API — project-scoped wrappers over the NCR endpoints: the NCR
// list/detail plus root-cause/status updates, corrective actions, NDT/core
// retests, RMC notifications, and the pattern insight. See
// backend/app/routers/ncrs.py.

import { api } from './client';
import type {
  CorrectiveActionCreate,
  CorrectiveActionResponse,
  CorrectiveActionUpdate,
  NcrNotifyRmc,
  NcrPatternResponse,
  NcrRmcNotificationResponse,
  NCRDetailResponse,
  NCRResponse,
  NCRUpdate,
  RetestCreate,
  RetestResponse,
  RetestResultUpdate,
} from '../types/master';

export const ncrsApi = {
  // ── Reads (any project viewer) ────────────────────────────────────────────

  list(projectId: number): Promise<NCRResponse[]> {
    return api.get<NCRResponse[]>(`/projects/${projectId}/ncrs`).then((r) => r.data);
  },

  get(projectId: number, ncrId: number): Promise<NCRDetailResponse> {
    return api
      .get<NCRDetailResponse>(`/projects/${projectId}/ncrs/${ncrId}`)
      .then((r) => r.data);
  },

  // ── Lifecycle (QUALITY_ENGINEER) ──────────────────────────────────────────

  update(projectId: number, ncrId: number, data: NCRUpdate): Promise<NCRDetailResponse> {
    return api
      .patch<NCRDetailResponse>(`/projects/${projectId}/ncrs/${ncrId}`, data)
      .then((r) => r.data);
  },

  addCorrectiveAction(
    projectId: number,
    ncrId: number,
    data: CorrectiveActionCreate,
  ): Promise<CorrectiveActionResponse> {
    return api
      .post<CorrectiveActionResponse>(
        `/projects/${projectId}/ncrs/${ncrId}/corrective-actions`,
        data,
      )
      .then((r) => r.data);
  },

  updateCorrectiveAction(
    projectId: number,
    ncrId: number,
    actionId: number,
    data: CorrectiveActionUpdate,
  ): Promise<CorrectiveActionResponse> {
    return api
      .patch<CorrectiveActionResponse>(
        `/projects/${projectId}/ncrs/${ncrId}/corrective-actions/${actionId}`,
        data,
      )
      .then((r) => r.data);
  },

  // ── Retests ───────────────────────────────────────────────────────────────

  orderRetest(
    projectId: number,
    ncrId: number,
    data: RetestCreate,
  ): Promise<RetestResponse> {
    return api
      .post<RetestResponse>(`/projects/${projectId}/ncrs/${ncrId}/retests`, data)
      .then((r) => r.data);
  },

  recordRetestResult(
    projectId: number,
    ncrId: number,
    retestId: number,
    data: RetestResultUpdate,
  ): Promise<RetestResponse> {
    return api
      .patch<RetestResponse>(
        `/projects/${projectId}/ncrs/${ncrId}/retests/${retestId}`,
        data,
      )
      .then((r) => r.data);
  },

  listRetests(projectId: number): Promise<RetestResponse[]> {
    return api
      .get<RetestResponse[]>(`/projects/${projectId}/retests`)
      .then((r) => r.data);
  },

  // ── RMC notification + pattern ────────────────────────────────────────────

  notifyRmc(
    projectId: number,
    ncrId: number,
    data: NcrNotifyRmc,
  ): Promise<NcrRmcNotificationResponse> {
    return api
      .post<NcrRmcNotificationResponse>(
        `/projects/${projectId}/ncrs/${ncrId}/notify-rmc`,
        data,
      )
      .then((r) => r.data);
  },

  pattern(projectId: number, ncrId: number): Promise<NcrPatternResponse> {
    return api
      .get<NcrPatternResponse>(`/projects/${projectId}/ncrs/${ncrId}/pattern`)
      .then((r) => r.data);
  },
};
