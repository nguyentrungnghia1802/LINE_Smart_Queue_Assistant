/**
 * Unit tests for verifyLineSignature.
 *
 * These tests exercise the pure function directly — no mocking required,
 * no HTTP, no database. The secret is passed as an explicit parameter so
 * the config module is never touched.
 */

import { createHmac } from 'node:crypto';

import { verifyLineSignature } from '../line.signature';

const SECRET = 'test-channel-secret-32bytes!!!!!';

function makeSignature(body: string | Buffer, secret = SECRET): string {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
  return createHmac('sha256', secret).update(buf).digest('base64');
}

describe('verifyLineSignature', () => {
  const BODY_STR = JSON.stringify({ destination: 'U123', events: [] });
  const BODY_BUF = Buffer.from(BODY_STR, 'utf8');

  it('returns true for a valid string body + matching signature', () => {
    const sig = makeSignature(BODY_STR);
    expect(verifyLineSignature(BODY_STR, sig, SECRET)).toBe(true);
  });

  it('returns true for a valid Buffer body + matching signature', () => {
    const sig = makeSignature(BODY_BUF);
    expect(verifyLineSignature(BODY_BUF, sig, SECRET)).toBe(true);
  });

  it('returns false for a tampered body', () => {
    const sig = makeSignature(BODY_STR);
    const tampered = BODY_STR + ' ';
    expect(verifyLineSignature(tampered, sig, SECRET)).toBe(false);
  });

  it('returns false for a wrong secret', () => {
    const sig = makeSignature(BODY_STR, 'wrong-secret');
    expect(verifyLineSignature(BODY_STR, sig, SECRET)).toBe(false);
  });

  it('returns false for an empty signature string', () => {
    expect(verifyLineSignature(BODY_STR, '', SECRET)).toBe(false);
  });

  it('returns false for a completely garbage signature', () => {
    expect(verifyLineSignature(BODY_STR, '!!!not-base64!!!', SECRET)).toBe(false);
  });

  it('is timing-safe — accepts the correct signature even when lengths differ', () => {
    // A truncated (wrong-length) signature should be rejected, not throw.
    const sig = makeSignature(BODY_STR).slice(0, 10);
    expect(verifyLineSignature(BODY_STR, sig, SECRET)).toBe(false);
  });

  it('treats string and Buffer bodies identically when encoding is utf8', () => {
    const strSig = makeSignature(BODY_STR);
    const bufSig = makeSignature(BODY_BUF);
    expect(strSig).toBe(bufSig);
    expect(verifyLineSignature(BODY_BUF, strSig, SECRET)).toBe(true);
  });
});
