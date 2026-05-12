import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import { requireAuth, requireRole, validate } from '../../middlewares';

import {
  callNext,
  cancelEntry,
  completeEntry,
  getQueueOverview,
  noShowEntry,
  serveEntry,
} from './staff.controller';
import { EntryIdParamSchema, QueueIdParamSchema } from './staff.validator';

export const staffRouter = Router();

// All staff routes require authentication + STAFF or ADMIN role
staffRouter.use(requireAuth, requireRole(UserRole.STAFF, UserRole.ADMIN));

// ── Queue-level actions ───────────────────────────────────────────────────────

// GET /api/v1/staff/queues/:queueId — live queue board
staffRouter.get('/queues/:queueId', validate(QueueIdParamSchema, 'params'), getQueueOverview);

// POST /api/v1/staff/queues/:queueId/call-next — advance queue
staffRouter.post('/queues/:queueId/call-next', validate(QueueIdParamSchema, 'params'), callNext);

// ── Entry-level actions ────────────────────────────────────────────────────────

// POST /api/v1/staff/entries/:entryId/serve
staffRouter.post('/entries/:entryId/serve', validate(EntryIdParamSchema, 'params'), serveEntry);

// POST /api/v1/staff/entries/:entryId/complete
staffRouter.post(
  '/entries/:entryId/complete',
  validate(EntryIdParamSchema, 'params'),
  completeEntry
);

// POST /api/v1/staff/entries/:entryId/no-show
staffRouter.post('/entries/:entryId/no-show', validate(EntryIdParamSchema, 'params'), noShowEntry);

// POST /api/v1/staff/entries/:entryId/cancel
staffRouter.post('/entries/:entryId/cancel', validate(EntryIdParamSchema, 'params'), cancelEntry);
