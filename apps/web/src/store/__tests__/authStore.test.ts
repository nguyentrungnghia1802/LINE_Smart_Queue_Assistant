import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@line-queue/shared';

import { post } from '../../services/apiClient';
import { refreshAuthSession, revokeAuthSession, setAuthToken } from '../authSession';
import { useAuthStore } from '../authStore';

vi.mock('../../services/apiClient', () => ({
  post: vi.fn(),
}));
vi.mock('../authSession', () => ({
  clearAuthSession: vi.fn(),
  clearLegacyAuthStorage: vi.fn(),
  refreshAuthSession: vi.fn(),
  registerAuthRefreshListener: vi.fn(),
  revokeAuthSession: vi.fn().mockResolvedValue(undefined),
  setAuthToken: vi.fn(),
}));

const businessSession = {
  kind: 'business' as const,
  idleTimeoutSeconds: 900,
  absoluteExpiresAt: '2030-01-01T00:00:00.000Z',
};

describe('authStore API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      token: null,
      session: null,
      isAuthenticated: false,
      isInitialized: true,
    });
  });

  it('logs in with the backend /api/v1 route', async () => {
    vi.mocked(post).mockResolvedValue({
      token: 'jwt-token',
      user: { id: 'user-1', role: UserRole.STAFF },
      session: businessSession,
    });

    await useAuthStore.getState().login('staff@example.com', 'password');

    expect(setAuthToken).toHaveBeenCalledWith('jwt-token');
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(post).toHaveBeenCalledWith(
      '/api/v1/auth/login',
      {
        email: 'staff@example.com',
        password: 'password',
      },
      { headers: { 'X-Skip-Auth-Redirect': 'true' } }
    );
  });

  it('logs in with LINE using the backend /api/v1 route', async () => {
    vi.mocked(post).mockResolvedValue({
      token: 'jwt-token',
      user: { id: 'user-1', role: UserRole.CUSTOMER },
      session: { ...businessSession, kind: 'customer' },
    });

    await useAuthStore.getState().loginWithLine('line-id-token');

    expect(setAuthToken).toHaveBeenCalledWith('jwt-token');
    expect(post).toHaveBeenCalledWith(
      '/api/v1/auth/line',
      { idToken: 'line-id-token' },
      { headers: { 'X-Skip-Auth-Redirect': 'true' } }
    );
  });

  it('clears token and persisted auth data on logout', async () => {
    vi.mocked(post).mockResolvedValue({
      token: 'jwt-token',
      user: { id: 'user-1', role: UserRole.ADMIN },
      session: businessSession,
    });

    await useAuthStore.getState().login('admin@gmail.com', 'password');
    await useAuthStore.getState().logout();

    expect(revokeAuthSession).toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('restores a valid server session during application initialization', async () => {
    vi.mocked(refreshAuthSession).mockResolvedValue({
      token: 'refreshed-token',
      user: { id: 'user-1', role: UserRole.MANAGER },
      session: businessSession,
    });
    useAuthStore.setState({ isInitialized: false });

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState()).toMatchObject({
      token: 'refreshed-token',
      isAuthenticated: true,
      isInitialized: true,
    });
  });
});
