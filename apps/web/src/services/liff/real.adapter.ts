/**
 * Real LIFF adapter — thin wrapper around @line/liff.
 *
 * This is the ONLY file in the project that imports from '@line/liff'.
 * All other code goes through the LiffAdapter interface.
 */

import liff from '@line/liff';

import type { LiffAdapter, LiffProfile } from './types';

export class RealLiffAdapter implements LiffAdapter {
  async init(liffId: string): Promise<void> {
    await liff.init({ liffId });
  }

  isLoggedIn(): boolean {
    return liff.isLoggedIn();
  }

  isInClient(): boolean {
    return liff.isInClient();
  }

  async getProfile(): Promise<LiffProfile> {
    const p = await liff.getProfile();
    return {
      userId: p.userId,
      displayName: p.displayName,
      pictureUrl: p.pictureUrl ?? undefined,
      statusMessage: p.statusMessage ?? undefined,
    };
  }

  getAccessToken(): string | null {
    return liff.getAccessToken();
  }

  login(): void {
    liff.login();
  }

  logout(): void {
    liff.logout();
  }
}
