// Reference catalogs API — global grade + component lists.
// See backend/app/routers/catalog.py.

import { api } from './client';
import type { ComponentResponse, GradeResponse } from '../types/master';

export const catalogApi = {
  grades(): Promise<GradeResponse[]> {
    return api.get<GradeResponse[]>('/grades').then((r) => r.data);
  },
  components(): Promise<ComponentResponse[]> {
    return api.get<ComponentResponse[]>('/components').then((r) => r.data);
  },
};
