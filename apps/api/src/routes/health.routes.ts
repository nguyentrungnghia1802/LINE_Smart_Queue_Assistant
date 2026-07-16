import { Router } from 'express';

import { config } from '../config';
import { pool } from '../db/client';
import { scheduler } from '../jobs/scheduler';
import { schedulerHealth } from '../jobs/scheduler-lock';
import { metricsService } from '../utils/metrics';
import { sendError } from '../utils/response';

export const healthRouter = Router();

/**
 * GET /health
 * Liveness probe — always returns 200 if the process is running.
 * Does NOT check database connectivity (use /ready for that).
 */
healthRouter.get('/health', async (_req, res) => {
  let dbStatus: 'connected' | 'unreachable' = 'connected';

  try {
    await pool.query('SELECT 1');
  } catch {
    dbStatus = 'unreachable';
  }

  const notificationConfigured = Boolean(
    config.line.channelAccessToken && config.line.channelSecret
  );

  const status = dbStatus === 'connected' ? 'ok' : 'degraded';

  res.status(status === 'ok' ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    api: 'ok',
    db: dbStatus,
    scheduler: {
      ...scheduler.status(),
      jobs: dbStatus === 'connected' ? await schedulerHealth().catch(() => []) : [],
    },
    notificationService: notificationConfigured ? 'configured' : 'not_configured',
  });
});

/**
 * GET /ready
 * Readiness probe — returns 200 only when the DB pool can accept connections.
 * Docker Compose / Kubernetes uses this to determine whether to route traffic.
 */
healthRouter.get('/ready', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', db: 'connected' });
  } catch {
    sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Database not reachable');
  }
});

healthRouter.get('/metrics', (_req, res) => {
  res.type('text/plain').send(metricsService.toPrometheus());
});
