// React Query hooks for the cube-tests feature. Reads: the project's cube samples
// plus the pours + labs the cast form needs. Mutations invalidate the affected
// keys — recording a test also invalidates the NCR list, because a failing result
// auto-raises an NCR server-side.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cubeTestsApi } from '../../api/cubeTests';
import { ncrKeys } from '../ncr/queries';
import type { CubeSampleCreate, CubeTestCreate } from '../../types/master';

// Shared resource hooks (pours/labs) live in src/queries and are re-exported here
// for the cast form's dropdowns.
export { usePours } from '../../queries/pours';
export { useLabs } from '../../queries/labs';

export const cubeKeys = {
  samples: (pid: number) => ['cube-samples', pid] as const,
};

export const useCubeSamples = (pid: number) =>
  useQuery({ queryKey: cubeKeys.samples(pid), queryFn: () => cubeTestsApi.listSamples(pid) });

export const useCastSample = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { pourId: number; data: CubeSampleCreate }) =>
      cubeTestsApi.castSample(pid, vars.pourId, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: cubeKeys.samples(pid) }),
  });
};

export const useRecordTest = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { sampleId: number; data: CubeTestCreate }) =>
      cubeTestsApi.recordTest(pid, vars.sampleId, vars.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: cubeKeys.samples(pid) });
      void qc.invalidateQueries({ queryKey: ncrKeys.list(pid) });
    },
  });
};
