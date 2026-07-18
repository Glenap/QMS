import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { conformanceApi } from '../api/conformance';
import type { ConformanceFindingUpsert } from '../types/conformance';

export const conformanceKeys = {
  findings: (pid: number) => ['conformance-findings', pid] as const,
};

export const useConformanceFindings = (pid: number) =>
  useQuery({
    queryKey: conformanceKeys.findings(pid),
    queryFn: () => conformanceApi.listFindings(pid),
  });

export const useUpsertFinding = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ConformanceFindingUpsert) => conformanceApi.upsertFinding(pid, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: conformanceKeys.findings(pid) }),
  });
};

export const useDeleteFinding = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (findingId: number) => conformanceApi.deleteFinding(pid, findingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: conformanceKeys.findings(pid) }),
  });
};
