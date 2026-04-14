import { NextFunction, Request, Response } from 'express';

import { AppError } from '../utils/AppError';

/**
 * requireAuth middleware
 *
 * Ensures `req.user` is set (i.e. `currentUserMiddleware` already ran and
 * found a valid token). Throws 401 if the request is anonymous.
 *
 * Mount this on routes that must not be accessed without authentication.
 * Always pair with `currentUserMiddleware` earlier in the stack.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(AppError.unauthorized());
  }
  next();
}
