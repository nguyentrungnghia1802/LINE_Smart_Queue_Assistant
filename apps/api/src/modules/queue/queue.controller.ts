import { Request, Response } from 'express';

import { UserRole } from '@line-queue/shared';

import { sanitizeTelemetryValue } from '../../observability/sanitization';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { logger } from '../../utils/logger';
import { sendCreated, sendSuccess } from '../../utils/response';
import { requireBranchOperator } from '../branches/branch-scope';
import { skipPenaltyService } from '../skip-penalty/skip-penalty.service';

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

function reportQueueTransitionFailure(
  req: Request,
  error: unknown,
  context: Record<string, unknown>
): void {
  reqLog(req).error(
    { err: sanitizeTelemetryValue(error), ...context, requestId: req.id },
    'queue.transition.failed'
  );
}

// ── POST /api/v1/queue/join ───────────────────────────────────────────────────

/**
 * Join a queue and receive a ticket.
 * Returns 201 for a brand-new ticket, 200 when the caller already had an
 * active ticket (idempotent retry).
 */
export const joinQueue = asyncHandler(async (req: Request, res: Response) => {
  if (req.user && req.user.role !== UserRole.CUSTOMER) {
    throw new AppError(
      'Customer account is required to join a queue',
      403,
      'CUSTOMER_ACCOUNT_REQUIRED'
    );
  }

  const dto: JoinQueueDto = req.body;
  const joinRequest: Parameters<typeof queueService.joinQueue>[0] = {
    ...dto,
    userId: req.user?.id,
    lineUserId: req.user?.lineUserId,
  };
  let result: Awaited<ReturnType<typeof queueService.joinQueue>>;
  try {
    result = await queueService.joinQueue(joinRequest);
  } catch (error) {
    reqLog(req).error(
      { err: sanitizeTelemetryValue(error), queueId: dto.queueId, requestId: req.id },
      'queue.join.failed'
    );
    throw error;
  }

  reqLog(req).info(
    {
      queueId: dto.queueId,
      ticket: result.entry.ticket_code,
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

// ── POST /api/v1/queue/:queueId/call-next  (staff) ───────────────────────────

/**
 * Call the next waiting ticket in a queue.
 *
 * Staff-only action. Transitions the next waiting entry to `called` and
 * sends a LINE push message to the ticket holder. Also fires an ETA warning
 * push to the entry now first-in-line.
 *
 * Returns the entry that was called.
 */
export const callNextTicket = asyncHandler(async (req: Request, res: Response) => {
  const { queueId } = req.params as unknown as QueueIdParam;
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchOperator(req.user);
  let entry: Awaited<ReturnType<typeof queueService.callNextTicket>>;
  try {
    entry = await queueService.callNextTicket(queueId, scope.organizationId, scope.branchId);
  } catch (error) {
    reportQueueTransitionFailure(req, error, { action: 'call_next', queueId });
    throw error;
  }

  reqLog(req).info({ queueId, entryId: entry.id, ticket: entry.ticket_code }, 'queue.callNext');

  sendSuccess(res, { entry });
});

// ── POST /api/v1/queue/:entryId/serve  (staff) ───────────────────────────────

/** Mark a called ticket as serving (customer reached the counter). */
export const serveTicket = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchOperator(req.user);
  let entry: Awaited<ReturnType<typeof queueService.serveTicket>>;
  try {
    entry = await queueService.serveTicket({
      entryId,
      actorUserId: scope.actorId,
      actorOrganizationId: scope.organizationId,
      actorBranchId: scope.branchId,
    });
  } catch (error) {
    reportQueueTransitionFailure(req, error, { action: 'serve', entryId });
    throw error;
  }

  reqLog(req).info({ entryId, ticket: entry.ticket_code }, 'queue.serve');

  sendSuccess(res, { entry });
});

// ── POST /api/v1/queue/:entryId/complete  (staff) ────────────────────────────

/** Mark a serving ticket as completed and archive to history. */
export const completeTicket = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchOperator(req.user);
  let entry: Awaited<ReturnType<typeof queueService.completeTicket>>;
  try {
    entry = await queueService.completeTicket({
      entryId,
      actorUserId: scope.actorId,
      actorOrganizationId: scope.organizationId,
      actorBranchId: scope.branchId,
    });
  } catch (error) {
    reportQueueTransitionFailure(req, error, { action: 'complete', entryId });
    throw error;
  }

  reqLog(req).info({ entryId, ticket: entry.ticket_code }, 'queue.complete');

  sendSuccess(res, { entry });
});

// ── GET /api/v1/queue/me/penalties ────────────────────────────────────────────

/** Return all active penalties for the authenticated caller. */
export const getMyPenalties = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;

  if (!userId) {
    reqLog(req).warn('queue.myPenalties.unauthorized');
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const penalties = await skipPenaltyService.getActivePenalties({
    userId,
  });

  reqLog(req).debug({ penaltyCount: penalties.length }, 'queue.myPenalties');

  sendSuccess(res, penalties);
});

// ── GET /api/v1/queue/entry/:entryId ─────────────────────────────────────────

/** Customer-owned ticket status used by authenticated LIFF deep links. */
export const getTicketStatus = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  const result = await queueService.getTicketStatus(entryId, req.user?.id, req.user?.lineUserId);
  sendSuccess(res, result);
});
