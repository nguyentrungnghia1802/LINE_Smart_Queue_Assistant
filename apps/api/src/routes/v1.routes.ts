import { Router } from 'express';

import { lineRouter } from '../modules/line/line.routes';
import { notificationsRouter } from '../modules/notifications/notifications.routes';
import { queuesRouter } from '../modules/queues/queues.routes';
import { usersRouter } from '../modules/users/users.routes';

/**
 * /api/v1 router
 *
 * Module routers are mounted here. Add new modules as they are implemented.
 */
export const v1Router = Router();

v1Router.use('/queues', queuesRouter);
v1Router.use('/users', usersRouter);
v1Router.use('/notifications', notificationsRouter);
v1Router.use('/line', lineRouter);
