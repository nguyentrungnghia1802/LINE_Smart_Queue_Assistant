import { sanitizeTelemetryValue } from '../sanitization';

describe('sanitizeTelemetryValue', () => {
  it('redacts credentials and customer identifiers recursively', () => {
    const result = sanitizeTelemetryValue({
      authorization: 'Bearer secret',
      nested: {
        password: 'password-value',
        lineUserId: 'U123456789',
        email: 'customer@example.com',
        safeStatus: 'failed',
      },
    });

    expect(result).toEqual({
      authorization: '[REDACTED]',
      nested: {
        password: '[REDACTED]',
        lineUserId: '[REDACTED]',
        email: '[REDACTED]',
        safeStatus: 'failed',
      },
    });
  });

  it('removes credentials, query strings, and fragments from URLs', () => {
    expect(sanitizeTelemetryValue('https://user:pass@example.com/path?token=secret#fragment')).toBe(
      'https://example.com/path'
    );
  });
});
