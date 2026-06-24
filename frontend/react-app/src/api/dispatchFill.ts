// Public truck-fill API — no auth, token in query string.
// See backend/app/routers/dispatch_token.py.
//
// Uses a bare axios instance: this runs on the public /dispatch/fill page where
// there is no logged-in user, so the auth interceptors must be skipped (mirrors
// api/confirmations.ts).

import axios from 'axios';
import type {
  TruckActionResult,
  TruckFillSubmit,
  TruckFillView,
} from '../types/master';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const publicApi = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });

export const dispatchFillApi = {
  view(token: string): Promise<TruckFillView> {
    return publicApi
      .get<TruckFillView>('/external/dispatch', { params: { token } })
      .then((r) => r.data);
  },
  submit(token: string, data: TruckFillSubmit): Promise<TruckActionResult> {
    return publicApi
      .post<TruckActionResult>('/external/dispatch', data, { params: { token } })
      .then((r) => r.data);
  },
};
