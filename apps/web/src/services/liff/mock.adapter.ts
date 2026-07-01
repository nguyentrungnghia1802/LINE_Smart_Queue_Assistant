/**
 * Mock LIFF adapter for local development.
 *
 * Enabled when  VITE_LIFF_MOCK=true  in your .env.local.
 * Simulates LINE login without requiring a real LIFF ID, an internet
 * connection, or the LINE app.
 *
 * Configurable via env vars (all optional):
 *   VITE_LIFF_MOCK_LOGGED_IN=false   → start in logged-out state (default: true)
 *   VITE_LIFF_MOCK_USER_ID           → fake userId   (default: 'mock-user-001')
 *   VITE_LIFF_MOCK_DISPLAY_NAME      → fake name     (default: 'Dev User')
 *   VITE_LIFF_MOCK_PICTURE_URL       → fake avatar   (default: blank placeholder)
 *   VITE_LIFF_MOCK_INIT_DELAY_MS     → artificial init delay in ms (default: 400)
 */

import type { LiffAdapter, LiffProfile } from './types';

const MOCK_PROFILE: LiffProfile = {
  userId: import.meta.env.VITE_LIFF_MOCK_USER_ID ?? 'mock-user-001',
  displayName: import.meta.env.VITE_LIFF_MOCK_DISPLAY_NAME ?? 'Dev User',
  pictureUrl:
    import.meta.env.VITE_LIFF_MOCK_PICTURE_URL ??
    'https://placehold.co/96x96/06c755/ffffff?text=DEV',
  statusMessage: 'Mock LIFF session',
};

const MOCK_TOKEN = 'mock-liff-access-token';
const MOCK_ID_TOKEN = 'mock-liff-id-token';
const INIT_DELAY = Number(import.meta.env.VITE_LIFF_MOCK_INIT_DELAY_MS ?? 400);

export class MockLiffAdapter implements LiffAdapter {
  private _loggedIn: boolean;

  constructor() {
    // Default to logged-in so devs see a realistic app state immediately.
    // Set VITE_LIFF_MOCK_LOGGED_IN=false to test the signed-out flow.
    this._loggedIn = import.meta.env.VITE_LIFF_MOCK_LOGGED_IN !== 'false';
  }

  async init(_liffId: string): Promise<void> {
    // Simulate async SDK initialisation latency.
    if (INIT_DELAY > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, INIT_DELAY));
    }
  }

  isLoggedIn(): boolean {
    return this._loggedIn;
  }

  // Mock always runs outside the LINE app (browser / localhost).
  isInClient(): boolean {
    return false;
  }

  async getProfile(): Promise<LiffProfile> {
    return Promise.resolve({ ...MOCK_PROFILE });
  }

  getAccessToken(): string | null {
    return this._loggedIn ? MOCK_TOKEN : null;
  }

  getIDToken(): string | null {
    return this._loggedIn ? MOCK_ID_TOKEN : null;
  }

  login(): void {
    // Simulate a successful login without redirecting.
    this._loggedIn = true;
    console.info('[MockLiffAdapter] login() called — switching to logged-in state.');
  }

  logout(): void {
    this._loggedIn = false;
    console.info('[MockLiffAdapter] logout() called — switching to logged-out state.');
  }
}
