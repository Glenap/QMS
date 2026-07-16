import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api/projects';
import type { ProjectCreate, ProjectStatus } from '../types/master';

export const projectKeys = {
  list: () => ['projects'] as const,
  assigned: () => ['assigned-projects'] as const,
  detail: (id: number) => ['project', id] as const,
};

export const useProjects = () =>
  useQuery({ queryKey: projectKeys.list(), queryFn: () => projectsApi.list() });

export const useCreateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectCreate) => projectsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.list() }),
  });
};

export const useProjectDetail = (id: number, enabled = true) =>
  useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => projectsApi.detail(id),
    enabled: enabled && !Number.isNaN(id),
  });

export const useUpdateProjectStatus = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: ProjectStatus) => projectsApi.updateStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: projectKeys.list() });
      // Completing a project frees its members — refresh the roster.
      void qc.invalidateQueries({ queryKey: ['org-team'] });
    },
  });
};

export const useAssignedProjects = () =>
  useQuery({ queryKey: projectKeys.assigned(), queryFn: () => projectsApi.assigned() });

export const useRespondToAssignment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { pcId: number; accept: boolean }) =>
      vars.accept ? projectsApi.acceptAssigned(vars.pcId) : projectsApi.declineAssigned(vars.pcId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.assigned() });
      void qc.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
};
