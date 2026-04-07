import { randomUUID } from 'node:crypto';

import pinoHttp from 'pino-http';

import { logger } from '../utils/logger';

/**
 * pino-http request logging middleware.
 *
 * Uses the `req.id` already set by requestIdMiddleware as the log trace ID.
 * Health check routes are excluded from access logs to reduce noise.
 * Log level is automatically adjusted by response status:
 *   5xx → error, 4xx → warn, 2xx/3xx → info
 */
export const httpLoggerMiddleware = pinoHttp({
  logger,

  // Re-use the request ID already set by requestIdMiddleware.
  genReqId: (req) => (req as { id?: string }).id ?? randomUUID(),

  // Suppress access logs for health/ready probes.
  autoLogging: {
    ignore: (req) => req.url === '/health' || req.url === '/ready',
  },

  customLogLevel: (_req, res, err) => {
    if (err !== undefined || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },

  // Keep request/response serialisers lean.
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
