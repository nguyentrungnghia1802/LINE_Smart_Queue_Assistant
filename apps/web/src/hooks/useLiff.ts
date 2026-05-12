import { useCallback, useEffect, useState } from 'react';

import { isLiffMockMode, liffAdapter } from '../services/liff';
import type { LiffContext, LiffInitStatus, LiffProfile } from '../types/liff';

/**
 * LIFF ID resolved from env.
 * In mock mode this value is ignored by the adapter (no real SDK call is made).
 */
const LIFF_ID = import.meta.env.VITE_LIFF_ID ?? '';

/**
 * Initialises the LIFF SDK (or mock adapter) and exposes profile / auth state.
 *
 * Usage:
 *   const { isInitialized, isLoggedIn, profile, login, logout } = useLiff();
 *
 * SDK coupling is handled exclusively by the adapter layer (services/liff/).
 * This hook never imports @line/liff directly.
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
