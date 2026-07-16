// Directory API — org-wide, cross-project RMC + lab roll-ups.
// See backend/app/routers/directory.py.

import { api } from './client';
import type { LabDirectoryItem, SupplierDirectoryItem } from '../types/master';

export const directoryApi = {
  suppliers(): Promise<SupplierDirectoryItem[]> {
    return api.get<SupplierDirectoryItem[]>('/directory/suppliers').then((r) => r.data);
  },
  labs(): Promise<LabDirectoryItem[]> {
    return api.get<LabDirectoryItem[]>('/directory/labs').then((r) => r.data);
  },
};
