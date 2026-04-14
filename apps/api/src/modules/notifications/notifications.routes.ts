import { Router } from 'express';

import { validate } from '../../middlewares';

import { listNotifications } from './notifications.controller';
import { ListNotificationsQuerySchema } from './notifications.validator';

export const notificationsRouter = Router();

notificationsRouter.get('/', validate(ListNotificationsQuerySchema, 'query'), listNotifications);
