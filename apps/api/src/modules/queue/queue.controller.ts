import { Request, Response } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import { logger } from '../../utils/logger';
import { sendCreated, sendSuccess } from '../../utils/response';

import { queueService } from './queue.service';
import { CurrentQueueQuery, EntryIdParam, JoinQueueDto, QueueIdParam } from './queue.validator';

// ── Logging helpers ───────────────────────────────────────────────────────────

/**
 * Resolve the request-scoped pino-http logger attached by httpLoggerMiddleware.
 * Falls back to the module-level logger for defensive safety (e.g. tests that
 * bypass the middleware stack).
 */
function reqLog(req: Request) {
  return (req as { log?: typeof logger }).log ?? logger;
}

// ── POST /api/v1/queue/join ───────────────────────────────────────────────────

/**
 * Join a queue and receive a ticket.
 * Returns 201 for a brand-new ticket, 200 when the caller already had an
 * active ticket (idempotent retry).
 */
export const joinQueue = asyncHandler(async (req: Request, res: Response) => {
  const dto = req.body as JoinQueueDto;
  const result = await queueService.joinQueue({
    ...dto,
    userId: req.user?.id,
    // Prefer the lineUserId from the JWT; fall back to the body value for
    // anonymous LIFF users who have a LINE UID but no backend session yet.
    lineUserId: req.user?.lineUserId ?? dto.lineUserId,
  });

  reqLog(req).info(
    {
      queueId: dto.queueId,
      ticket: result.entry.ticket_display,
      aheadCount: result.aheadCount,
      isExisting: result.isExisting,
    },
    'queue.join'
  );

  if (result.isExisting) {
    sendSuccess(res, result);
  } else {
    sendCreated(res, result);
  }
});

// ── GET /api/v1/queue/current ─────────────────────────────────────────────────

/** Get current live status of a specific queue (public). */
export const getCurrentQueue = asyncHandler(async (req: Request, res: Response) => {
  const { queueId } = req.query as unknown as CurrentQueueQuery;
  const result = await queueService.getQueueStatus(queueId);

  reqLog(req).debug({ queueId, waitingCount: result.waitingCount }, 'queue.currentStatus');

  sendSuccess(res, result);
});

// ── GET /api/v1/queue/me ──────────────────────────────────────────────────────

/** Return all active tickets the caller holds across queues. */
export const getMyTicket = asyncHandler(async (req: Request, res: Response) => {
  const result = await queueService.getMyTickets({
    userId: req.user?.id,
    lineUserId: req.user?.lineUserId,
  });

  reqLog(req).debug({ ticketCount: result.length }, 'queue.myTickets');

  sendSuccess(res, result);
});

// ── POST /api/v1/queue/:entryId/cancel ───────────────────────────────────────

/** Cancel a queue ticket. Caller must own the ticket. */
export const cancelTicket = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  await queueService.cancelTicket({
    entryId,
    actorUserId: req.user?.id,
    actorLineUserId: req.user?.lineUserId,
  });
  sendSuccess(res, { cancelled: true });
});

// ── POST /api/v1/queue/:entryId/skip ─────────────────────────────────────────

/** Customer self-service skip — push own ticket back one position. */
export const skipTicket = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  const result = await queueService.skipTicket({
    entryId,
    actorUserId: req.user?.id,
    actorLineUserId: req.user?.lineUserId,
  });
  sendSuccess(res, result);
});

// ── GET /api/v1/queue/:queueId/status ────────────────────────────────────────

/** Real-time status of a queue by ID (public, no auth required). */
export const getQueueStatus = asyncHandler(async (req: Request, res: Response) => {
  const { queueId } = req.params as unknown as QueueIdParam;
  const result = await queueService.getQueueStatus(queueId);

  reqLog(req).debug({ queueId, waitingCount: result.waitingCount }, 'queue.status');

  sendSuccess(res, result);
});
