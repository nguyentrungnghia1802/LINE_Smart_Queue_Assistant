import axios from 'axios';

import type { ApiResponse } from '@line-queue/shared';

import { queryClient } from '../services/queryClient';

import type { AuthenticationResponse } from './authTypes';

export const LEGACY_AUTH_TOKEN_STORAGE_KEY = 'auth_token';
export const LEGACY_AUTH_STORE_STORAGE_KEY = 'auth-storage';
export const AUTH_ACTIVITY_STORAGE_KEY = 'auth_last_activity_at';
export const AUTH_REFRESH_STORAGE_KEY = 'auth_last_refresh_at';
export const AUTH_SESSION_NOTICE_STORAGE_KEY = 'auth_session_notice';

export type AuthSessionNoticeCode = 'AUTH_SESSION_EXPIRED';

let accessToken: string | null = null;
let refreshPromise: Promise<AuthenticationResponse> | null = null;
let refreshListener: ((result: AuthenticationResponse) => void) | null = null;
let sessionTerminated = false;
let terminationPromise: Promise<void> | null = null;
const terminationListeners = new Set<() => void>();

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

export function establishAuthSession(token: string): void {
  sessionTerminated = false;
  terminationPromise = null;
  sessionStorage.removeItem(AUTH_SESSION_NOTICE_STORAGE_KEY);
  setAuthToken(token);
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

export function registerAuthTerminationListener(listener: () => void): () => void {
  terminationListeners.add(listener);
  return () => terminationListeners.delete(listener);
}

export function isAuthSessionTerminated(): boolean {
  return sessionTerminated;
}

export function consumeAuthSessionNotice(): AuthSessionNoticeCode | null {
  const notice = sessionStorage.getItem(AUTH_SESSION_NOTICE_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_SESSION_NOTICE_STORAGE_KEY);
  return notice === 'AUTH_SESSION_EXPIRED' ? notice : null;
}

export async function refreshAuthSession(): Promise<AuthenticationResponse> {
  if (!refreshPromise) {
    refreshPromise = authTransport
      .post<ApiResponse<AuthenticationResponse>>('/api/v1/auth/refresh')
      .then((response) => {
        if (!response.data.success) throw new Error(response.data.error.code);
        if (sessionTerminated) throw new Error('Authentication session has already ended');
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

export function terminateAuthSession(
  options: { revokeServerSession?: boolean } = {}
): Promise<void> {
  if (sessionTerminated) return terminationPromise ?? Promise.resolve();

  sessionTerminated = true;
  clearClientAuthenticationState();
  sessionStorage.setItem(AUTH_SESSION_NOTICE_STORAGE_KEY, 'AUTH_SESSION_EXPIRED');

  terminationPromise = options.revokeServerSession
    ? authTransport.post('/api/v1/auth/logout').then(
        () => undefined,
        () => undefined
      )
    : Promise.resolve();

  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }

  return terminationPromise;
}

export async function revokeAuthSession(): Promise<void> {
  sessionTerminated = true;
  clearClientAuthenticationState();
  try {
    await authTransport.post('/api/v1/auth/logout');
  } catch {
    // Local logout must complete even when the API is unavailable.
  }
}

function clearClientAuthenticationState(): void {
  clearAuthSession();
  queryClient.clear();
  for (const listener of terminationListeners) listener();
}
