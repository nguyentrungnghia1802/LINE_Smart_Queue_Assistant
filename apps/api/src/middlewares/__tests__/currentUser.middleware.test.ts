import { NextFunction, Request, Response } from 'express';

import { UserRole } from '@line-queue/shared';

import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { usersRepository } from '../../db/repositories/users.repository';
import { AppError } from '../../utils/AppError';
import { signToken, TokenPayload } from '../../utils/jwt';
import { currentUserMiddleware } from '../currentUser.middleware';

jest.mock('../../db/repositories/users.repository');
jest.mock('../../db/repositories/organizations.repository');

const mockFindById = usersRepository.findById as jest.MockedFunction<
  typeof usersRepository.findById
>;
const mockFindMembershipByUserId =
  organizationsRepository.findMembershipByUserId as jest.MockedFunction<
    typeof organizationsRepository.findMembershipByUserId
  >;

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
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindById.mockResolvedValue({
      id: basePayload.sub,
      display_name: 'Test User',
      email: null,
      password_hash: null,
      role: UserRole.CUSTOMER,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    mockFindMembershipByUserId.mockResolvedValue(null);
  });

  it('calls next() without setting req.user when no Authorization header is present', async () => {
    const req = makeReq() as Request;
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    await currentUserMiddleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(); // called with no arguments → proceed
    expect(req.user).toBeUndefined();
  });

  it('calls next() without setting req.user when Authorization header is not Bearer', async () => {
    const req = makeReq('Basic dXNlcjpwYXNz') as Request;
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    await currentUserMiddleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  it('populates req.user from a valid Bearer token', async () => {
    const token = signToken(basePayload);
    const req = makeReq(`Bearer ${token}`) as Request;
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    await currentUserMiddleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(); // no error passed
    expect(req.user).toBeDefined();
    expect(req.user?.id).toBe(basePayload.sub);
    expect(req.user?.lineUserId).toBe(basePayload.lineUserId);
    expect(req.user?.role).toBe(UserRole.CUSTOMER);
  });

  it('populates organizationId from organization_members for staff users', async () => {
    mockFindById.mockResolvedValue({
      id: basePayload.sub,
      display_name: 'Staff User',
      email: 'staff@example.com',
      password_hash: 'hash',
      role: UserRole.STAFF,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    mockFindMembershipByUserId.mockResolvedValue({
      id: 'member-id',
      organization_id: 'org-id',
      user_id: basePayload.sub,
      role: 'staff',
      joined_at: new Date(),
    });

    const token = signToken({ ...basePayload, role: UserRole.STAFF });
    const req = makeReq(`Bearer ${token}`) as Request;
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    await currentUserMiddleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user?.organizationId).toBe('org-id');
    expect(req.user?.role).toBe(UserRole.STAFF);
  });

  it('rejects staff users without organization membership', async () => {
    mockFindById.mockResolvedValue({
      id: basePayload.sub,
      display_name: 'Staff User',
      email: 'staff@example.com',
      password_hash: 'hash',
      role: UserRole.STAFF,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    mockFindMembershipByUserId.mockResolvedValue(null);

    const token = signToken({ ...basePayload, role: UserRole.STAFF });
    const req = makeReq(`Bearer ${token}`) as Request;
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    await currentUserMiddleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = (next as jest.Mock).mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(403);
  });

  it('allows admin users without organization membership', async () => {
    mockFindById.mockResolvedValue({
      id: basePayload.sub,
      display_name: 'Admin User',
      email: 'admin@example.com',
      password_hash: 'hash',
      role: UserRole.ADMIN,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    mockFindMembershipByUserId.mockResolvedValue(null);

    const token = signToken({ ...basePayload, role: UserRole.ADMIN });
    const req = makeReq(`Bearer ${token}`) as Request;
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    await currentUserMiddleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({
      id: basePayload.sub,
      role: UserRole.ADMIN,
      organizationId: undefined,
      email: 'admin@example.com',
    });
  });

  it('calls next(AppError 401) when the token has an invalid signature', async () => {
    const req = makeReq('Bearer invalid.token.here') as Request;
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    await currentUserMiddleware(req, mockRes, next);

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

    await currentUserMiddleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = (next as jest.Mock).mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
  });
});
