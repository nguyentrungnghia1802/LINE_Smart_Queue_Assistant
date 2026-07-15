import { describe, expect, it, jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';

import { UserRole } from '@line-queue/shared';

import { AppError } from '../../utils/AppError';
import { requireRole } from '../requireRole.middleware';

describe('requireRole', () => {
  it('returns 401 when req.user is missing', () => {
    const middleware = requireRole(UserRole.MANAGER);
    const req = {} as Request;
    const res = {} as Response;
    const next = jest.fn() as unknown as NextFunction;
    const nextMock = next as unknown as jest.Mock;

    middleware(req, res, next);

    expect(nextMock).toHaveBeenCalledWith(expect.any(AppError));
    expect((nextMock.mock.calls[0] ?? [])[0]).toMatchObject({ statusCode: 401 });
  });

  it('returns 403 when the user role is not allowed', () => {
    const middleware = requireRole(UserRole.MANAGER);
    const req = { user: { id: 'user-1', role: UserRole.STAFF } } as Request;
    const res = {} as Response;
    const next = jest.fn() as unknown as NextFunction;
    const nextMock = next as unknown as jest.Mock;

    middleware(req, res, next);

    expect(nextMock).toHaveBeenCalledWith(expect.any(AppError));
    expect((nextMock.mock.calls[0] ?? [])[0]).toMatchObject({ statusCode: 403 });
  });

  it('calls next without error when the user role is allowed', () => {
    const middleware = requireRole(UserRole.STAFF, UserRole.MANAGER);
    const req = { user: { id: 'user-1', role: UserRole.STAFF } } as Request;
    const res = {} as Response;
    const next = jest.fn() as unknown as NextFunction;
    const nextMock = next as unknown as jest.Mock;

    middleware(req, res, next);

    expect(nextMock).toHaveBeenCalledWith();
  });
});
