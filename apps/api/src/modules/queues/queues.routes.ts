import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import {
  authenticatedActionRateLimiter,
  requireAuth,
  requireRole,
  strictRateLimiter,
} from '../../middlewares';
import { validate } from '../../middlewares/validate.middleware';
import { UUIDParamSchema } from '../shared/shared.validator';

import {
  createQueue,
  deleteQueue,
  getQueue,
  listQueues,
  updateQueue,
  updateQueueStatus,
} from './queues.controller';
import { CreateQueueSchema, UpdateQueueSchema, UpdateQueueStatusSchema } from './queues.validator';

export const queuesRouter = Router();

// All queue management routes require authentication + MANAGER or ADMIN role
queuesRouter.use(requireAuth, requireRole(UserRole.MANAGER, UserRole.ADMIN));

queuesRouter.get('/', listQueues);
queuesRouter.get('/:id', validate(UUIDParamSchema, 'params'), getQueue);

queuesRouter.post('/', strictRateLimiter, validate(CreateQueueSchema), createQueue);

queuesRouter.patch(
  '/:id',
  authenticatedActionRateLimiter,
  validate(UUIDParamSchema, 'params'),
  validate(UpdateQueueSchema),
  updateQueue
);

queuesRouter.patch(
  '/:id/status',
  authenticatedActionRateLimiter,
  validate(UUIDParamSchema, 'params'),
  validate(UpdateQueueStatusSchema),
  updateQueueStatus
);

queuesRouter.delete(
  '/:id',
  authenticatedActionRateLimiter,
  validate(UUIDParamSchema, 'params'),
  deleteQueue
);
