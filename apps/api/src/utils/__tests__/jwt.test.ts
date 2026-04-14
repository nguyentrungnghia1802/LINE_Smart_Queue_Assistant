import jwt from 'jsonwebtoken';

import { UserRole } from '@line-queue/shared';

import { signToken, TokenPayload, verifyToken } from '../jwt';

// ── Helpers ───────────────────────────────────────────────────────────────────

const basePayload: TokenPayload = {
  sub: '00000000-0000-0000-0000-000000000001',
  lineUserId: 'U12345678901234567890123456789012',
  role: UserRole.CUSTOMER,
};

// ── signToken / verifyToken round-trip ────────────────────────────────────────

describe('signToken + verifyToken', () => {
  it('produces a token that verifyToken can decode', () => {
    const token = signToken(basePayload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // valid JWT structure
  });

  it('round-trip preserves all payload fields', () => {
    const payloadWithOrg: TokenPayload = { ...basePayload, orgId: 'org-abc' };
    const token = signToken(payloadWithOrg);
    const decoded = verifyToken(token);

    expect(decoded.sub).toBe(payloadWithOrg.sub);
    expect(decoded.lineUserId).toBe(payloadWithOrg.lineUserId);
    expect(decoded.role).toBe(UserRole.CUSTOMER);
    expect(decoded.orgId).toBe('org-abc');
  });

  it('round-trip works without orgId', () => {
    const token = signToken(basePayload);
    const decoded = verifyToken(token);
    expect(decoded.orgId).toBeUndefined();
  });
});

// ── verifyToken error cases ───────────────────────────────────────────────────

describe('verifyToken', () => {
  it('throws JsonWebTokenError for a tampered token', () => {
    const token = signToken(basePayload);
    const [header, payload] = token.split('.');
    const tamperedToken = `${header}.${payload}.invalidsignature`;

    expect(() => verifyToken(tamperedToken)).toThrow(jwt.JsonWebTokenError);
  });

  it('throws JsonWebTokenError for a completely invalid string', () => {
    expect(() => verifyToken('not.a.jwt')).toThrow(jwt.JsonWebTokenError);
  });

  it('throws TokenExpiredError for an expired token', () => {
    const expiredToken = jwt.sign(
      { ...basePayload, iat: Math.floor(Date.now() / 1000) - 10 },
      // Use the same secret as config (defaults to 'change-me-in-production')
      process.env['JWT_SECRET'] ?? 'change-me-in-production',
      { expiresIn: '1ms', algorithm: 'HS256' }
    );

    // Give it a moment to actually expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(() => verifyToken(expiredToken)).toThrow(jwt.TokenExpiredError);
        resolve();
      }, 10);
    });
  });
});
