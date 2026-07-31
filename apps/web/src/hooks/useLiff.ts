import { useCallback, useEffect, useState } from 'react';

import { UserRole } from '@line-queue/shared';

import { i18n } from '../i18n';
import { post } from '../services/apiClient';
import { isLiffMockMode, liffAdapter } from '../services/liff';
import { useAuthStore } from '../store/authStore';
import type {
  LiffAuthStatus,
  LiffContext,
  LiffFriendshipStatus,
  LiffInitStatus,
  LiffProfile,
} from '../types/liff';

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
  const [friendshipStatus, setFriendshipStatus] = useState<LiffFriendshipStatus>('unknown');
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInClient, setIsInClient] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [authError, setAuthError] = useState<Error | null>(null);

  const { loginWithLine, logout: logoutSystemSession, isAuthenticated, user } = useAuthStore();
  const hasCustomerSession = isAuthenticated && user?.role === UserRole.CUSTOMER;

  const refreshFriendship = useCallback(async (): Promise<boolean> => {
    setFriendshipStatus('checking');
    try {
      const friendFlag = await liffAdapter.getFriendship();
      setFriendshipStatus(friendFlag ? 'friend' : 'not_friend');
      try {
        await post('/api/v1/line/friendship', { friendFlag });
      } catch (syncError) {
        console.warn('Could not synchronize LINE friendship state', syncError);
      }
      return friendFlag;
    } catch (friendshipError) {
      setFriendshipStatus('error');
      throw friendshipError;
    }
  }, []);

  const requestFriendship = useCallback(async (): Promise<boolean> => {
    await liffAdapter.requestFriendship();
    return refreshFriendship();
  }, [refreshFriendship]);

  const scanQrCode = useCallback(() => liffAdapter.scanCode(), []);

  useEffect(() => {
    // In real mode a LIFF ID is mandatory; fail fast with a clear message.
    if (!isLiffMockMode && !LIFF_ID) {
      setError(new Error(i18n.t('common:clientErrors.liffNotConfigured')));
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
          if (hasCustomerSession) {
            if (user?.displayName) {
              setProfile({ userId: user.id, displayName: user.displayName });
            }
            setAuthStatus('authenticated');
            setInitStatus('ready');
            return;
          }
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

            // Re-verify the current LINE identity whenever the SDK has an ID token.
            // A restored backend session is only a fallback when the SDK is signed out.
            if (oidcToken) {
              setAuthStatus('authenticating');
              try {
                await loginWithLine(oidcToken);
                try {
                  await refreshFriendship();
                } catch (friendshipError) {
                  console.warn('Could not read LINE friendship state', friendshipError);
                }
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
              const nextError = new Error(i18n.t('common:clientErrors.idTokenMissing'));
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

  const logout = useCallback(async () => {
    try {
      await logoutSystemSession();
    } finally {
      liffAdapter.logout();
      setIsLoggedIn(false);
      setProfile(null);
      setAccessToken(null);
      setIdToken(null);
      setAuthStatus('guest');
      setFriendshipStatus('unknown');
      setAuthError(null);
    }
  }, [logoutSystemSession]);

  return {
    initStatus,
    authStatus,
    friendshipStatus,
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
    refreshFriendship,
    requestFriendship,
    scanQrCode,
  };
}
