import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import { requireAuth, requireRole, validate } from '../../middlewares';

import { streamQueue, streamTicket } from './realtime.controller';
import { RealtimeQueueParamsSchema, RealtimeTicketParamsSchema } from './realtime.validator';

export const realtimeRouter = Router();

realtimeRouter.get(
  '/tickets/:entryId',
  requireAuth,
  requireRole(UserRole.CUSTOMER),
  validate(RealtimeTicketParamsSchema, 'params'),
  streamTicket
);

realtimeRouter.get(
  '/queues/:queueId',
  requireAuth,
  requireRole(UserRole.STAFF, UserRole.MANAGER),
  validate(RealtimeQueueParamsSchema, 'params'),
  streamQueue
);
