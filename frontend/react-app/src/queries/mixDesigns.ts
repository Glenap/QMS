import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mixDesignsApi } from '../api/mixDesigns';
import type { MixDesignReview } from '../types/master';

export const mixDesignKeys = {
  list: (pid: number) => ['mix-designs', pid] as const,
  approvedGrades: (pid: number) => ['mix-designs', pid, 'approved-grades'] as const,
  requiredGrades: (pid: number, sid: number) =>
    ['mix-designs', pid, 'required-grades', sid] as const,
  forSupplier: (pid: number, sid: number) =>
    ['mix-designs', pid, 'supplier', sid] as const,
};

export const useMixDesigns = (pid: number) =>
  useQuery({ queryKey: mixDesignKeys.list(pid), queryFn: () => mixDesignsApi.list(pid) });

// Grades a pour may use (those with an approved mix design).
export const useApprovedGrades = (pid: number) =>
  useQuery({
    queryKey: mixDesignKeys.approvedGrades(pid),
    queryFn: () => mixDesignsApi.approvedGrades(pid),
  });

export const useRequiredGrades = (pid: number, sid: number) =>
  useQuery({
    queryKey: mixDesignKeys.requiredGrades(pid, sid),
    queryFn: () => mixDesignsApi.requiredGrades(pid, sid),
  });

export const useSupplierMixDesigns = (pid: number, sid: number) =>
  useQuery({
    queryKey: mixDesignKeys.forSupplier(pid, sid),
    queryFn: () => mixDesignsApi.forSupplier(pid, sid),
  });

const invalidateAll = (qc: ReturnType<typeof useQueryClient>, pid: number) => {
  void qc.invalidateQueries({ queryKey: ['mix-designs', pid] });
};

export const useSetRequiredGrades = (pid: number, sid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gradeIds: number[]) =>
      mixDesignsApi.setRequiredGrades(pid, sid, gradeIds),
    onSuccess: () => invalidateAll(qc, pid),
  });
};

export const useReviewMixDesign = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: MixDesignReview }) =>
      mixDesignsApi.review(pid, id, data),
    // A newly-approved/rejected mix changes the list and may unlock a poured grade.
    onSuccess: () => invalidateAll(qc, pid),
  });
};
