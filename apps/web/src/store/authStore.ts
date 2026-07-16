import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { SupportedLocale, UserRole } from '@line-queue/shared';

import { post } from '../services/apiClient';

export interface AuthUser {
  id: string;
  email?: string;
  displayName?: string;
  role: UserRole;
  organizationId?: string;
  preferredLocale?: SupportedLocale | null;
  organizationLocale?: SupportedLocale;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithLine: (idToken: string) => Promise<void>;
  logout: () => void;
  setUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const { token, user } = await post<{ token: string; user: AuthUser }>(
          '/api/v1/auth/login',
          {
            email,
            password,
          }
        );
        localStorage.setItem('auth_token', token);
        set({ user, token, isAuthenticated: true });
      },

      loginWithLine: async (idToken: string) => {
        const { token, user } = await post<{ token: string; user: AuthUser }>(
          '/api/v1/auth/line',
          { idToken },
          { headers: { 'X-Skip-Auth-Redirect': 'true' } }
        );
        localStorage.setItem('auth_token', token);
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem('auth_token');
        set({ user: null, token: null, isAuthenticated: false });
      },

      setUser: (user) => set({ user, isAuthenticated: true }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
