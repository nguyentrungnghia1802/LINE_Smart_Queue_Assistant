import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import {
  authenticatedActionRateLimiter,
  idempotencyMiddleware,
  publicReadRateLimiter,
  requireAuth,
  requireRole,
  strictRateLimiter,
  validate,
} from '../../middlewares';

import {
  callNextTicket,
  cancelTicket,
  completeTicket,
  getCurrentQueue,
  getMyPenalties,
  getMyTicket,
  getQueueStatus,
  getTicketStatus,
  joinQueue,
  serveTicket,
  skipTicket,
} from './queue.controller';
import {
  CurrentQueueQuerySchema,
  EntryIdParamSchema,
  JoinQueueSchema,
  QueueIdParamSchema,
} from './queue.validator';

export const queueEntryRouter = Router();

/**
 * Static routes MUST be declared before parameterised routes to prevent
 * Express matching `/current` or `/me` as `:queueId` or `:entryId`.
 */

// POST /api/v1/queue/join
queueEntryRouter.post(
  '/join',
  strictRateLimiter,
  idempotencyMiddleware(),
  validate(JoinQueueSchema),
  joinQueue
);

// GET /api/v1/queue/current?queueId=<uuid>
queueEntryRouter.get(
  '/current',
  publicReadRateLimiter,
  validate(CurrentQueueQuerySchema, 'query'),
  getCurrentQueue
);

// GET /api/v1/queue/me
queueEntryRouter.get('/me', requireAuth, publicReadRateLimiter, getMyTicket);

// GET /api/v1/queue/me/penalties  — active penalties for the authenticated caller
queueEntryRouter.get('/me/penalties', requireAuth, publicReadRateLimiter, getMyPenalties);

// GET /api/v1/queue/entry/:entryId  (public — no auth required, for guest tracking)
queueEntryRouter.get(
  '/entry/:entryId',
  publicReadRateLimiter,
  validate(EntryIdParamSchema, 'params'),
  getTicketStatus
);

// POST /api/v1/queue/:entryId/cancel
queueEntryRouter.post(
  '/:entryId/cancel',
  requireAuth,
  authenticatedActionRateLimiter,
  validate(EntryIdParamSchema, 'params'),
  cancelTicket
);

// POST /api/v1/queue/:entryId/skip
queueEntryRouter.post(
  '/:entryId/skip',
  requireAuth,
  strictRateLimiter,
  validate(EntryIdParamSchema, 'params'),
  skipTicket
);

// POST /api/v1/queue/:entryId/serve  (staff — mark ticket as serving)
queueEntryRouter.post(
  '/:entryId/serve',
  requireAuth,
  requireRole(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN),
  authenticatedActionRateLimiter,
  validate(EntryIdParamSchema, 'params'),
  serveTicket
);

// POST /api/v1/queue/:entryId/complete  (staff — mark ticket as completed)
queueEntryRouter.post(
  '/:entryId/complete',
  requireAuth,
  requireRole(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN),
  authenticatedActionRateLimiter,
  validate(EntryIdParamSchema, 'params'),
  completeTicket
);

// GET /api/v1/queue/:queueId/status  (public — no auth required)
queueEntryRouter.get(
  '/:queueId/status',
  publicReadRateLimiter,
  validate(QueueIdParamSchema, 'params'),
  getQueueStatus
);

// POST /api/v1/queue/:queueId/call-next  (staff — advance queue)
queueEntryRouter.post(
  '/:queueId/call-next',
  requireAuth,
  requireRole(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN),
  authenticatedActionRateLimiter,
  validate(QueueIdParamSchema, 'params'),
  callNextTicket
);
