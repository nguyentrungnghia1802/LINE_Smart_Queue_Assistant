import cors from 'cors';
import express, { Application } from 'express';
import helmet from 'helmet';

import { config } from './config';
import {
  apiRateLimiter,
  errorHandler,
  httpLoggerMiddleware,
  notFoundHandler,
  requestIdMiddleware,
} from './middlewares';
import { healthRouter } from './routes/health.routes';
import { v1Router } from './routes/v1.routes';

export function createApp(): Application {
  const app = express();

  // Trust first proxy hop so req.ip reflects real client IP behind Docker/nginx.
  app.set('trust proxy', 1);

  // ── 1. Security headers ──────────────────────────────────────────────────────
  app.use(helmet());

  // ── 2. CORS ──────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  );

  // ── 3. Request ID ────────────────────────────────────────────────────────────
  app.use(requestIdMiddleware);

  // ── 4. HTTP request logging (pino-http) ──────────────────────────────────────
  app.use(httpLoggerMiddleware);

  // ── 5. Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ── 6. Health / readiness probes — no auth, no rate-limit ────────────────────
  app.use(healthRouter);

  // ── 7. Rate limiting (/api/*) ────────────────────────────────────────────────
  app.use('/api', apiRateLimiter);

  // ── 8. API v1 routes ─────────────────────────────────────────────────────────
  app.use('/api/v1', v1Router);

  // ── 9. 404 fallback ──────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ── 10. Global error handler ─────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
