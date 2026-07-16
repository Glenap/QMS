import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { labsApi } from '../api/labs';
import type { LabCreate } from '../types/master';

export const labKeys = { list: (pid: number) => ['labs', pid] as const };

export const useLabs = (pid: number) =>
  useQuery({ queryKey: labKeys.list(pid), queryFn: () => labsApi.list(pid) });

export const useCreateLab = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LabCreate) => labsApi.create(pid, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: labKeys.list(pid) }),
  });
};

export const useResendLabConfirmation = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (labId: number) => labsApi.resendConfirmation(pid, labId),
    onSuccess: () => qc.invalidateQueries({ queryKey: labKeys.list(pid) }),
  });
};

export const useSetLabBlocked = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { labId: number; block: boolean; reason?: string }) =>
      vars.block
        ? labsApi.block(pid, vars.labId, vars.reason ?? '')
        : labsApi.unblock(pid, vars.labId),
    onSuccess: () => qc.invalidateQueries({ queryKey: labKeys.list(pid) }),
  });
};

export const useReviewLab = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { labId: number; accept: boolean; reason?: string }) =>
      vars.accept
        ? labsApi.approve(pid, vars.labId)
        : labsApi.reject(pid, vars.labId, vars.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: labKeys.list(pid) }),
  });
};
