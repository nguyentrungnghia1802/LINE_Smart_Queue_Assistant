import { Router } from 'express';

import { pool } from '../db/client';
import { sendError } from '../utils/response';

export const healthRouter = Router();

/**
 * GET /health
 * Liveness probe — always returns 200 if the process is running.
 * Does NOT check database connectivity (use /ready for that).
 */
healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
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
