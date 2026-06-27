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
