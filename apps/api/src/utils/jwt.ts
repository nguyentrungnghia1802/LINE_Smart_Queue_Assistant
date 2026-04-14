import jwt from 'jsonwebtoken';

import { UserRole } from '@line-queue/shared';

import { config } from '../config';

// ── Payload ───────────────────────────────────────────────────────────────────

/**
 * Claims stored in tokens we issue.
 *
 * Keep small — only data needed to authenticate/authorise without a DB hit.
 * Sensitive fields (email, displayName) are intentionally excluded.
 */
export interface TokenPayload {
  /** Internal user UUID (maps to users.id) */
  sub: string;
  /** LINE userId — used for quick identity checks without a DB round-trip */
  lineUserId: string;
  role: UserRole;
  orgId?: string;
}

// ── Sign ──────────────────────────────────────────────────────────────────────

/**
 * Issue a signed JWT for an authenticated user.
 *
 * Security notes:
 *   - Uses HS256 (HMAC-SHA256) with config.jwt.secret.
 *   - Secret MUST be at least 32 random bytes in production (env: JWT_SECRET).
 *   - Default expiry is 7 days; override with config.jwt.expiresIn.
 */
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

// ── Verify ────────────────────────────────────────────────────────────────────

/**
 * Verify and decode a JWT issued by this service.
 *
 * Throws `jwt.JsonWebTokenError`  on invalid signature or malformed token.
 * Throws `jwt.TokenExpiredError`  on expired token.
 * Both are caught in currentUser middleware and converted to 401.
 */
export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, config.jwt.secret, {
    algorithms: ['HS256'],
  });
  return decoded as TokenPayload;
}
