import { Router } from 'express';

import { strictRateLimiter } from '../../middlewares';
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

queuesRouter.get('/', listQueues);
queuesRouter.get('/:id', validate(UUIDParamSchema, 'params'), getQueue);

queuesRouter.post('/', strictRateLimiter, validate(CreateQueueSchema), createQueue);

queuesRouter.patch(
  '/:id',
  validate(UUIDParamSchema, 'params'),
  validate(UpdateQueueSchema),
  updateQueue
);

queuesRouter.patch(
  '/:id/status',
  validate(UUIDParamSchema, 'params'),
  validate(UpdateQueueStatusSchema),
  updateQueueStatus
);

queuesRouter.delete('/:id', validate(UUIDParamSchema, 'params'), deleteQueue);
