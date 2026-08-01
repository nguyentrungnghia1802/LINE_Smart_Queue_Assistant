import { create } from 'zustand';

import { post } from '../services/apiClient';

import {
  clearAuthSession,
  clearLegacyAuthStorage,
  establishAuthSession,
  refreshAuthSession,
  registerAuthRefreshListener,
  registerAuthTerminationListener,
  revokeAuthSession,
} from './authSession';
import type { AuthenticationResponse, AuthSessionMetadata, AuthUser } from './authTypes';

export type { AuthUser } from './authTypes';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  session: AuthSessionMetadata | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithLine: (idToken: string) => Promise<void>;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

let initializePromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  session: null,
  isAuthenticated: false,
  isInitialized: false,

  login: async (email, password) => {
    const result = await post<AuthenticationResponse>(
      '/api/v1/auth/login',
      {
        email,
        password,
      },
      { headers: { 'X-Skip-Auth-Redirect': 'true' } }
    );
    establishAuthSession(result.token);
    set({ ...result, isAuthenticated: true, isInitialized: true });
  },

  loginWithLine: async (idToken: string) => {
    const result = await post<AuthenticationResponse>(
      '/api/v1/auth/line',
      { idToken },
      { headers: { 'X-Skip-Auth-Redirect': 'true' } }
    );
    establishAuthSession(result.token);
    set({ ...result, isAuthenticated: true, isInitialized: true });
  },

  initialize: async () => {
    if (!initializePromise) {
      clearLegacyAuthStorage();
      initializePromise = refreshAuthSession()
        .then((result) => {
          set({ ...result, isAuthenticated: true, isInitialized: true });
        })
        .catch(() => {
          clearAuthSession();
          set({
            user: null,
            token: null,
            session: null,
            isAuthenticated: false,
            isInitialized: true,
          });
        })
        .finally(() => {
          initializePromise = null;
        });
    }
    return initializePromise;
  },

  refresh: async () => {
    const result = await refreshAuthSession();
    set({ ...result, isAuthenticated: true, isInitialized: true });
  },

  logout: async () => {
    await revokeAuthSession();
  },

  setUser: (user) => set({ user, isAuthenticated: true }),
}));

registerAuthRefreshListener((result) => {
  useAuthStore.setState({ ...result, isAuthenticated: true, isInitialized: true });
});

registerAuthTerminationListener(() => {
  useAuthStore.setState({
    user: null,
    token: null,
    session: null,
    isAuthenticated: false,
    isInitialized: true,
  });
});
