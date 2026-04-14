import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { User } from '@line-queue/shared';

import { post } from '../services/apiClient';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email, password) => {
        // TODO: replace with real auth endpoint once JWT auth middleware is built
        const { token, user } = await post<{ token: string; user: User }>('/api/v1/auth/login', {
          email,
          password,
        });
        localStorage.setItem('auth_token', token);
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem('auth_token');
        set({ user: null, token: null, isAuthenticated: false });
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
      // Only persist user identity — never persist raw password/token in localStorage
      // beyond what is explicitly set above via localStorage.setItem.
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
