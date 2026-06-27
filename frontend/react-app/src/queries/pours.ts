import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { poursApi } from '../api/pours';
import type { PourCreate } from '../types/master';

export const pourKeys = { list: (pid: number) => ['pours', pid] as const };

export const usePours = (pid: number) =>
  useQuery({ queryKey: pourKeys.list(pid), queryFn: () => poursApi.list(pid) });

export const useCreatePour = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PourCreate) => poursApi.create(pid, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: pourKeys.list(pid) }),
  });
};

export const useCompletePour = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pourId: number) => poursApi.complete(pid, pourId, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: pourKeys.list(pid) }),
  });
};
