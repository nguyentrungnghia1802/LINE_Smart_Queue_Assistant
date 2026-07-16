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
  (error: AxiosError<ApiResponse<never> | ApiErrorResponse>) => {
    const skipAuthRedirect = error.config?.headers?.['X-Skip-Auth-Redirect'] === 'true';
    if (error.response?.status === 401 && !skipAuthRedirect) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    const payload = error.response?.data;
    if (payload && !payload.success) {
      return Promise.reject(
        new Error(toVisibleJapaneseError(payload.error.message, error.response?.status))
      );
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

export async function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.put<ApiResponse<T>>(url, data, config);
  return unwrap(res.data);
}

export async function del<T = void>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.delete<ApiResponse<T>>(url, config);
  return unwrap(res.data);
}

export { apiClient };

function toVisibleJapaneseError(message: string, status?: number): string {
  if (/[\u3040-\u30ff\u3400-\u9fff]/u.test(message)) return message;
  if (status === 401) return '認証が必要です。もう一度ログインしてください。';
  if (status === 403) return 'この操作を行う権限がありません。';
  if (status === 404) return '指定された情報が見つかりません。';
  if (status === 409) return '現在の状態ではこの操作を完了できません。';
  if (status === 422) return '入力内容を確認してください。';
  if (status === 429) return '操作が多すぎます。しばらくしてからお試しください。';
  return '処理中にエラーが発生しました。もう一度お試しください。';
}
