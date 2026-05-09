import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies the X-Line-Signature HMAC-SHA256 header.
 *
 * The `channelSecret` is passed as an explicit parameter — not read from the
 * global config object — so this function is a pure, side-effect-free utility
 * that can be unit-tested without any mocking.
 *
 * The raw body buffer must be the exact bytes LINE sent (captured before
 * express.json() parses them). Re-serialising the parsed body object would
 * produce a different byte sequence and fail verification.
 *
 * @see https://developers.line.biz/en/docs/messaging-api/receiving-messages/#verifying-signatures
 */
export function verifyLineSignature(
  rawBody: Buffer | string,
  signature: string,
  channelSecret: string
): boolean {
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  const expected = createHmac('sha256', channelSecret).update(body).digest('base64');
  try {
    const expBuf = Buffer.from(expected);
    const sigBuf = Buffer.from(signature);
    // timingSafeEqual requires equal-length buffers; check first to avoid
    // a RangeError that would bubble up as an unexpected 500.
    if (expBuf.length !== sigBuf.length) return false;
    return timingSafeEqual(expBuf, sigBuf);
  } catch {
    return false;
  }
}
