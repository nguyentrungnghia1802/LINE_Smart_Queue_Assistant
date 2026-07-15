import { describe, expect, it } from '@jest/globals';
import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import { UserRole } from '@line-queue/shared';

import { authenticatedActionRateLimiter, publicWriteRateLimiter } from '../rateLimiter.middleware';

function buildApp(routePath: string, middleware: express.RequestHandler, withUser = false) {
  const app = express();

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
});
