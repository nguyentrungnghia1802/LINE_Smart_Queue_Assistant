import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildLiffEntryUrl,
  getCustomerLineEntryUrl,
  sanitizeLiffRoute,
  toLiffAdditionalPath,
} from '../entryUrl';

describe('LIFF entry URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds a permanent link relative to the configured LIFF endpoint path', () => {
    expect(buildLiffEntryUrl('1234567890-AbCdEfGh', '/liff/qr/store-token')).toBe(
      'https://liff.line.me/1234567890-AbCdEfGh/qr/store-token'
    );
  });

  it('does not duplicate the endpoint path in additional LIFF navigation', () => {
    expect(toLiffAdditionalPath('/liff/home', '/liff')).toBe('/home');
    expect(buildLiffEntryUrl('liff-id', '/liff/home', '/liff')).toBe(
      'https://liff.line.me/liff-id/home'
    );
  });

  it('supports a LIFF endpoint configured at the web root', () => {
    expect(buildLiffEntryUrl('liff-id', '/liff/qr/store-token', '/')).toBe(
      'https://liff.line.me/liff-id/liff/qr/store-token'
    );
  });

  it('rejects external and protocol-relative targets', () => {
    expect(sanitizeLiffRoute('https://example.com/liff/home')).toBeNull();
    expect(sanitizeLiffRoute('//example.com/liff/home')).toBeNull();
    expect(buildLiffEntryUrl('liff-id', '/login')).toBeNull();
    expect(buildLiffEntryUrl('liff-id', '/liff/home', '/customer')).toBeNull();
  });

  it('returns null when the LIFF ID is missing', () => {
    expect(buildLiffEntryUrl('', '/liff/home')).toBeNull();
  });

  it('keeps local mock entry on the current web origin even when a real LIFF ID exists', () => {
    vi.stubEnv('VITE_LIFF_MOCK', 'true');
    vi.stubEnv('LINE_LOGIN_LIFF_ID', '1234567890-AbCdEfGh');

    expect(getCustomerLineEntryUrl('/liff/qr/store-token')).toBe('/liff/qr/store-token');
  });
});
