import liff from '@line/liff';
import { useCallback, useEffect, useState } from 'react';

import type { LiffContext, LiffInitStatus, LiffProfile } from '../types/liff';

const LIFF_ID = import.meta.env.VITE_LIFF_ID ?? '';

/**
 * Initialises the LIFF SDK and exposes profile / auth state.
 *
 * Usage:
 *   const { isInitialized, isLoggedIn, profile, login } = useLiff();
 *
 * Notes:
 *   - VITE_LIFF_ID must be set; without it the hook enters error state immediately.
 *   - Safe to use outside the LINE in-app browser (isInClient will be false).
 *   - The access token should be sent to POST /api/v1/auth/line to exchange for a JWT.
 */
export function useLiff(): LiffContext {
  const [initStatus, setInitStatus] = useState<LiffInitStatus>('idle');
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInClient, setIsInClient] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!LIFF_ID) {
      setError(new Error('VITE_LIFF_ID is not configured. Add it to your .env file.'));
      setInitStatus('error');
      return;
    }

    let cancelled = false;
    setInitStatus('loading');

    (async () => {
      try {
        await liff.init({ liffId: LIFF_ID });
        if (cancelled) return;

        const inClient = liff.isInClient();
        const loggedIn = liff.isLoggedIn();
        setIsInClient(inClient);
        setIsLoggedIn(loggedIn);

        if (loggedIn) {
          const [liffProfile, token] = await Promise.all([
            liff.getProfile(),
            Promise.resolve(liff.getAccessToken()),
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
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    liff.login();
  }, []);

  const logout = useCallback(() => {
    liff.logout();
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
