import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';

/**
 * Global Express error handler — must be registered LAST in app.ts.
 *
 * Handles three error types in priority order:
 *   1. ZodError      → 422 Unprocessable Entity with flattened field errors
 *   2. AppError      → HTTP status + code from the thrown error (operational)
 *   3. Unknown       → 500 Internal Server Error; details are NOT sent to client
 *
 * All unexpected errors are logged to pino with full stack trace.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  // ── Zod validation error ──────────────────────────────────────────────────
  if (err instanceof ZodError) {
    // Build fieldErrors map from issues (replaces deprecated err.flatten())
    const fieldErrors = err.issues.reduce<Record<string, string[]>>((acc, issue) => {
      if (issue.path.length > 0) {
        const key = String(issue.path[0]);
        (acc[key] ??= []).push(issue.message);
      }
      return acc;
    }, {});
    sendError(res, 422, 'VALIDATION_ERROR', 'Request validation failed', { fieldErrors });
    return;
  }

  // ── Operational app error ─────────────────────────────────────────────────
  if (err instanceof AppError && err.isOperational) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // ── Unexpected / programming error ────────────────────────────────────────
  const requestLog = (req as { log?: typeof logger }).log ?? logger;
  requestLog.error({ err, requestId: req.id }, 'Unhandled error');

  sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}
