/**
 * Frontend-specific LIFF types.
 * Mirrors the LIFF SDK surface without coupling to the SDK directly.
 *
 * The concrete adapter implementations live in services/liff/.
 * Only import this file for type annotations — never import @line/liff
 * outside of services/liff/real.adapter.ts.
 */

export type LiffInitStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface LiffContext {
  initStatus: LiffInitStatus;
  isInitialized: boolean;
  isLoggedIn: boolean;
  /** true when running inside the LINE in-app browser */
  isInClient: boolean;
  profile: LiffProfile | null;
  /**
   * LIFF access token — exchange at POST /api/v1/auth/line to obtain a JWT.
   * null when not logged in or in mock mode (mock returns a fake token string).
   */
  accessToken: string | null;
  error: Error | null;
  login: () => void;
  logout: () => void;
}
