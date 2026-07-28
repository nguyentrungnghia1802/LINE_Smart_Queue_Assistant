/**
 * Real LIFF adapter built from the minimal official LIFF modules used here.
 *
 * Avoid importing the full SDK: unused sub-window modules require eval(), which
 * is intentionally blocked by the production Content Security Policy.
 * All other code goes through the LiffAdapter interface.
 */

import liff from '@line/liff/core';
import GetAccessTokenModule from '@line/liff/get-access-token';
import GetFriendshipModule from '@line/liff/get-friendship';
import GetIDTokenModule from '@line/liff/get-id-token';
import GetProfileModule from '@line/liff/get-profile';
import IsInClientModule from '@line/liff/is-in-client';
import IsLoggedInModule from '@line/liff/is-logged-in';
import LoginModule from '@line/liff/login';
import LogoutModule from '@line/liff/logout';
import RequestFriendshipModule from '@line/liff/request-friendship';
import ScanCodeV2Module from '@line/liff/scan-code-v2';

import type { LiffAdapter, LiffProfile } from './types';

liff.use(new GetAccessTokenModule());
liff.use(new GetFriendshipModule());
liff.use(new GetIDTokenModule());
liff.use(new GetProfileModule());
liff.use(new IsInClientModule());
liff.use(new IsLoggedInModule());
liff.use(new LoginModule());
liff.use(new LogoutModule());
liff.use(new RequestFriendshipModule());
liff.use(new ScanCodeV2Module());

export class RealLiffAdapter implements LiffAdapter {
  async init(liffId: string): Promise<void> {
    await liff.init({ liffId, withLoginOnExternalBrowser: true });
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

  async getFriendship(): Promise<boolean> {
    const friendship = await liff.getFriendship();
    return friendship.friendFlag;
  }

  async requestFriendship(): Promise<void> {
    await liff.requestFriendship();
  }

  async scanCode(): Promise<string | null> {
    const result = await liff.scanCodeV2();
    return result.value;
  }

  getAccessToken(): string | null {
    return liff.getAccessToken();
  }

  getIDToken(): string | null {
    return liff.getIDToken();
  }

  login(): void {
    liff.login();
  }

  logout(): void {
    liff.logout();
  }
}
