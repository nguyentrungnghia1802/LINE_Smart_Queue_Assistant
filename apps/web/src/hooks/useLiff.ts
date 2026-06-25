import { useCallback, useEffect, useState } from 'react';

import { isLiffMockMode, liffAdapter } from '../services/liff';
import { useAuthStore } from '../store/authStore';
import type { LiffContext, LiffInitStatus, LiffProfile } from '../types/liff';

/**
 * LIFF ID resolved from env.
 * In mock mode this value is ignored by the adapter (no real SDK call is made).
 */
const LIFF_ID = import.meta.env.VITE_LIFF_ID ?? '';

/**
 * Initialises the LIFF SDK (or mock adapter), exposes profile / auth state,
 * and automatically authenticates with the backend after a successful LINE login.
 *
 * After LIFF init:
 *   - If user is logged in via LINE, the hook calls POST /api/v1/auth/line with
 *     the LIFF access-token to obtain a backend JWT.  This keeps the session
 *     consistent whether the customer opens the web app or the LINE LIFF app.
 *   - If the backend call fails the LIFF UI still works (guest mode).
 *
 * Environment variables:
 *   VITE_LIFF_ID        — required for production; ignored when mock mode is on.
 *   VITE_LIFF_MOCK=true — enables MockLiffAdapter for local development.
 *
 * See apps/web/.env.example for a full reference.
 */
export function useLiff(): LiffContext {
  const [initStatus, setInitStatus] = useState<LiffInitStatus>('idle');
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInClient, setIsInClient] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const { loginWithLine, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // In real mode a LIFF ID is mandatory; fail fast with a clear message.
    if (!isLiffMockMode && !LIFF_ID) {
      setError(
        new Error(
          'VITE_LIFF_ID is not configured.\n' +
            'Add it to apps/web/.env.local or set VITE_LIFF_MOCK=true for local development.\n' +
            'See apps/web/.env.example for details.'
        )
      );
      setInitStatus('error');
      return;
    }

    let cancelled = false;
    setInitStatus('loading');

    const run = async () => {
      try {
        await liffAdapter.init(LIFF_ID);
        if (cancelled) return;

        const inClient = liffAdapter.isInClient();
        const loggedIn = liffAdapter.isLoggedIn();
        setIsInClient(inClient);
        setIsLoggedIn(loggedIn);

        if (loggedIn) {
          const [liffProfile, token] = await Promise.all([
            liffAdapter.getProfile(),
            Promise.resolve(liffAdapter.getAccessToken()),
          ]);
          if (!cancelled) {
            setProfile(liffProfile);
            setAccessToken(token);

            // Auto-authenticate with backend using LINE access token.
            // Only do this if the user isn't already authenticated.
            if (!isAuthenticated && token) {
              try {
                await loginWithLine(token);
              } catch {
                // Non-fatal: user can still browse as guest.
                // The backend auth will be attempted again on the next LINE action.
              }
            }
          }
        }

        if (!cancelled) setInitStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setInitStatus('error');
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(() => {
    liffAdapter.login();
  }, []);

  const logout = useCallback(() => {
    liffAdapter.logout();
    setIsLoggedIn(false);
    setProfile(null);
    setAccessToken(null);
  }, []);

  return {
    initStatus,
    isInitialized: initStatus === 'ready',
    isLoggedIn,
    isInClient,
    profile,
    accessToken,
    error,
    login,
    logout,
  };
}
