import { NextFunction, Request, Response } from 'express';

import { AuthUser } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { verifyToken } from '../utils/jwt';

/**
 * currentUser middleware
 *
 * Parses the `Authorization: Bearer <token>` header and, if a valid token is
 * present, attaches the decoded `AuthUser` to `req.user`.
 *
 * Behaviour:
 *  - No `Authorization` header → anonymous request; `req.user` stays undefined, `next()` is called.
 *  - Valid Bearer token        → `req.user` is populated; `next()` is called.
 *  - Token present but invalid → `next(AppError.unauthorized(…))` — the client
 *    deliberately sent a token, so a silent pass-through would be misleading.
 *
 * Mount globally AFTER body parsing so all routes can benefit from it.
 * Use `requireAuth` or `requireRole` on specific routes to enforce access.
 */
export function currentUserMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    // No token supplied — anonymous; continue without setting req.user
    return next();
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);

    const user: AuthUser = {
      id: payload.sub,
      lineUserId: payload.lineUserId,
      role: payload.role,
      organizationId: payload.orgId,
    };

    req.user = user;
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired token'));
  }
}
