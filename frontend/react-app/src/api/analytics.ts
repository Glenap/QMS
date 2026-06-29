// Analytics API — read-only project metric bundles for the Overview + Analytics
// dashboards. Every number comes from the backend metrics service (the single
// chokepoint); the frontend never aggregates. See backend/app/routers/analytics.py.

import { api } from './client';
import type {
  OverviewKpis,
  QualityAnalytics,
  QualityFilters,
  SupplierNcrCount,
  SupplierScore,
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
};
