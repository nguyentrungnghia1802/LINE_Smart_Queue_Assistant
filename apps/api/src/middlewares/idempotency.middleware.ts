import { NextFunction, Request, Response } from 'express';

import { AppError } from '../utils/AppError';

interface CachedResponse {
  expiresAt: number;
  statusCode: number;
  body: unknown;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const store = new Map<string, CachedResponse>();

function cleanupExpired(now = Date.now()): void {
  for (const [key, value] of store) {
    if (value.expiresAt <= now) store.delete(key);
  }
}

function buildKey(req: Request): string | null {
  const header = req.header('Idempotency-Key');
  if (!header) return null;
  const actor = req.user?.id ?? req.ip ?? 'anonymous';
  return `${req.method}:${req.originalUrl}:${actor}:${header}`;
}

export function idempotencyMiddleware(ttlMs = DEFAULT_TTL_MS) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = buildKey(req);
    if (!key) {
      next();
      return;
    }

    if (key.length > 512) {
      next(AppError.badRequest('Idempotency-Key is too long'));
      return;
    }

    cleanupExpired();

    const cached = store.get(key);
    if (cached) {
      res.status(cached.statusCode).json(cached.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.set(key, {
          expiresAt: Date.now() + ttlMs,
          statusCode: res.statusCode,
          body,
        });
      }
      return originalJson(body);
    };

    next();
  };
}

export function resetIdempotencyStoreForTests(): void {
  store.clear();
}
