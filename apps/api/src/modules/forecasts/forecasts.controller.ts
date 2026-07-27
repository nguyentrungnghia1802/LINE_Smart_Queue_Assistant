import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { requireBranchManager } from '../branches/branch-scope';

import { forecastsService } from './forecasts.service';

export const listWaitForecasts = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchManager(req.user);
  sendSuccess(res, await forecastsService.listWait(scope.organizationId, scope.branchId));
});

export const listStaffingRecommendations = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchManager(req.user);
  sendSuccess(res, await forecastsService.listStaffing(scope.organizationId, scope.branchId));
});
