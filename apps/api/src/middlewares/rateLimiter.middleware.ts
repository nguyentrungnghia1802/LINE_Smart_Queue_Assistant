import rateLimit, { ipKeyGenerator, Store } from 'express-rate-limit';

import { config } from '../config';
import { ResilientRateLimitStore } from '../infrastructure/redis';
import { AppError } from '../utils/AppError';

export function resolveClientIp(req: { headers: Record<string, unknown>; ip?: string }): string {
  // Express derives req.ip from the configured trusted-proxy hop count. Reading
  // X-Forwarded-For directly would let an untrusted left-most value evade limits.
  const candidate = req.ip?.trim();
  return candidate && candidate.length > 0 ? candidate : 'unknown';
}

export function clientIpRateLimitKey(req: {
  headers: Record<string, unknown>;
  ip?: string;
}): string {
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
export function createStrictRateLimiter(options?: { limit?: number; store?: Store }) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: options?.limit ?? (config.nodeEnv === 'production' ? 20 : 120),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(AppError.tooManyRequests());
    },
    keyGenerator: clientIpRateLimitKey,
    store: options?.store ?? new ResilientRateLimitStore('strict'),
  });
}

export const strictRateLimiter = createStrictRateLimiter();

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

export function createPublicWriteRateLimiter(options?: { limit?: number; store?: Store }) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: options?.limit ?? 15,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(AppError.tooManyRequests());
    },
    keyGenerator: clientIpRateLimitKey,
    store: options?.store ?? new ResilientRateLimitStore('public-write'),
  });
}

export const publicWriteRateLimiter = createPublicWriteRateLimiter();

export const authenticatedActionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests());
  },
  keyGenerator: (req) => req.user?.id ?? clientIpRateLimitKey(req),
  store: new ResilientRateLimitStore('authenticated-action'),
});
