export const AUTH_TOKEN_STORAGE_KEY = 'auth_token';
export const AUTH_STORE_STORAGE_KEY = 'auth-storage';

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_STORE_STORAGE_KEY);
}
