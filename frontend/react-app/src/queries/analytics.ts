import { useMutation, useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analytics';
import type { OneSampleParams, QualityFilters } from '../types/master';

export const useAnalyticsOverview = (pid: number) =>
  useQuery({ queryKey: ['analytics-overview', pid], queryFn: () => analyticsApi.overview(pid) });

export const useAnalyticsQuality = (pid: number, filters: QualityFilters = {}) =>
  useQuery({
    queryKey: ['analytics-quality', pid, filters],
    queryFn: () => analyticsApi.quality(pid, filters),
  });

export const useSupplierScores = (pid: number, filters: QualityFilters = {}) =>
  useQuery({
    queryKey: ['analytics-suppliers', pid, filters],
    queryFn: () => analyticsApi.suppliers(pid, filters),
  });

export const useNcrsBySupplier = (pid: number, filters: QualityFilters = {}) =>
  useQuery({
    queryKey: ['analytics-ncrs-by-supplier', pid, filters],
    queryFn: () => analyticsApi.ncrsBySupplier(pid, filters),
  });

// ── Phase 5B statistical charts ──
export const useRunChart = (pid: number, filters: QualityFilters = {}) =>
  useQuery({ queryKey: ['analytics-run', pid, filters], queryFn: () => analyticsApi.runChart(pid, filters) });

export const useDistribution = (pid: number, filters: QualityFilters = {}) =>
  useQuery({ queryKey: ['analytics-dist', pid, filters], queryFn: () => analyticsApi.distribution(pid, filters) });

export const useGraphicalSummary = (pid: number, filters: QualityFilters = {}, confidence?: number) =>
  useQuery({
    queryKey: ['analytics-graphical-summary', pid, filters, confidence],
    queryFn: () => analyticsApi.graphicalSummary(pid, filters, confidence),
  });

export const useOutliers = (pid: number, filters: QualityFilters = {}) =>
  useQuery({
    queryKey: ['analytics-outliers', pid, filters],
    queryFn: () => analyticsApi.outliers(pid, filters),
  });

export const useCusum = (pid: number, filters: QualityFilters = {}) =>
  useQuery({ queryKey: ['analytics-cusum', pid, filters], queryFn: () => analyticsApi.cusum(pid, filters) });

export const useTargetMean = (pid: number, filters: QualityFilters = {}) =>
  useQuery({ queryKey: ['analytics-target', pid, filters], queryFn: () => analyticsApi.targetMean(pid, filters) });

export const useStrengthVsAge = (pid: number, filters: QualityFilters = {}) =>
  useQuery({ queryKey: ['analytics-age', pid, filters], queryFn: () => analyticsApi.strengthVsAge(pid, filters) });

// ── Statistical tests (Student's t) ──
// One-sample runs live as its inputs change (guarded by `enabled`); two-sample is
// an explicit "Compare" action, so it's a mutation the button fires.
export const useOneSampleTTest = (pid: number, params: OneSampleParams, enabled: boolean) =>
  useQuery({
    queryKey: ['ttest-one', pid, params],
    queryFn: () => analyticsApi.oneSampleTTest(pid, params),
    enabled,
    retry: false,
  });

export const useTwoSampleTTest = (pid: number) =>
  useMutation({ mutationFn: analyticsApi.twoSampleTTest.bind(null, pid) });
