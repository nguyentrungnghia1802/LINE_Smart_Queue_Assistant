import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import {
  authenticatedActionRateLimiter,
  requireAuth,
  requireRole,
  validate,
} from '../../middlewares';

import {
  callNext,
  cancelEntry,
  completeEntry,
  getMyQueue,
  getQueueOverview,
  noShowEntry,
  serveEntry,
} from './staff.controller';
import { EntryIdParamSchema, QueueIdParamSchema } from './staff.validator';

export const staffRouter = Router();

// All staff routes require authentication + STAFF, MANAGER, or ADMIN role
staffRouter.use(requireAuth, requireRole(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN));

// ── My-Queue endpoint ──────────────────────────────────────────────────────────

// GET /api/v1/staff/my-queue — full queue overview for staff's org
staffRouter.get('/my-queue', getMyQueue);

// ── Queue-level actions ───────────────────────────────────────────────────────

// GET /api/v1/staff/queues/:queueId — live queue board
staffRouter.get('/queues/:queueId', validate(QueueIdParamSchema, 'params'), getQueueOverview);

// POST /api/v1/staff/queues/:queueId/call-next — advance queue
staffRouter.post(
  '/queues/:queueId/call-next',
  authenticatedActionRateLimiter,
  validate(QueueIdParamSchema, 'params'),
  callNext
);

// ── Entry-level actions ────────────────────────────────────────────────────────

// POST /api/v1/staff/entries/:entryId/serve
staffRouter.post(
  '/entries/:entryId/serve',
  authenticatedActionRateLimiter,
  validate(EntryIdParamSchema, 'params'),
  serveEntry
);

// POST /api/v1/staff/entries/:entryId/complete
staffRouter.post(
  '/entries/:entryId/complete',
  authenticatedActionRateLimiter,
  validate(EntryIdParamSchema, 'params'),
  completeEntry
);

// POST /api/v1/staff/entries/:entryId/no-show
staffRouter.post(
  '/entries/:entryId/no-show',
  authenticatedActionRateLimiter,
  validate(EntryIdParamSchema, 'params'),
  noShowEntry
);

// POST /api/v1/staff/entries/:entryId/cancel
staffRouter.post(
  '/entries/:entryId/cancel',
  authenticatedActionRateLimiter,
  validate(EntryIdParamSchema, 'params'),
  cancelEntry
);
