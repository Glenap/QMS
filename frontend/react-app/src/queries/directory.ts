import { useQuery } from '@tanstack/react-query';
import { directoryApi } from '../api/directory';

// Org-wide RMC + lab directories (independent of any one project).
export const useOrgSuppliers = () =>
  useQuery({ queryKey: ['directory-suppliers'], queryFn: () => directoryApi.suppliers() });

export const useOrgLabs = () =>
  useQuery({ queryKey: ['directory-labs'], queryFn: () => directoryApi.labs() });
