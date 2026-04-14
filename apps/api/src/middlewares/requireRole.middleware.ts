import { NextFunction, Request, RequestHandler, Response } from 'express';

import { UserRole } from '@line-queue/shared';

import { AppError } from '../utils/AppError';

/**
 * requireRole middleware factory
 *
 * Returns a middleware that passes only when `req.user` exists AND their role
 * is in the `allowedRoles` list.
 *
 *  - No `req.user`                 → 401 Unauthorized
 *  - User role not in allowedRoles → 403 Forbidden
 *
 * Example:
 * ```ts
 * router.delete('/:id', requireRole(UserRole.ADMIN), deleteQueue);
 * router.patch('/:id/status', requireRole(UserRole.ADMIN, UserRole.STAFF), updateStatus);
 * ```
 */
export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden());
    }

    next();
  };
}
