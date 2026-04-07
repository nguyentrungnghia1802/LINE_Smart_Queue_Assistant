import { Request, Response } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';

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
