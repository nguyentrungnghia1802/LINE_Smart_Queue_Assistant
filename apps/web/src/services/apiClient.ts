import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';

import type { ApiErrorResponse, ApiResponse } from '@line-queue/shared';

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
  return config;
});

// ── Response interceptor — unwrap envelope / normalise errors ──────────────────

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<never>>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Typed request helpers ──────────────────────────────────────────────────────

function unwrap<T>(envelope: ApiResponse<T> | ApiErrorResponse): T {
  if (!envelope.success) throw new Error(envelope.error.message);
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

export async function del<T = void>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.delete<ApiResponse<T>>(url, config);
  return unwrap(res.data);
}

export { apiClient };
