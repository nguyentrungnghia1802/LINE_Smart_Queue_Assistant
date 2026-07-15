import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import {
  authenticatedActionRateLimiter,
  publicReadRateLimiter,
  requireAuth,
  requireRole,
  validate,
} from '../../middlewares';

import {
  getManagerBusinessCalendar,
  getManagerOrg,
  getOrgBySlug,
  getOrgByToken,
  updateManagerBusinessCalendar,
  updateManagerOrg,
} from './orgs.controller';
import { BusinessCalendarSchema, UpdateOrgSettingsSchema } from './orgs.validator';

export const orgsRouter = Router();

// Authenticated: manager's org info with publicQrToken
orgsRouter.get('/my-org', requireAuth, getManagerOrg);
orgsRouter.patch(
  '/my-org',
  requireAuth,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  authenticatedActionRateLimiter,
  validate(UpdateOrgSettingsSchema),
  updateManagerOrg
);
orgsRouter.get(
  '/my-org/business-calendar',
  requireAuth,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  getManagerBusinessCalendar
);
orgsRouter.put(
  '/my-org/business-calendar',
  requireAuth,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  authenticatedActionRateLimiter,
  validate(BusinessCalendarSchema),
  updateManagerBusinessCalendar
);

// Public: get org info by QR token (stable token-based routing)
// MUST come before /:slug to avoid collision
orgsRouter.get('/by-token/:token', publicReadRateLimiter, getOrgByToken);

// Public: get org info + queue status + products for customer QR landing
orgsRouter.get('/:slug', publicReadRateLimiter, getOrgBySlug);
