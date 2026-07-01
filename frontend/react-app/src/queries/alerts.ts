import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '../api/alerts';
import { suppliersApi } from '../api/suppliers';
import type { RmcNotify } from '../types/master';

export const alertKeys = {
  list: (pid: number) => ['alerts', pid] as const,
  count: (pid: number) => ['alerts', pid, 'count'] as const,
};

// Polled so the bell + feed stay live for the QE + PM.
export const useAlerts = (pid: number, enabled = true) =>
  useQuery({ queryKey: alertKeys.list(pid), queryFn: () => alertsApi.list(pid), enabled, refetchInterval: 30_000 });

export const useAlertCount = (pid: number, enabled = true) =>
  useQuery({ queryKey: alertKeys.count(pid), queryFn: () => alertsApi.count(pid), enabled, refetchInterval: 30_000 });

export const useAcknowledgeAlert = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: number) => alertsApi.acknowledge(pid, alertId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts', pid] }),
  });
};

export const useNotifyRmc = (pid: number) =>
  useMutation({
    mutationFn: (vars: { supplierId: number; data: RmcNotify }) =>
      suppliersApi.notify(pid, vars.supplierId, vars.data),
  });
