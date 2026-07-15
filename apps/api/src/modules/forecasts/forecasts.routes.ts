import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import { requireAuth, requireRole } from '../../middlewares';

import { listStaffingRecommendations, listWaitForecasts } from './forecasts.controller';

export const forecastsRouter = Router();

forecastsRouter.use(requireAuth, requireRole(UserRole.MANAGER, UserRole.ADMIN));
forecastsRouter.get('/wait', listWaitForecasts);
forecastsRouter.get('/staffing', listStaffingRecommendations);
