import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryClient } from '../../services/queryClient';
import {
  AUTH_ACTIVITY_STORAGE_KEY,
  AUTH_REFRESH_STORAGE_KEY,
  AUTH_SESSION_NOTICE_STORAGE_KEY,
  buildLoginRedirectPath,
  consumeAuthSessionNotice,
  establishAuthSession,
  getAuthToken,
  refreshAuthSession,
  registerAuthTerminationListener,
  terminateAuthSession,
} from '../authSession';

const { authPost } = vi.hoisted(() => ({ authPost: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    create: () => ({ post: authPost }),
  },
}));

const refreshedSession = {
  token: 'refreshed-token',
  user: { id: 'staff-1', role: 'staff' },
  session: {
    kind: 'business' as const,
    idleTimeoutSeconds: 900,
    absoluteExpiresAt: '2030-01-01T00:00:00.000Z',
  },
};

describe('authSession lifecycle', () => {
  beforeEach(() => {
    authPost.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/login');
    establishAuthSession('initial-token');
    queryClient.clear();
  });

  it('shares one refresh request across concurrent callers', async () => {
    let resolveRefresh!: (value: unknown) => void;
    authPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      })
    );

    const first = refreshAuthSession();
    const second = refreshAuthSession();

    expect(authPost).toHaveBeenCalledTimes(1);
    resolveRefresh({ data: { success: true, data: refreshedSession } });

    await expect(Promise.all([first, second])).resolves.toEqual([
      refreshedSession,
      refreshedSession,
    ]);
    expect(getAuthToken()).toBe('refreshed-token');
    expect(Number(localStorage.getItem(AUTH_REFRESH_STORAGE_KEY))).toBeGreaterThan(0);
  });

  it('clears token, auth storage, private cache, and listeners only once', async () => {
    const listener = vi.fn();
    const unregister = registerAuthTerminationListener(listener);
    localStorage.setItem(AUTH_ACTIVITY_STORAGE_KEY, '123');
    localStorage.setItem(AUTH_REFRESH_STORAGE_KEY, '456');
    queryClient.setQueryData(['private-user'], { id: 'staff-1' });

    const first = terminateAuthSession();
    const second = terminateAuthSession();
    await Promise.all([first, second]);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getAuthToken()).toBeNull();
    expect(localStorage.getItem(AUTH_ACTIVITY_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_REFRESH_STORAGE_KEY)).toBeNull();
    expect(queryClient.getQueryData(['private-user'])).toBeUndefined();
    expect(sessionStorage.getItem(AUTH_SESSION_NOTICE_STORAGE_KEY)).toBe('AUTH_SESSION_EXPIRED');

    unregister();
  });

  it('consumes the session-expired notice once', async () => {
    await terminateAuthSession();

    expect(consumeAuthSessionNotice()).toBe('AUTH_SESSION_EXPIRED');
    expect(consumeAuthSessionNotice()).toBeNull();
  });

  it('preserves only an internal LIFF route when redirecting to login', () => {
    expect(
      buildLoginRedirectPath({
        pathname: '/liff/qr/demo-123',
        search: '?q=id-1',
        hash: '',
      })
    ).toBe('/login?returnTo=%2Fliff%2Fqr%2Fdemo-123%3Fq%3Did-1');

    expect(buildLoginRedirectPath({ pathname: '/staff', search: '?tab=queue', hash: '' })).toBe(
      '/login'
    );
  });
});
