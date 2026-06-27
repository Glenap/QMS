import { useQuery } from '@tanstack/react-query';
import { poursApi } from '../api/pours';

export const pourKeys = { list: (pid: number) => ['pours', pid] as const };

export const usePours = (pid: number) =>
  useQuery({ queryKey: pourKeys.list(pid), queryFn: () => poursApi.list(pid) });
