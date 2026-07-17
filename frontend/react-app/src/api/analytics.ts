// Analytics API — read-only project metric bundles for the Overview + Analytics
// dashboards. Every number comes from the backend metrics service (the single
// chokepoint); the frontend never aggregates. See backend/app/routers/analytics.py.

import { api } from './client';
import type {
  CusumChart,
  DistributionCurve,
  OneSampleParams,
  OneSampleTTest,
  OverviewKpis,
  QualityAnalytics,
  QualityFilters,
  RunChart,
  StrengthAgeChart,
  SupplierNcrCount,
  SupplierScore,
  TargetMeanChart,
  TwoSampleRequest,
  TwoSampleTTest,
} from '../types/master';

export const analyticsApi = {
  overview(projectId: number): Promise<OverviewKpis> {
    return api
      .get<OverviewKpis>(`/projects/${projectId}/analytics/overview`)
      .then((r) => r.data);
  },

  quality(projectId: number, filters: QualityFilters = {}): Promise<QualityAnalytics> {
    return api
      .get<QualityAnalytics>(`/projects/${projectId}/analytics/quality`, { params: filters })
      .then((r) => r.data);
  },

  suppliers(projectId: number, filters: QualityFilters = {}): Promise<SupplierScore[]> {
    return api
      .get<SupplierScore[]>(`/projects/${projectId}/analytics/suppliers`, { params: filters })
      .then((r) => r.data);
  },

  ncrsBySupplier(projectId: number, filters: QualityFilters = {}): Promise<SupplierNcrCount[]> {
    return api
      .get<SupplierNcrCount[]>(`/projects/${projectId}/analytics/ncrs-by-supplier`, { params: filters })
      .then((r) => r.data);
  },

  // ── Phase 5B statistical charts ──
  runChart(projectId: number, filters: QualityFilters = {}): Promise<RunChart> {
    return api
      .get<RunChart>(`/projects/${projectId}/analytics/run-chart`, { params: filters })
      .then((r) => r.data);
  },
  distribution(projectId: number, filters: QualityFilters = {}): Promise<DistributionCurve> {
    return api
      .get<DistributionCurve>(`/projects/${projectId}/analytics/distribution`, { params: filters })
      .then((r) => r.data);
  },
  cusum(projectId: number, filters: QualityFilters = {}): Promise<CusumChart> {
    return api
      .get<CusumChart>(`/projects/${projectId}/analytics/cusum`, { params: filters })
      .then((r) => r.data);
  },
  targetMean(projectId: number, filters: QualityFilters = {}): Promise<TargetMeanChart> {
    return api
      .get<TargetMeanChart>(`/projects/${projectId}/analytics/target-mean`, { params: filters })
      .then((r) => r.data);
  },
  strengthVsAge(projectId: number, filters: QualityFilters = {}): Promise<StrengthAgeChart> {
    return api
      .get<StrengthAgeChart>(`/projects/${projectId}/analytics/strength-vs-age`, { params: filters })
      .then((r) => r.data);
  },

  // ── Statistical tests (Student's t) ──
  oneSampleTTest(projectId: number, params: OneSampleParams): Promise<OneSampleTTest> {
    return api
      .get<OneSampleTTest>(`/projects/${projectId}/analytics/ttest/one-sample`, { params })
      .then((r) => r.data);
  },
  twoSampleTTest(projectId: number, body: TwoSampleRequest): Promise<TwoSampleTTest> {
    return api
      .post<TwoSampleTTest>(`/projects/${projectId}/analytics/ttest/two-sample`, body)
      .then((r) => r.data);
  },
};
