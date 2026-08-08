import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { logger } from '../../utils/logger';
import { sendSuccess } from '../../utils/response';
import { requireBranchOperator } from '../branches/branch-scope';

import { staffService } from './staff.service';
import { EntryIdParam, MyQueueQuery, QueueIdParam } from './staff.validator';

// ── Logging helper ────────────────────────────────────────────────────────────

function reqLog(req: Request) {
  return (req as { log?: typeof logger }).log ?? logger;
}

function assignedStaffQueueId(req: Request): string | undefined {
  if (req.user?.role !== 'staff') return undefined;
  if (!req.user.assignedQueueId) {
    throw AppError.forbidden('Staff account has no active queue assignment');
  }
  return req.user.assignedQueueId;
}

export const getMyBranch = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchOperator(req.user);
  sendSuccess(
    res,
    await staffService.getMyBranch(scope.organizationId, scope.branchId, assignedStaffQueueId(req))
  );
});

// ── GET /api/v1/staff/queues/:queueId ─────────────────────────────────────────

/** Staff queue overview — waiting list, called entry, serving entry. */
export const getQueueOverview = asyncHandler(async (req: Request, res: Response) => {
  const { queueId } = req.params as unknown as QueueIdParam;
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchOperator(req.user);
  const overview = await staffService.getQueueOverview(
    queueId,
    scope.organizationId,
    [scope.branchId],
    assignedStaffQueueId(req)
  );

  reqLog(req).debug({ queueId, waitingCount: overview.waitingCount }, 'staff.overview');

  sendSuccess(res, overview);
});

// ── POST /api/v1/staff/queues/:queueId/call-next ──────────────────────────────

/** Advance the queue — transition the next waiting entry to 'called'. */
export const callNext = asyncHandler(async (req: Request, res: Response) => {
  const { queueId } = req.params as unknown as QueueIdParam;
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchOperator(req.user);
  const entry = await staffService.callNext(
    queueId,
    scope.actorId,
    scope.organizationId,
    [scope.branchId],
    assignedStaffQueueId(req)
  );

  reqLog(req).info({ queueId, entryId: entry.id, ticket: entry.ticket_code }, 'staff.callNext');

  sendSuccess(res, { entry });
});

// ── POST /api/v1/staff/entries/:entryId/serve ─────────────────────────────────

/** Mark a called ticket as serving (customer reached the counter). */
export const serveEntry = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchOperator(req.user);
  const entry = await staffService.serve(
    entryId,
    scope.actorId,
    scope.organizationId,
    [scope.branchId],
    assignedStaffQueueId(req)
  );

  reqLog(req).info({ entryId, ticket: entry.ticket_code }, 'staff.serve');

  sendSuccess(res, { entry });
});

// ── POST /api/v1/staff/entries/:entryId/complete ──────────────────────────────

/** Mark a serving ticket as completed. */
export const completeEntry = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchOperator(req.user);
  const entry = await staffService.complete(
    entryId,
    scope.actorId,
    scope.organizationId,
    [scope.branchId],
    assignedStaffQueueId(req)
  );

  reqLog(req).info({ entryId, ticket: entry.ticket_code }, 'staff.complete');

  sendSuccess(res, { entry });
});

// ── POST /api/v1/staff/entries/:entryId/defer ────────────────────────────────

/** Return a called ticket to the back of the current waiting queue. */
export const deferEntry = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchOperator(req.user);
  const entry = await staffService.deferCalled(
    entryId,
    scope.actorId,
    scope.organizationId,
    [scope.branchId],
    assignedStaffQueueId(req)
  );

  reqLog(req).info({ entryId, ticket: entry.ticket_code }, 'staff.defer');

  sendSuccess(res, { entry });
});

// ── POST /api/v1/staff/entries/:entryId/no-show ───────────────────────────────

/** Mark a called entry as no-show (customer did not appear). */
export const noShowEntry = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchOperator(req.user);
  const entry = await staffService.markNoShow(
    entryId,
    scope.actorId,
    scope.organizationId,
    [scope.branchId],
    assignedStaffQueueId(req)
  );

  reqLog(req).info({ entryId, ticket: entry.ticket_code }, 'staff.noShow');

  sendSuccess(res, { entry });
});

// ── POST /api/v1/staff/entries/:entryId/cancel ───────────────────────────────

/** Cancel any waiting or called ticket as a staff action. */
export const cancelEntry = asyncHandler(async (req: Request, res: Response) => {
  const { entryId } = req.params as unknown as EntryIdParam;
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchOperator(req.user);
  const entry = await staffService.cancelEntry(
    entryId,
    scope.actorId,
    scope.organizationId,
    [scope.branchId],
    assignedStaffQueueId(req)
  );

  reqLog(req).info({ entryId, ticket: entry.ticket_code }, 'staff.cancel');

  sendSuccess(res, { entry });
});

// ── GET /api/v1/staff/my-queue ────────────────────────────────────────────────

/** Staff queue overview enriched with orders — one request for the full dashboard. */
export const getMyQueue = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchOperator(req.user);

  const overview = await staffService.getMyQueueOverview(
    scope.organizationId,
    [scope.branchId],
    req.user.role === 'staff' ? undefined : (req.query as MyQueueQuery).queueId,
    assignedStaffQueueId(req)
  );

  reqLog(req).debug(
    {
      orgId: scope.organizationId,
      waitingCount: overview?.waitingCount ?? 0,
      totalActiveCount: overview?.totalActiveCount ?? 0,
    },
    'staff.myQueue'
  );

  sendSuccess(
    res,
    overview ?? {
      queueId: null,
      queueName: null,
      availableQueues: [],
      orgId: scope.organizationId,
      waitingEntriesWithOrders: [],
      calledEntryWithOrder: null,
      servingEntryWithOrder: null,
      waitingCount: 0,
      totalActiveCount: 0,
    }
  );
});
