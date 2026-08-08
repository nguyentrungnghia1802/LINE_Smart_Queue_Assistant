import { beforeEach, describe, expect, it } from '@jest/globals';
import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import { UserRole } from '@line-queue/shared';

import {
  RateLimitBackend,
  ResilientRateLimitStore,
} from '../../infrastructure/redis/redis-rate-limit.store';
import { metricsService } from '../../utils/metrics';
import {
  authenticatedActionRateLimiter,
  createStrictRateLimiter,
  publicWriteRateLimiter,
  strictRateLimiter,
} from '../rateLimiter.middleware';

class SharedRateLimitBackend implements RateLimitBackend {
  readonly enabled = true;
  fail = false;
  private readonly counters = new Map<string, { count: number; resetAt: number }>();

  async increment(key: string, windowMs: number) {
    if (this.fail) throw new Error('Redis unavailable');
    const now = Date.now();
    const current = this.counters.get(key);
    const next =
      !current || current.resetAt <= now
        ? { count: 1, resetAt: now + windowMs }
        : { count: current.count + 1, resetAt: current.resetAt };
    this.counters.set(key, next);
    return { totalHits: next.count, resetTime: new Date(next.resetAt) };
  }

  async decrement(key: string): Promise<void> {
    const current = this.counters.get(key);
    if (current) current.count = Math.max(0, current.count - 1);
  }

  async resetKey(key: string): Promise<void> {
    this.counters.delete(key);
  }
}

function buildApp(routePath: string, middleware: express.RequestHandler, withUser = false) {
  const app = express();
  app.set('trust proxy', 2);

  if (withUser) {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.user = {
        id: req.header('x-user-id') ?? 'user-1',
        role: UserRole.STAFF,
        organizationId: 'org-1',
      };
      next();
    });
  }

  app.post(routePath, middleware, (_req, res) => {
    res.status(201).json({ ok: true });
  });

  app.use((err: { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode ?? 500).json({ ok: false });
  });

  return app;
}

beforeEach(() => {
  metricsService.resetForTests();
});

describe('rateLimiter middleware', () => {
  it('limits repeated public writes after the configured threshold', async () => {
    const app = buildApp('/public-write', publicWriteRateLimiter);

    for (let index = 0; index < 15; index += 1) {
      const response = await request(app).post('/public-write');
      expect(response.status).toBe(201);
    }

    const limitedResponse = await request(app).post('/public-write');

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.headers['ratelimit']).toBeDefined();
  });

  it('keys authenticated action limits by user id', async () => {
    const app = buildApp('/staff-action', authenticatedActionRateLimiter, true);

    for (let index = 0; index < 60; index += 1) {
      const response = await request(app).post('/staff-action').set('x-user-id', 'staff-1');
      expect(response.status).toBe(201);
    }

    const limitedResponse = await request(app).post('/staff-action').set('x-user-id', 'staff-1');
    const otherUserResponse = await request(app).post('/staff-action').set('x-user-id', 'staff-2');

    expect(limitedResponse.status).toBe(429);
    expect(otherUserResponse.status).toBe(201);
  });

  it('keeps strict auth limiting relaxed outside production for seed/reset development loops', async () => {
    const app = buildApp('/strict', strictRateLimiter);

    for (let index = 0; index < 20; index += 1) {
      const response = await request(app).post('/strict');
      expect(response.status).toBe(201);
    }

    const nextResponse = await request(app).post('/strict');

    expect(nextResponse.status).toBe(201);
  });

  it('shares one distributed counter across API instances', async () => {
    const backend = new SharedRateLimitBackend();
    const appA = buildApp(
      '/strict',
      createStrictRateLimiter({
        limit: 2,
        store: new ResilientRateLimitStore('shared-instance-test', backend),
      })
    );
    const appB = buildApp(
      '/strict',
      createStrictRateLimiter({
        limit: 2,
        store: new ResilientRateLimitStore('shared-instance-test', backend),
      })
    );

    expect((await request(appA).post('/strict')).status).toBe(201);
    expect((await request(appB).post('/strict')).status).toBe(201);
    expect((await request(appA).post('/strict')).status).toBe(429);
  });

  it('keeps strict authentication bounded with a local fallback during Redis outage', async () => {
    const backend = new SharedRateLimitBackend();
    backend.fail = true;
    const app = buildApp(
      '/strict',
      createStrictRateLimiter({
        limit: 2,
        store: new ResilientRateLimitStore('strict-outage-test', backend),
      })
    );

    expect((await request(app).post('/strict')).status).toBe(201);
    expect((await request(app).post('/strict')).status).toBe(201);
    expect((await request(app).post('/strict')).status).toBe(429);
    expect(metricsService.snapshot().redis_rate_limit_fallback_total).toBe(3);
  });

  it('uses the forwarded client address without combining independent clients', async () => {
    const backend = new SharedRateLimitBackend();
    const app = buildApp(
      '/strict',
      createStrictRateLimiter({
        limit: 1,
        store: new ResilientRateLimitStore('proxy-ip-test', backend),
      })
    );

    expect(
      (await request(app).post('/strict').set('x-forwarded-for', '198.51.100.10, 172.20.0.4'))
        .status
    ).toBe(201);
    expect(
      (await request(app).post('/strict').set('x-forwarded-for', '198.51.100.10, 172.20.0.4'))
        .status
    ).toBe(429);
    expect(
      (await request(app).post('/strict').set('x-forwarded-for', '203.0.113.20, 172.20.0.4')).status
    ).toBe(201);
  });
});
