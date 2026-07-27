import { describe, expect, it } from 'vitest';

import { bookingPathFromQr } from '../qrBookingPath';

describe('bookingPathFromQr', () => {
  it.each([
    ['https://queue.example.com/qr/store-token-2026', '/liff/qr/store-token-2026'],
    ['https://queue.example.com/liff/qr/store-token-2026', '/liff/qr/store-token-2026'],
    ['https://liff.line.me/1234567890-AbCdEfGh/qr/store-token-2026', '/liff/qr/store-token-2026'],
    ['/qr/store-token-2026', '/liff/qr/store-token-2026'],
  ])('normalizes a supported reception URL', (value, expected) => {
    expect(bookingPathFromQr(value)).toBe(expected);
  });

  it.each([
    'https://example.com/admin',
    'https://example.com/qr/x',
    'not a QR URL',
    'javascript:alert(1)',
  ])('rejects an unsupported QR value', (value) => {
    expect(bookingPathFromQr(value)).toBeNull();
  });
});
