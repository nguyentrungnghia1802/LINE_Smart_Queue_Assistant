import { Router } from 'express';

import { listNotifications } from './notifications.controller';

export const notificationsRouter = Router();

notificationsRouter.get('/', listNotifications);
