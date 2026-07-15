import { Request, Response } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';

import { notificationOperationsService } from './notification-operations.service';
import { notificationsService } from './notifications.service';

/**
 * GET /api/v1/notifications
 * Returns the authenticated user's recent notifications.
 */
export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id ?? '';
  const notifications = await notificationsService.listForUser(userId);
  sendSuccess(res, notifications);
});

export const listNotificationOperations = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const data = await notificationOperationsService.list({
    organizationId: req.user?.role === 'admin' ? undefined : req.user?.organizationId,
    status: req.query.status as never,
    page,
    limit,
  });
  sendSuccess(res, data);
});

export const retryNotification = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new Error('Authenticated user context is missing');
  const data = await notificationOperationsService.retry({
    id: req.params.id,
    organizationId: req.user?.role === 'admin' ? undefined : req.user?.organizationId,
    actorId: req.user.id,
    note: req.body.note,
  });
  sendSuccess(res, data);
});

export const cancelNotification = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new Error('Authenticated user context is missing');
  const data = await notificationOperationsService.cancel({
    id: req.params.id,
    organizationId: req.user?.role === 'admin' ? undefined : req.user?.organizationId,
    actorId: req.user.id,
    note: req.body.note,
  });
  sendSuccess(res, data);
});
