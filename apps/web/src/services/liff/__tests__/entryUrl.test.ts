import { describe, expect, it } from 'vitest';

import { buildLiffEntryUrl, sanitizeLiffRoute } from '../entryUrl';

describe('LIFF entry URL', () => {
  it('builds a LINE universal link that preserves the target route in liff.state', () => {
    expect(buildLiffEntryUrl('1234567890-AbCdEfGh', '/liff/qr/store-token')).toBe(
      'https://liff.line.me/1234567890-AbCdEfGh?liff.state=%2Fliff%2Fqr%2Fstore-token'
    );
  });

  it('rejects external and protocol-relative targets', () => {
    expect(sanitizeLiffRoute('https://example.com/liff/home')).toBeNull();
    expect(sanitizeLiffRoute('//example.com/liff/home')).toBeNull();
    expect(buildLiffEntryUrl('liff-id', '/login')).toBeNull();
  });

  it('returns null when the LIFF ID is missing', () => {
    expect(buildLiffEntryUrl('', '/liff/home')).toBeNull();
  });
});
