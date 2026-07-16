import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api/projects';
import { authApi } from '../api/auth';
import type { ProjectMemberCreate } from '../types/master';
import type { InviteRequest } from '../types/auth';

export const memberKeys = { list: (pid: number) => ['members', pid] as const };
export const orgTeamKey = ['org-team'] as const;

// ── Org team (build the roster; independent of any project) ──────────────────

export const useOrgTeam = () =>
  useQuery({ queryKey: orgTeamKey, queryFn: () => authApi.team() });

export const useInviteMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InviteRequest) => authApi.invite(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgTeamKey }),
  });
};

export const useSetOrgMemberActive = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: number; active: boolean }) =>
      vars.active ? authApi.reactivateUser(vars.userId) : authApi.deactivateUser(vars.userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgTeamKey }),
  });
};

// ── Project members (assign an existing team member a designation) ───────────

export const useProjectMembers = (pid: number) =>
  useQuery({ queryKey: memberKeys.list(pid), queryFn: () => projectsApi.members(pid) });

export const useAssignMember = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectMemberCreate) => projectsApi.assignMember(pid, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: memberKeys.list(pid) });
      // Assigning consumes availability — refresh the org roster too.
      qc.invalidateQueries({ queryKey: orgTeamKey });
    },
  });
};

export const useSetMemberActive = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: number; active: boolean }) =>
      vars.active ? authApi.reactivateUser(vars.userId) : authApi.deactivateUser(vars.userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: memberKeys.list(pid) });
      qc.invalidateQueries({ queryKey: orgTeamKey });
    },
  });
};
