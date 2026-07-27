import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { SupportedLocale, UserRole } from '@line-queue/shared';

import { post } from '../services/apiClient';

import { clearAuthSession, getAuthToken, setAuthToken } from './authSession';

export interface AuthUser {
  id: string;
  email?: string;
  displayName?: string;
  role: UserRole;
  organizationId?: string;
  preferredLocale?: SupportedLocale | null;
  organizationLocale?: SupportedLocale;
  isOrganizationOwner?: boolean;
  branchIds?: string[];
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
          },
          { headers: { 'X-Skip-Auth-Redirect': 'true' } }
        );
        setAuthToken(token);
        set({ user, token, isAuthenticated: true });
      },

      loginWithLine: async (idToken: string) => {
        const { token, user } = await post<{ token: string; user: AuthUser }>(
          '/api/v1/auth/line',
          { idToken },
          { headers: { 'X-Skip-Auth-Redirect': 'true' } }
        );
        setAuthToken(token);
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        clearAuthSession();
        set({ user: null, token: null, isAuthenticated: false });
      },

      setUser: (user) => set({ user, isAuthenticated: true }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
      merge: (persisted, current) => {
        const token = getAuthToken();
        const user = (persisted as Partial<AuthState> | undefined)?.user ?? null;
        return {
          ...current,
          user: token ? user : null,
          token,
          isAuthenticated: Boolean(token && user),
        };
      },
    }
  )
);
