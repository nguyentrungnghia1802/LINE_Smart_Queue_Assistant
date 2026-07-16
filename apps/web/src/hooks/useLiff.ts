import { useCallback, useEffect, useState } from 'react';

import { isLiffMockMode, liffAdapter } from '../services/liff';
import { useAuthStore } from '../store/authStore';
import type { LiffAuthStatus, LiffContext, LiffInitStatus, LiffProfile } from '../types/liff';

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
 *     the LIFF OIDC ID token to obtain a backend JWT.  This keeps the session
 *     consistent whether the customer opens the web app or the LINE LIFF app.
 *   - In real LIFF mode, a signed-out customer is redirected into LINE Login.
 *   - Mock mode stays in the browser and can be configured as signed-in/out.
 *
 * Environment variables:
 *   VITE_LIFF_ID        — required for production; ignored when mock mode is on.
 *   VITE_LIFF_MOCK=true — enables MockLiffAdapter for local development.
 *
 * See apps/web/.env.example for a full reference.
 */
export function useLiff(): LiffContext {
  const [initStatus, setInitStatus] = useState<LiffInitStatus>('idle');
  const [authStatus, setAuthStatus] = useState<LiffAuthStatus>('idle');
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInClient, setIsInClient] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [authError, setAuthError] = useState<Error | null>(null);

  const { loginWithLine } = useAuthStore();

  useEffect(() => {
    // In real mode a LIFF ID is mandatory; fail fast with a clear message.
    if (!isLiffMockMode && !LIFF_ID) {
      setError(
        new Error('LINEアプリの設定が完了していません。しばらくしてからもう一度お試しください。')
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

        if (!loggedIn) {
          if (!isLiffMockMode) {
            setAuthStatus('authenticating');
            liffAdapter.login();
            return;
          }
          setAuthStatus('guest');
          if (!cancelled) setInitStatus('ready');
          return;
        }

        if (loggedIn) {
          const [liffProfile, token, oidcToken] = await Promise.all([
            liffAdapter.getProfile(),
            Promise.resolve(liffAdapter.getAccessToken()),
            Promise.resolve(liffAdapter.getIDToken()),
          ]);
          if (!cancelled) {
            setProfile(liffProfile);
            setAccessToken(token);
            setIdToken(oidcToken);

            // Auto-authenticate with backend using LINE OIDC ID token.
            // LIFF refreshes the system JWT on every app open so stale browser
            // sessions never become the source of customer identity.
            if (oidcToken) {
              setAuthStatus('authenticating');
              try {
                await loginWithLine(oidcToken);
                if (!cancelled) {
                  setAuthStatus('authenticated');
                  setAuthError(null);
                }
              } catch (authErr) {
                if (!cancelled) {
                  const nextError = authErr instanceof Error ? authErr : new Error(String(authErr));
                  setAuthError(nextError);
                  setAuthStatus('error');
                }
              }
            } else if (!cancelled) {
              const nextError = new Error('LINE ID tokenを取得できませんでした。');
              setAuthError(nextError);
              setAuthStatus('error');
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
    setIdToken(null);
    setAuthStatus('guest');
    setAuthError(null);
  }, []);

  return {
    initStatus,
    authStatus,
    isInitialized: initStatus === 'ready',
    isLoggedIn,
    isInClient,
    profile,
    accessToken,
    idToken,
    error,
    authError,
    login,
    logout,
  };
}
