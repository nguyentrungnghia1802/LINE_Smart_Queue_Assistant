import { Router } from 'express';

import { strictRateLimiter, validate } from '../../middlewares';

import {
  cancelTicket,
  getCurrentQueue,
  getMyTicket,
  getQueueStatus,
  joinQueue,
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
queueEntryRouter.post('/join', strictRateLimiter, validate(JoinQueueSchema), joinQueue);

// GET /api/v1/queue/current?queueId=<uuid>
queueEntryRouter.get('/current', validate(CurrentQueueQuerySchema, 'query'), getCurrentQueue);

// GET /api/v1/queue/me
queueEntryRouter.get('/me', getMyTicket);

// POST /api/v1/queue/:entryId/cancel
queueEntryRouter.post('/:entryId/cancel', validate(EntryIdParamSchema, 'params'), cancelTicket);

// POST /api/v1/queue/:entryId/skip
queueEntryRouter.post(
  '/:entryId/skip',
  strictRateLimiter,
  validate(EntryIdParamSchema, 'params'),
  skipTicket
);

// GET /api/v1/queue/:queueId/status  (public — no auth required)
queueEntryRouter.get('/:queueId/status', validate(QueueIdParamSchema, 'params'), getQueueStatus);
