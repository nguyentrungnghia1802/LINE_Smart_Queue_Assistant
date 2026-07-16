import type { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';

import { locationService } from './location.service';

function userId(req: Request): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.id;
}

export const getLocationConsent = asyncHandler(async (req: Request, res: Response) => {
  const consent = await locationService.getConsent(userId(req));
  sendSuccess(res, consent ?? { enabled: false, consented_at: null, revoked_at: null });
});

export const updateLocationConsent = asyncHandler(async (req: Request, res: Response) => {
  const consent = await locationService.setConsent(userId(req), req.body.enabled, 'liff_settings');
  sendSuccess(res, consent);
});

export const deleteLocationData = asyncHandler(async (req: Request, res: Response) => {
  const deletedSnapshots = await locationService.revokeAndDelete(userId(req));
  sendSuccess(res, { deletedSnapshots });
});
