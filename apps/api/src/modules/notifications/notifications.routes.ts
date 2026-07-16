import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import { requireAuth, requireRole, validate } from '../../middlewares';

import {
  cancelNotification,
  listNotificationOperations,
  listNotifications,
  retryNotification,
} from './notifications.controller';
import {
  ListNotificationOperationsQuerySchema,
  ListNotificationsQuerySchema,
  NotificationOperationBodySchema,
  NotificationOperationParamsSchema,
} from './notifications.validator';

export const notificationsRouter = Router();

notificationsRouter.get(
  '/operations',
  requireAuth,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  validate(ListNotificationOperationsQuerySchema, 'query'),
  listNotificationOperations
);
notificationsRouter.post(
  '/operations/:id/retry',
  requireAuth,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  validate(NotificationOperationParamsSchema, 'params'),
  validate(NotificationOperationBodySchema),
  retryNotification
);
notificationsRouter.post(
  '/operations/:id/cancel',
  requireAuth,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  validate(NotificationOperationParamsSchema, 'params'),
  validate(NotificationOperationBodySchema),
  cancelNotification
);

notificationsRouter.get(
  '/',
  requireAuth,
  validate(ListNotificationsQuerySchema, 'query'),
  listNotifications
);
