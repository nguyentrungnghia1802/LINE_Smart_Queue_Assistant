/**
 * Frontend-specific LIFF types.
 * Mirrors the LIFF SDK surface without coupling to the SDK directly.
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
  /** LIFF access token — send to backend to exchange for a JWT */
  accessToken: string | null;
  error: Error | null;
  login: () => void;
  logout: () => void;
}
