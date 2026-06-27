import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api/projects';
import type { ProjectContractorCreate } from '../types/master';

export const contractorKeys = { list: (pid: number) => ['contractors', pid] as const };

export const useProjectContractors = (pid: number, enabled = true) =>
  useQuery({
    queryKey: contractorKeys.list(pid),
    queryFn: () => projectsApi.contractors(pid),
    enabled,
  });

export const useAddContractor = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectContractorCreate) => projectsApi.addContractor(pid, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: contractorKeys.list(pid) }),
  });
};
