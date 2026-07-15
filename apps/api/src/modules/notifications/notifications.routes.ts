import { Router } from 'express';

import { requireAuth, validate } from '../../middlewares';

import { listNotifications } from './notifications.controller';
import { ListNotificationsQuerySchema } from './notifications.validator';

export const notificationsRouter = Router();

notificationsRouter.get(
  '/',
  requireAuth,
  validate(ListNotificationsQuerySchema, 'query'),
  listNotifications
);
