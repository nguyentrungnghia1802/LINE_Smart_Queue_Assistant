import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { config } from '../config';
import { AppError } from '../utils/AppError';

function resolveClientIp(req: { headers: Record<string, unknown>; ip?: string }): string {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const candidate =
    typeof forwardedValue === 'string' && forwardedValue.trim().length > 0
      ? forwardedValue.split(',')[0]?.trim()
      : req.ip;
  return candidate && candidate.length > 0 ? candidate : 'unknown';
}

function clientIpRateLimitKey(req: { headers: Record<string, unknown>; ip?: string }): string {
  const ip = resolveClientIp(req);
  return ip === 'unknown' ? ip : ipKeyGenerator(ip);
}

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
  keyGenerator: clientIpRateLimitKey,
});

/**
 * Strict rate limiter for sensitive endpoints (auth, webhook).
 * 20 requests per minute per IP.
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.nodeEnv === 'production' ? 20 : 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests());
  },
  keyGenerator: clientIpRateLimitKey,
});

export const publicReadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests());
  },
  keyGenerator: clientIpRateLimitKey,
});

export const publicWriteRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests());
  },
  keyGenerator: clientIpRateLimitKey,
});

export const authenticatedActionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests());
  },
  keyGenerator: (req) => req.user?.id ?? clientIpRateLimitKey(req),
});
