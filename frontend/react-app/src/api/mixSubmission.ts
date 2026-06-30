// Public RMC mix-design submission API — no auth, token in query string.
// See backend/app/routers/mix_submission.py.
//
// Uses a bare axios instance: this runs on the public /external/mix-design page
// where there is no logged-in user, so the auth interceptors must be skipped
// (mirrors api/dispatchFill.ts).

import axios from 'axios';
import type {
  MixDesignResponse,
  MixDesignSubmit,
  MixSubmissionView,
} from '../types/master';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const publicApi = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });

export const mixSubmissionApi = {
  view(token: string): Promise<MixSubmissionView> {
    return publicApi
      .get<MixSubmissionView>('/external/mix-design', { params: { token } })
      .then((r) => r.data);
  },
  submit(token: string, data: MixDesignSubmit): Promise<MixDesignResponse> {
    return publicApi
      .post<MixDesignResponse>('/external/mix-design', data, { params: { token } })
      .then((r) => r.data);
  },
};
