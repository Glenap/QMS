import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api/projects';
import { authApi } from '../api/auth';
import type { ProjectMemberCreate } from '../types/master';

export const memberKeys = { list: (pid: number) => ['members', pid] as const };

export const useProjectMembers = (pid: number) =>
  useQuery({ queryKey: memberKeys.list(pid), queryFn: () => projectsApi.members(pid) });

export const useAssignMember = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectMemberCreate) => projectsApi.assignMember(pid, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: memberKeys.list(pid) }),
  });
};

export const useSetMemberActive = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: number; active: boolean }) =>
      vars.active ? authApi.reactivateUser(vars.userId) : authApi.deactivateUser(vars.userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: memberKeys.list(pid) }),
  });
};
