import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { logger } from '../../utils/logger';
import { sendSuccess } from '../../utils/response';

import { staffService } from './staff.service';
import { EntryIdParam, QueueIdParam } from './staff.validator';

// ── Logging helper ────────────────────────────────────────────────────────────

function reqLog(req: Request) {
  return (req as { log?: typeof logger }).log ?? logger;
}

// ── GET /api/v1/staff/queues/:queueId ─────────────────────────────────────────

/** Staff queue overview — waiting list, called entry, serving entry. */
export const getQueueOverview = asyncHandler(async (req: Request, res: Response) => {
  const { queueId } = req.params as unknown as QueueIdParam;
  const overview = await staffService.getQueueOverview(queueId, req.user?.organizationId);

  reqLog(req).debug({ queueId, waitingCount: overview.waitingCount }, 'staff.overview');

  sendSuccess(res, overview);
});

// ── POST /api/v1/staff/queues/:queueId/call-next ──────────────────────────────

/** Advance the queue — transition the next waiting entry to 'called'. */
export const callNext = asyncHandler(async (req: Request, res: Response) => {
  const { queueId } = req.params as unknown as QueueIdParam;
  if (!req.user) throw AppError.unauthorized();
  const entry = await staffService.callNext(queueId, req.user.id, req.user.organizationId);

  reqLog(req).info({ queueId, entryId: entry.id, ticket: entry.ticket_display }, 'staff.callNext');

  sendSuccess(res, { entry });
});

// ── POST /api/v1/staff/entries/:entryId/serve ─────────────────────────────────

/** Mark a called ticket as serving (customer reached the counter). */
export const serveEntry = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  if (!req.user) throw AppError.unauthorized();
  const entry = await staffService.serve(entryId, req.user.id, req.user.organizationId);

  reqLog(req).info({ entryId, ticket: entry.ticket_display }, 'staff.serve');

  sendSuccess(res, { entry });
});

// ── POST /api/v1/staff/entries/:entryId/complete ──────────────────────────────

/** Mark a serving ticket as completed. */
export const completeEntry = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  if (!req.user) throw AppError.unauthorized();
  const entry = await staffService.complete(entryId, req.user.id, req.user.organizationId);

  reqLog(req).info({ entryId, ticket: entry.ticket_display }, 'staff.complete');

  sendSuccess(res, { entry });
});

// ── POST /api/v1/staff/entries/:entryId/no-show ───────────────────────────────

/** Mark a called entry as no-show (customer did not appear). */
export const noShowEntry = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  if (!req.user) throw AppError.unauthorized();
  const entry = await staffService.markNoShow(entryId, req.user.id, req.user.organizationId);

  reqLog(req).info({ entryId, ticket: entry.ticket_display }, 'staff.noShow');

  sendSuccess(res, { entry });
});

// ── POST /api/v1/staff/entries/:entryId/cancel ───────────────────────────────

/** Cancel any waiting or called ticket as a staff action. */
export const cancelEntry = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  if (!req.user) throw AppError.unauthorized();
  const entry = await staffService.cancelEntry(entryId, req.user.id, req.user.organizationId);

  reqLog(req).info({ entryId, ticket: entry.ticket_display }, 'staff.cancel');

  sendSuccess(res, { entry });
});

// ── GET /api/v1/staff/my-queue ────────────────────────────────────────────────

/** Staff queue overview enriched with orders — one request for the full dashboard. */
export const getMyQueue = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res
      .status(400)
      .json({ success: false, error: { code: 'NO_ORG', message: 'User has no organization' } });
    return;
  }

  const overview = await staffService.getMyQueueOverview(orgId);

  reqLog(req).debug({ orgId, waitingCount: overview?.waitingCount ?? 0 }, 'staff.myQueue');

  sendSuccess(
    res,
    overview ?? {
      queueId: null,
      queueName: null,
      orgId,
      waitingEntriesWithOrders: [],
      calledEntryWithOrder: null,
      servingEntryWithOrder: null,
      waitingCount: 0,
    }
  );
});
