import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dispatchesApi } from '../api/dispatches';
import type { InsituSubmit } from '../types/master';

export const qeInboxKeys = {
  list: (pid: number) => ['qe-inbox', pid] as const,
  count: (pid: number) => ['qe-inbox', pid, 'count'] as const,
};

// Deliveries awaiting the QE's in-situ sign-off. Polled so the bell + list stay live.
export const useQEInbox = (pid: number, enabled = true) =>
  useQuery({
    queryKey: qeInboxKeys.list(pid),
    queryFn: () => dispatchesApi.qeInbox(pid),
    enabled,
    refetchInterval: 20_000,
  });

export const useQEInboxCount = (pid: number, enabled = true) =>
  useQuery({
    queryKey: qeInboxKeys.count(pid),
    queryFn: () => dispatchesApi.qeInboxCount(pid),
    enabled,
    refetchInterval: 20_000,
  });

export const useRecordInsitu = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dispatchId, data }: { dispatchId: number; data: InsituSubmit }) =>
      dispatchesApi.recordInsitu(pid, dispatchId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['qe-inbox', pid] });
      void qc.invalidateQueries({ queryKey: ['dispatches', pid] });
      void qc.invalidateQueries({ queryKey: ['pours', pid] });
    },
  });
};
