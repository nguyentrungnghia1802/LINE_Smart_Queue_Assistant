import { randomUUID } from 'node:crypto';

import { NextFunction, Request, Response } from 'express';

/**
 * Attach a unique trace ID to every request.
 *
 * Behaviour:
 *   - Reads `X-Request-ID` header if provided by upstream proxy/load-balancer.
 *   - Otherwise generates a new UUID v4.
 *   - Writes the ID back on the response as `X-Request-ID`.
 *   - Stores it on `req.id` for pino-http and downstream middleware to consume.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const fromHeader = req.headers['x-request-id'];
  req.id = typeof fromHeader === 'string' && fromHeader.length > 0 ? fromHeader : randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
}
