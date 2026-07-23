import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';

import type { ApiErrorResponse, ApiResponse } from '@line-queue/shared';

import { i18n } from '../i18n';

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    readonly status?: number,
    readonly details?: unknown,
    message?: string
  ) {
    super(message && message.trim().length > 0 ? message : translateErrorCode(code));
    this.name = 'ApiClientError';
  }
}

// ── Singleton Axios instance ───────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ── Request interceptor — attach auth token ────────────────────────────────────

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  config.headers['Accept-Language'] = i18n.resolvedLanguage ?? 'ja';
  return config;
});

// ── Response interceptor — unwrap envelope / normalise errors ──────────────────

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<never> | ApiErrorResponse>) => {
    const skipAuthRedirect = error.config?.headers?.['X-Skip-Auth-Redirect'] === 'true';
    if (error.response?.status === 401 && !skipAuthRedirect) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    const payload = error.response?.data;
    if (payload && !payload.success) {
      return Promise.reject(
        new ApiClientError(
          payload.error.code,
          error.response?.status,
          payload.error.details,
          payload.error.message
        )
      );
    }
    return Promise.reject(error);
  }
);

// ── Typed request helpers ──────────────────────────────────────────────────────

function unwrap<T>(envelope: ApiResponse<T> | ApiErrorResponse): T {
  if (!envelope.success)
    throw new ApiClientError(
      envelope.error.code,
      undefined,
      envelope.error.details,
      envelope.error.message
    );
  return envelope.data;
}

export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.get<ApiResponse<T>>(url, config);
  return unwrap(res.data);
}

export async function post<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await apiClient.post<ApiResponse<T>>(url, data, config);
  return unwrap(res.data);
}

export async function patch<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await apiClient.patch<ApiResponse<T>>(url, data, config);
  return unwrap(res.data);
}

export async function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.put<ApiResponse<T>>(url, data, config);
  return unwrap(res.data);
}

export async function del<T = void>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.delete<ApiResponse<T>>(url, config);
  return unwrap(res.data);
}

export { apiClient };

function translateErrorCode(code: string): string {
  const key = `errors.${code}`;
  return i18n.exists(key, { ns: 'common' })
    ? i18n.t(key, { ns: 'common' })
    : i18n.t('errors.UNKNOWN', { ns: 'common' });
}
