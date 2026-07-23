import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@line-queue/shared';

import { post } from '../../services/apiClient';
import { useAuthStore } from '../authStore';

vi.mock('../../services/apiClient', () => ({
  post: vi.fn(),
}));

describe('authStore API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
  });

  it('logs in with the backend /api/v1 route', async () => {
    vi.mocked(post).mockResolvedValue({
      token: 'jwt-token',
      user: { id: 'user-1', role: UserRole.STAFF },
    });

    await useAuthStore.getState().login('staff@example.com', 'password');

    expect(post).toHaveBeenCalledWith('/api/v1/auth/login', {
      email: 'staff@example.com',
      password: 'password',
    });
  });

  it('logs in with LINE using the backend /api/v1 route', async () => {
    vi.mocked(post).mockResolvedValue({
      token: 'jwt-token',
      user: { id: 'user-1', role: UserRole.CUSTOMER },
    });

    await useAuthStore.getState().loginWithLine('line-id-token');

    expect(post).toHaveBeenCalledWith(
      '/api/v1/auth/line',
      { idToken: 'line-id-token' },
      { headers: { 'X-Skip-Auth-Redirect': 'true' } }
    );
  });
});
