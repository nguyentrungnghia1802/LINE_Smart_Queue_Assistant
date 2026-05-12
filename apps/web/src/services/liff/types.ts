/**
 * LIFF Adapter interface.
 *
 * Both the real (@line/liff) and mock adapters implement this contract so
 * `useLiff` never imports the SDK directly — only the adapter does.
 *
 * Adding or swapping adapters (e.g. a stub for Vitest) requires no changes
 * to hooks or UI components.
 */

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface LiffAdapter {
  /**
   * Initialise the SDK with the given LIFF ID.
   * Must be awaited before calling any other method.
   */
  init(liffId: string): Promise<void>;

  /** Whether the user is currently logged in to LINE. */
  isLoggedIn(): boolean;

  /** Whether the app is running inside the LINE in-app browser. */
  isInClient(): boolean;

  /** Fetch the user's LINE profile. Only valid when `isLoggedIn()` is true. */
  getProfile(): Promise<LiffProfile>;

  /**
   * Get the current LIFF access token.
   * Returns `null` when not logged in.
   */
  getAccessToken(): string | null;

  /**
   * Redirect the user to the LINE login screen.
   * No-op in mock mode.
   */
  login(): void;

  /**
   * Log the user out of LINE.
   * No-op in mock mode.
   */
  logout(): void;
}
