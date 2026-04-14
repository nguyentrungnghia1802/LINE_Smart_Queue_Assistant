/**
 * STUB controllers for customer-facing queue entry operations.
 *
 * All handlers return 501 Not Implemented until domain services are wired up
 * in a future implementation prompt.
 *
 * Pattern mirrors apps/api/src/modules/queues/queues.controller.ts.
 */

import { Request, Response } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';

const NOT_IMPLEMENTED = {
  success: false,
  error: { code: 'NOT_IMPLEMENTED', message: 'STUB: not yet implemented' },
} as const;

// ── POST /api/v1/queue/join ───────────────────────────────────────────────────

/** STUB: Join a queue and receive a ticket. */
export const joinQueue = asyncHandler(async (_req: Request, res: Response) => {
  res.status(501).json(NOT_IMPLEMENTED);
});

// ── GET /api/v1/queue/current ─────────────────────────────────────────────────

/** STUB: Get current live status of a specific queue. */
export const getCurrentQueue = asyncHandler(async (_req: Request, res: Response) => {
  res.status(501).json(NOT_IMPLEMENTED);
});

// ── GET /api/v1/queue/me ──────────────────────────────────────────────────────

/** STUB: Get the authenticated user's active ticket. */
export const getMyTicket = asyncHandler(async (_req: Request, res: Response) => {
  res.status(501).json(NOT_IMPLEMENTED);
});

// ── POST /api/v1/queue/:entryId/cancel ───────────────────────────────────────

/** STUB: Cancel a queue ticket. */
export const cancelTicket = asyncHandler(async (_req: Request, res: Response) => {
  res.status(501).json(NOT_IMPLEMENTED);
});

// ── POST /api/v1/queue/:entryId/skip ─────────────────────────────────────────

/** STUB: Skip a turn — push ticket back one position. */
export const skipTicket = asyncHandler(async (_req: Request, res: Response) => {
  res.status(501).json(NOT_IMPLEMENTED);
});

// ── GET /api/v1/queue/:queueId/status ────────────────────────────────────────

/** STUB: Get real-time status of a queue by its ID (public, no auth required). */
export const getQueueStatus = asyncHandler(async (_req: Request, res: Response) => {
  res.status(501).json(NOT_IMPLEMENTED);
});
