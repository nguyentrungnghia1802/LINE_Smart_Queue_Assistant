import { Request, Response } from 'express';

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
  const overview = await staffService.getQueueOverview(queueId);

  reqLog(req).debug({ queueId, waitingCount: overview.waitingCount }, 'staff.overview');

  sendSuccess(res, overview);
});

// ── POST /api/v1/staff/queues/:queueId/call-next ──────────────────────────────

/** Advance the queue — transition the next waiting entry to 'called'. */
export const callNext = asyncHandler(async (req: Request, res: Response) => {
  const { queueId } = req.params as unknown as QueueIdParam;
  const entry = await staffService.callNext(queueId, req.user?.id as string);

  reqLog(req).info({ queueId, entryId: entry.id, ticket: entry.ticket_display }, 'staff.callNext');

  sendSuccess(res, { entry });
});

// ── POST /api/v1/staff/entries/:entryId/serve ─────────────────────────────────

/** Mark a called ticket as serving (customer reached the counter). */
export const serveEntry = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  const entry = await staffService.serve(entryId, req.user?.id as string);

  reqLog(req).info({ entryId, ticket: entry.ticket_display }, 'staff.serve');

  sendSuccess(res, { entry });
});

// ── POST /api/v1/staff/entries/:entryId/complete ──────────────────────────────

/** Mark a serving ticket as completed. */
export const completeEntry = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  const entry = await staffService.complete(entryId, req.user?.id as string);

  reqLog(req).info({ entryId, ticket: entry.ticket_display }, 'staff.complete');

  sendSuccess(res, { entry });
});

// ── POST /api/v1/staff/entries/:entryId/no-show ───────────────────────────────

/** Mark a called entry as no-show (customer did not appear). */
export const noShowEntry = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  const entry = await staffService.markNoShow(entryId, req.user?.id as string);

  reqLog(req).info({ entryId, ticket: entry.ticket_display }, 'staff.noShow');

  sendSuccess(res, { entry });
});

// ── POST /api/v1/staff/entries/:entryId/cancel ───────────────────────────────

/** Cancel any waiting or called ticket as a staff action. */
export const cancelEntry = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  const entry = await staffService.cancelEntry(entryId, req.user?.id as string);

  reqLog(req).info({ entryId, ticket: entry.ticket_display }, 'staff.cancel');

  sendSuccess(res, { entry });
});
