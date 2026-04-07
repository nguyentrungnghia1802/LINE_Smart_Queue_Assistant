import rateLimit from 'express-rate-limit';

import { AppError } from '../utils/AppError';

/**
 * Standard API rate limiter — 200 requests per 15 minutes per IP.
 * Applied to all /api/* routes in app.ts.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests());
  },
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? req.ip ?? 'unknown');
    return typeof ip === 'string' ? ip : 'unknown';
  },
});

/**
 * Strict rate limiter for sensitive endpoints (auth, webhook).
 * 20 requests per minute per IP.
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests());
  },
});
