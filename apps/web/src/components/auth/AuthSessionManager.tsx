import { type ReactNode, useEffect, useRef } from 'react';

import { UserRole } from '@line-queue/shared';

import {
  AUTH_ACTIVITY_STORAGE_KEY,
  AUTH_REFRESH_STORAGE_KEY,
  terminateAuthSession,
} from '../../store/authSession';
import { useAuthStore } from '../../store/authStore';
import { Spinner } from '../ui/Spinner';

const CHECK_INTERVAL_MS = 15_000;
const MIN_KEEP_ALIVE_MS = 30_000;
const MAX_KEEP_ALIVE_MS = 5 * 60_000;

function storedTimestamp(key: string, fallback: number): number {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function AuthSessionManager({ children }: { children: ReactNode }) {
  const initialized = useAuthStore((state) => state.isInitialized);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const session = useAuthStore((state) => state.session);
  const user = useAuthStore((state) => state.user);
  const initialize = useAuthStore((state) => state.initialize);
  const refresh = useAuthStore((state) => state.refresh);
  const refreshRunning = useRef(false);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !session ||
      !user ||
      user.role === UserRole.CUSTOMER ||
      session.kind !== 'business'
    ) {
      return;
    }

    const idleTimeoutMs = session.idleTimeoutSeconds * 1000;
    const keepAliveMs = Math.min(
      MAX_KEEP_ALIVE_MS,
      Math.max(MIN_KEEP_ALIVE_MS, Math.floor(idleTimeoutMs / 3))
    );
    const markActivity = () => {
      localStorage.setItem(AUTH_ACTIVITY_STORAGE_KEY, String(Date.now()));
    };
    if (!localStorage.getItem(AUTH_ACTIVITY_STORAGE_KEY)) markActivity();
    if (!localStorage.getItem(AUTH_REFRESH_STORAGE_KEY)) {
      localStorage.setItem(AUTH_REFRESH_STORAGE_KEY, String(Date.now()));
    }

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'focus'];
    for (const event of events) window.addEventListener(event, markActivity, { passive: true });

    const interval = window.setInterval(() => {
      const now = Date.now();
      const lastActivity = storedTimestamp(AUTH_ACTIVITY_STORAGE_KEY, now);
      const lastRefresh = storedTimestamp(AUTH_REFRESH_STORAGE_KEY, now);

      if (now - lastActivity >= idleTimeoutMs) {
        void terminateAuthSession({ revokeServerSession: true });
        return;
      }
      if (
        now - lastActivity < idleTimeoutMs &&
        now - lastRefresh >= keepAliveMs &&
        !refreshRunning.current
      ) {
        refreshRunning.current = true;
        void refresh()
          .catch(() => {
            return terminateAuthSession();
          })
          .finally(() => {
            refreshRunning.current = false;
          });
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      for (const event of events) window.removeEventListener(event, markActivity);
    };
  }, [isAuthenticated, refresh, session, user]);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return children;
}
