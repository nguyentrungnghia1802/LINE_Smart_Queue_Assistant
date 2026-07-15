/**
 * Frontend-specific LIFF types.
 * Mirrors the LIFF SDK surface without coupling to the SDK directly.
 *
 * The concrete adapter implementations live in services/liff/.
 * Only import this file for type annotations — never import @line/liff
 * outside of services/liff/real.adapter.ts.
 */

export type LiffInitStatus = 'idle' | 'loading' | 'ready' | 'error';
export type LiffAuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'guest' | 'error';

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface LiffContext {
  initStatus: LiffInitStatus;
  authStatus: LiffAuthStatus;
  isInitialized: boolean;
  isLoggedIn: boolean;
  /** true when running inside the LINE in-app browser */
  isInClient: boolean;
  profile: LiffProfile | null;
  /**
   * LIFF access token — kept for LINE APIs that require it.
   * null when not logged in or in mock mode (mock returns a fake token string).
   */
  accessToken: string | null;
  /**
   * LIFF OIDC ID token — exchanged at POST /api/v1/auth/line to obtain a JWT.
   */
  idToken: string | null;
  error: Error | null;
  authError: Error | null;
  login: () => void;
  logout: () => void;
}
