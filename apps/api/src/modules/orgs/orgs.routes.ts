import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import { requireAuth, requireRole, validate } from '../../middlewares';

import { getManagerOrg, getOrgBySlug, getOrgByToken, updateManagerOrg } from './orgs.controller';
import { UpdateOrgSettingsSchema } from './orgs.validator';

export const orgsRouter = Router();

// Authenticated: manager's org info with publicQrToken
orgsRouter.get('/my-org', requireAuth, getManagerOrg);
orgsRouter.patch(
  '/my-org',
  requireAuth,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  validate(UpdateOrgSettingsSchema),
  updateManagerOrg
);

// Public: get org info by QR token (stable token-based routing)
// MUST come before /:slug to avoid collision
orgsRouter.get('/by-token/:token', getOrgByToken);

// Public: get org info + queue status + products for customer QR landing
orgsRouter.get('/:slug', getOrgBySlug);
