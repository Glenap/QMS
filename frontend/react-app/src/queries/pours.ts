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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pourKeys.list(pid) });
      // A recorded pour consumes its delivery — refresh the dispatch list too.
      qc.invalidateQueries({ queryKey: ['dispatches', pid] });
    },
  });
};
