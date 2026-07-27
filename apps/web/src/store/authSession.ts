import axios from 'axios';

import type { ApiResponse } from '@line-queue/shared';

import type { AuthenticationResponse } from './authTypes';

export const LEGACY_AUTH_TOKEN_STORAGE_KEY = 'auth_token';
export const LEGACY_AUTH_STORE_STORAGE_KEY = 'auth-storage';
export const AUTH_ACTIVITY_STORAGE_KEY = 'auth_last_activity_at';
export const AUTH_REFRESH_STORAGE_KEY = 'auth_last_refresh_at';

let accessToken: string | null = null;
let refreshPromise: Promise<AuthenticationResponse> | null = null;
let refreshListener: ((result: AuthenticationResponse) => void) | null = null;

const authTransport = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 15_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export function getAuthToken(): string | null {
  return accessToken;
}

export function setAuthToken(token: string): void {
  accessToken = token;
}

export function clearAuthSession(): void {
  accessToken = null;
  localStorage.removeItem(LEGACY_AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(LEGACY_AUTH_STORE_STORAGE_KEY);
  localStorage.removeItem(AUTH_ACTIVITY_STORAGE_KEY);
  localStorage.removeItem(AUTH_REFRESH_STORAGE_KEY);
}

export function clearLegacyAuthStorage(): void {
  localStorage.removeItem(LEGACY_AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(LEGACY_AUTH_STORE_STORAGE_KEY);
}

export function registerAuthRefreshListener(
  listener: (result: AuthenticationResponse) => void
): void {
  refreshListener = listener;
}

export async function refreshAuthSession(): Promise<AuthenticationResponse> {
  if (!refreshPromise) {
    refreshPromise = authTransport
      .post<ApiResponse<AuthenticationResponse>>('/api/v1/auth/refresh')
      .then((response) => {
        if (!response.data.success) throw new Error(response.data.error.code);
        const result = response.data.data;
        setAuthToken(result.token);
        localStorage.setItem(AUTH_REFRESH_STORAGE_KEY, String(Date.now()));
        refreshListener?.(result);
        return result;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function revokeAuthSession(): Promise<void> {
  try {
    await authTransport.post('/api/v1/auth/logout');
  } finally {
    clearAuthSession();
  }
}
