import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { config } from './config';
import { swaggerSpec } from './docs/swagger';
import {
  apiRateLimiter,
  currentUserMiddleware,
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

  // ── 6. API docs (swagger-ui) — non-production only ───────────────────────────
  if (config.nodeEnv !== 'production') {
    // Override the global helmet CSP for the docs path so that swagger-ui's
    // inline initialisation script is allowed.  This runs AFTER the global
    // helmet() call and simply overwrites the Content-Security-Policy header
    // for requests that match /api/docs*.
    app.use('/api/docs', (_req: Request, res: Response, next: NextFunction) => {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
      );
      next();
    });

    app.use(
      '/api/docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        customSiteTitle: 'LINE Queue API Docs',
        swaggerOptions: { persistAuthorization: true },
      })
    );

    // Raw JSON spec — useful for Postman collections and CI contract testing
    app.get('/api/docs.json', (_req: Request, res: Response) => {
      res.json(swaggerSpec);
    });
  }

  // ── 7. Health / readiness probes — no auth, no rate-limit ────────────────────
  app.use(healthRouter);

  // ── 8. Rate limiting (/api/*) ────────────────────────────────────────────────
  app.use('/api', apiRateLimiter);

  // ── 9. Identity resolution — populates req.user when a valid JWT is present ──
  app.use(currentUserMiddleware);

  // ── 10. API v1 routes ────────────────────────────────────────────────────────
  app.use('/api/v1', v1Router);

  // ── 11. 404 fallback ─────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ── 12. Global error handler ──────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
