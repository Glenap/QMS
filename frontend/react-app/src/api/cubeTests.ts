// Cube tests API — project-scoped wrappers over the Phase 4 endpoints:
// cube samples, strength tests, and the NCRs auto-raised on failure.
// See backend/app/routers/cube_tests.py.

import { api } from './client';
import type {
  CubeSampleCreate,
  CubeSampleResponse,
  CubeTestCreate,
  CubeTestResponse,
  NCRResponse,
} from '../types/master';

export const cubeTestsApi = {
  // ── Samples (QUALITY_ENGINEER casts; any viewer reads) ────────────────────

  castSample(
    projectId: number,
    pourId: number,
    data: CubeSampleCreate,
  ): Promise<CubeSampleResponse> {
    return api
      .post<CubeSampleResponse>(`/projects/${projectId}/pours/${pourId}/samples`, data)
      .then((r) => r.data);
  },

  listSamplesForPour(projectId: number, pourId: number): Promise<CubeSampleResponse[]> {
    return api
      .get<CubeSampleResponse[]>(`/projects/${projectId}/pours/${pourId}/samples`)
      .then((r) => r.data);
  },

  listSamples(projectId: number): Promise<CubeSampleResponse[]> {
    return api
      .get<CubeSampleResponse[]>(`/projects/${projectId}/samples`)
      .then((r) => r.data);
  },

  // ── Tests (QUALITY_ENGINEER) — grading + auto-NCR happen server-side ──────

  recordTest(
    projectId: number,
    sampleId: number,
    data: CubeTestCreate,
  ): Promise<CubeTestResponse> {
    return api
      .post<CubeTestResponse>(`/projects/${projectId}/samples/${sampleId}/tests`, data)
      .then((r) => r.data);
  },

  // ── NCRs (read-only here; lifecycle in Phase 5) ───────────────────────────

  listNcrs(projectId: number): Promise<NCRResponse[]> {
    return api
      .get<NCRResponse[]>(`/projects/${projectId}/ncrs`)
      .then((r) => r.data);
  },

  getNcr(projectId: number, ncrId: number): Promise<NCRResponse> {
    return api
      .get<NCRResponse>(`/projects/${projectId}/ncrs/${ncrId}`)
      .then((r) => r.data);
  },
};
