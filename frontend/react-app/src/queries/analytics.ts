import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analytics';
import type { QualityFilters } from '../types/master';

export const useAnalyticsOverview = (pid: number) =>
  useQuery({ queryKey: ['analytics-overview', pid], queryFn: () => analyticsApi.overview(pid) });

export const useAnalyticsQuality = (pid: number, filters: QualityFilters = {}) =>
  useQuery({
    queryKey: ['analytics-quality', pid, filters],
    queryFn: () => analyticsApi.quality(pid, filters),
  });

export const useSupplierScores = (pid: number) =>
  useQuery({ queryKey: ['analytics-suppliers', pid], queryFn: () => analyticsApi.suppliers(pid) });
