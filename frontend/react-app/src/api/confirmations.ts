// Public supplier/lab confirmation handshake — no auth, token in query string.
// See backend/app/routers/confirmations.py.
//
// Uses a bare axios instance: these run on the public /external/confirm page
// where there is no logged-in user, so the auth interceptors must be skipped.

import axios from 'axios';
import type {
  ConfirmationResult,
  LabConfirmationView,
  LabConfirmSubmit,
  SupplierConfirmationView,
  SupplierConfirmSubmit,
} from '../types/master';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const publicApi = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });

export const confirmationsApi = {
  viewSupplier(token: string): Promise<SupplierConfirmationView> {
    return publicApi
      .get<SupplierConfirmationView>('/external/confirm/supplier', { params: { token } })
      .then((r) => r.data);
  },
  submitSupplier(token: string, data: SupplierConfirmSubmit): Promise<ConfirmationResult> {
    return publicApi
      .post<ConfirmationResult>('/external/confirm/supplier', data, { params: { token } })
      .then((r) => r.data);
  },
  viewLab(token: string): Promise<LabConfirmationView> {
    return publicApi
      .get<LabConfirmationView>('/external/confirm/lab', { params: { token } })
      .then((r) => r.data);
  },
  submitLab(token: string, data: LabConfirmSubmit): Promise<ConfirmationResult> {
    return publicApi
      .post<ConfirmationResult>('/external/confirm/lab', data, { params: { token } })
      .then((r) => r.data);
  },
};
