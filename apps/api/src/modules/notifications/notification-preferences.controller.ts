import type { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';

import { notificationPreferencesRepository } from './notification-preferences.repository';
import type { UpdateNotificationPreferencesDto } from './notification-preferences.validator';

export const getNotificationPreferences = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const preferences = await notificationPreferencesRepository.findByUser(req.user.id);
  sendSuccess(
    res,
    preferences ?? {
      notification_enabled: false,
      approaching_enabled: true,
      called_enabled: true,
      lifecycle_enabled: true,
      follow_state: 'unknown',
    }
  );
});

export const updateNotificationPreferences = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.lineUserId) throw AppError.conflict('Verified LINE account is required');
  const dto = req.body as UpdateNotificationPreferencesDto;
  const preferences = await notificationPreferencesRepository.updateForVerifiedUser({
    userId: req.user.id,
    lineUserId: req.user.lineUserId,
    ...dto,
  });
  sendSuccess(res, preferences);
});
