import { NextFunction, Request, Response } from 'express';

import { UserRole } from '@line-queue/shared';

import { AppError } from '../../utils/AppError';
import { signToken, TokenPayload } from '../../utils/jwt';
import { currentUserMiddleware } from '../currentUser.middleware';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  };
}

const mockRes = {} as Response;

const basePayload: TokenPayload = {
  sub: '00000000-0000-0000-0000-000000000001',
  lineUserId: 'U12345678901234567890123456789012',
  role: UserRole.CUSTOMER,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('currentUserMiddleware', () => {
  it('calls next() without setting req.user when no Authorization header is present', () => {
    const req = makeReq() as Request;
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    currentUserMiddleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(); // called with no arguments → proceed
    expect(req.user).toBeUndefined();
  });

  it('calls next() without setting req.user when Authorization header is not Bearer', () => {
    const req = makeReq('Basic dXNlcjpwYXNz') as Request;
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    currentUserMiddleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  it('populates req.user from a valid Bearer token', () => {
    const token = signToken(basePayload);
    const req = makeReq(`Bearer ${token}`) as Request;
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    currentUserMiddleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(); // no error passed
    expect(req.user).toBeDefined();
    expect(req.user?.id).toBe(basePayload.sub);
    expect(req.user?.lineUserId).toBe(basePayload.lineUserId);
    expect(req.user?.role).toBe(UserRole.CUSTOMER);
  });

  it('calls next(AppError 401) when the token has an invalid signature', () => {
    const req = makeReq('Bearer invalid.token.here') as Request;
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    currentUserMiddleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = (next as jest.Mock).mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
  });

  it('calls next(AppError 401) when an expired token is presented', async () => {
    const jwt = await import('jsonwebtoken');
    const expiredToken = jwt.sign(
      { ...basePayload },
      process.env['JWT_SECRET'] ?? 'change-me-in-production',
      { expiresIn: '1ms', algorithm: 'HS256' }
    );

    await new Promise<void>((r) => setTimeout(r, 10));

    const req = makeReq(`Bearer ${expiredToken}`) as Request;
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    currentUserMiddleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = (next as jest.Mock).mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
  });
});
