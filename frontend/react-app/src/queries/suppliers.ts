import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { suppliersApi } from '../api/suppliers';
import type { SupplierCreate } from '../types/master';

export const supplierKeys = { list: (pid: number) => ['suppliers', pid] as const };

export const useSuppliers = (pid: number) =>
  useQuery({ queryKey: supplierKeys.list(pid), queryFn: () => suppliersApi.list(pid) });

export const useCreateSupplier = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SupplierCreate) => suppliersApi.create(pid, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: supplierKeys.list(pid) }),
  });
};

export const useResendSupplierConfirmation = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (supplierId: number) => suppliersApi.resendConfirmation(pid, supplierId),
    onSuccess: () => qc.invalidateQueries({ queryKey: supplierKeys.list(pid) }),
  });
};
