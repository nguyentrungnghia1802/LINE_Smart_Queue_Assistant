import { beforeEach, describe, expect, it, vi } from 'vitest';

const liffMock = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  getFriendship: vi.fn(),
  getIDToken: vi.fn(),
  getProfile: vi.fn(),
  init: vi.fn().mockResolvedValue(undefined),
  isInClient: vi.fn(),
  isLoggedIn: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  requestFriendship: vi.fn(),
  scanCodeV2: vi.fn(),
  use: vi.fn(),
}));

vi.mock('@line/liff/core', () => ({ default: liffMock }));
vi.mock('@line/liff/get-access-token', () => ({ default: class GetAccessTokenModule {} }));
vi.mock('@line/liff/get-friendship', () => ({ default: class GetFriendshipModule {} }));
vi.mock('@line/liff/get-id-token', () => ({ default: class GetIDTokenModule {} }));
vi.mock('@line/liff/get-profile', () => ({ default: class GetProfileModule {} }));
vi.mock('@line/liff/is-in-client', () => ({ default: class IsInClientModule {} }));
vi.mock('@line/liff/is-logged-in', () => ({ default: class IsLoggedInModule {} }));
vi.mock('@line/liff/login', () => ({ default: class LoginModule {} }));
vi.mock('@line/liff/logout', () => ({ default: class LogoutModule {} }));
vi.mock('@line/liff/request-friendship', () => ({ default: class RequestFriendshipModule {} }));
vi.mock('@line/liff/scan-code-v2', () => ({ default: class ScanCodeV2Module {} }));

import { RealLiffAdapter } from '../real.adapter';

describe('RealLiffAdapter login continuity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/liff/qr/store-token-2026?queue=queue-1');
  });

  it('initializes without the endpoint-only automatic login redirect', async () => {
    const adapter = new RealLiffAdapter();

    await adapter.init('1234567890-AbCdEfGh');

    expect(liffMock.init).toHaveBeenCalledWith({ liffId: '1234567890-AbCdEfGh' });
  });

  it('returns LINE Login to the current scanned booking URL', () => {
    const adapter = new RealLiffAdapter();

    adapter.login();

    expect(liffMock.login).toHaveBeenCalledWith({
      redirectUri: window.location.href,
    });
    expect(window.location.pathname).toBe('/liff/qr/store-token-2026');
  });
});
