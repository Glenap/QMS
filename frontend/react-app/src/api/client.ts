// Single axios instance shared by every API module.
//
// Responsibilities:
//   - baseURL from VITE_API_BASE_URL (dev: "/api/v1" proxied to :8000)
//   - attach "Authorization: Bearer <access>" on each request
//   - on 401, try the refresh endpoint once, then replay the request
//   - if refresh fails, clear the session and notify the app (auth:logout)

import axios from 'axios';
import type { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from './tokenStorage';
import type { AccessTokenResponse } from '../types/auth';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

// Dispatched when refresh fails — AuthContext listens and forces logout.
export const AUTH_LOGOUT_EVENT = 'auth:logout';

function emitForcedLogout(): void {
  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
}

// ── Request: attach bearer token ──────────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // For multipart uploads, drop the instance's default application/json so the
  // browser sets multipart/form-data WITH its boundary. Without this the server
  // can't parse the body and reports the file field as required (422).
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  }
  return config;
});

// ── Response: refresh-on-401, single-flight ───────────────────────────────
type RetriableConfig = AxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) return null;
  try {
    // Bare axios (not `api`) so this request skips the interceptors.
    const res = await axios.post<AccessTokenResponse>(
      `${baseURL}/auth/refresh`,
      { refresh_token: refresh },
      { headers: { 'Content-Type': 'application/json' } },
    );
    tokenStorage.setAccess(res.data.access_token);
    return res.data.access_token;
  } catch {
    return null;
  }
}

// A 403 that means "this session is over", as opposed to "you may not do that".
// The backend has no machine-readable error code, so these mirror the exact
// `detail` strings of AccountDeactivatedError / InactiveUserError
// (backend/app/core/exceptions.py). Matched exactly on purpose: ordinary
// PermissionDeniedError 403s also contain the word "deactivate" (e.g. "You
// cannot deactivate your own account"), and a substring match would sign an
// admin out for clicking the wrong button.
const SESSION_ENDING_403 = new Set([
  'Your account has been deactivated. Please contact your administrator.',
  'User account is inactive',
]);

function isDeactivatedResponse(error: AxiosError): boolean {
  const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
  return typeof detail === 'string' && SESSION_ENDING_403.has(detail);
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = original?.url ?? '';

    // Don't try to refresh for the auth endpoints themselves.
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/refresh');

    if (status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      // Single-flight: concurrent 401s share one refresh request.
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      // Refresh failed → force logout.
      tokenStorage.clear();
      emitForcedLogout();
    } else if (status === 401 && original?._retry && !isAuthCall) {
      // Refresh succeeded but the replayed request still 401'd — the new token
      // is no good either. Without this the user stays "logged in" while every
      // request fails.
      tokenStorage.clear();
      emitForcedLogout();
    } else if (status === 403 && isDeactivatedResponse(error)) {
      // Deactivation/inactivity is a 403, not a 401, so the refresh branch above
      // never sees it. An offboarded user would otherwise keep a valid-looking
      // session showing errors on every page instead of being signed out.
      tokenStorage.clear();
      emitForcedLogout();
    }

    return Promise.reject(error);
  },
);

// Normalises a FastAPI error into a human-readable string.
// FastAPI returns { detail: string } or { detail: [{ msg, loc }, ...] } (422).
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { detail?: unknown } | undefined;
    const detail = data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((d: { msg?: string }) => d.msg)
        .filter(Boolean)
        .join(', ');
    }
    if (error.message) return error.message;
  }
  return fallback;
}
