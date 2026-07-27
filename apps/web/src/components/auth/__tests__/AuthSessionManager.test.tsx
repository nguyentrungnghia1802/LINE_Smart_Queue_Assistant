import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@line-queue/shared';

import { AUTH_ACTIVITY_STORAGE_KEY, AUTH_REFRESH_STORAGE_KEY } from '../../../store/authSession';
import { useAuthStore } from '../../../store/authStore';
import { AuthSessionManager } from '../AuthSessionManager';

const now = new Date('2026-07-28T00:00:00.000Z').getTime();
const businessSession = {
  kind: 'business' as const,
  idleTimeoutSeconds: 900,
  absoluteExpiresAt: '2026-07-28T12:00:00.000Z',
};

describe('AuthSessionManager', () => {
  const initialize = vi.fn().mockResolvedValue(undefined);
  const refresh = vi.fn().mockResolvedValue(undefined);
  const logout = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    localStorage.clear();
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { id: 'staff-1', role: UserRole.STAFF },
      token: 'access-token',
      session: businessSession,
      isAuthenticated: true,
      isInitialized: true,
      initialize,
      refresh,
      logout,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps an actively used business session refreshed', async () => {
    localStorage.setItem(AUTH_ACTIVITY_STORAGE_KEY, String(now));
    localStorage.setItem(AUTH_REFRESH_STORAGE_KEY, String(now - 6 * 60_000));
    render(
      <AuthSessionManager>
        <div>workspace</div>
      </AuthSessionManager>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(screen.getByText('workspace')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(logout).not.toHaveBeenCalled();
  });

  it('ends a business session after fifteen minutes without activity', async () => {
    localStorage.setItem(AUTH_ACTIVITY_STORAGE_KEY, String(now - 15 * 60_000));
    localStorage.setItem(AUTH_REFRESH_STORAGE_KEY, String(now - 6 * 60_000));
    render(
      <AuthSessionManager>
        <div>workspace</div>
      </AuthSessionManager>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(logout).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not apply the business idle timer to customer sessions', async () => {
    useAuthStore.setState({
      user: { id: 'customer-1', role: UserRole.CUSTOMER },
      session: { ...businessSession, kind: 'customer', idleTimeoutSeconds: 2_592_000 },
    });
    localStorage.setItem(AUTH_ACTIVITY_STORAGE_KEY, String(now - 60 * 60_000));
    render(
      <AuthSessionManager>
        <div>customer</div>
      </AuthSessionManager>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(logout).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
