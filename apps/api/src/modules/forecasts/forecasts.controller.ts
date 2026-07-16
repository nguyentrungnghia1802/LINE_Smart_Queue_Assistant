import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';

import { forecastsService } from './forecasts.service';

function organizationId(req: Request) {
  if (!req.user?.organizationId) throw AppError.badRequest('Organization is not configured');
  return req.user.organizationId;
}

export const listWaitForecasts = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await forecastsService.listWait(organizationId(req)));
});

export const listStaffingRecommendations = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await forecastsService.listStaffing(organizationId(req)));
});
