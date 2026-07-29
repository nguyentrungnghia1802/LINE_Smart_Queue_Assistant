import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import {
  authenticatedActionRateLimiter,
  requireAuth,
  requireRole,
  validate,
} from '../../middlewares';
import { BusinessCalendarSchema } from '../orgs/orgs.validator';

import {
  createBranch,
  geocodeBranchAddress,
  getMyBranch,
  getMyBranchBusinessCalendar,
  getOrganizationBranchAnalytics,
  inviteBranchManager,
  listBranches,
  listOrganizationAudit,
  removeBranchManager,
  updateMyBranch,
  updateMyBranchBusinessCalendar,
} from './branches.controller';
import {
  AuditLogQuerySchema,
  BranchGeocodeSchema,
  BranchIdParamSchema,
  BranchManagerParamSchema,
  CreateBranchSchema,
  InviteBranchManagerSchema,
  UpdateMyBranchSchema,
} from './branches.validator';

export const branchesRouter = Router();

branchesRouter.use(requireAuth, requireRole(UserRole.MANAGER));
branchesRouter.get('/me', getMyBranch);
branchesRouter.patch(
  '/me',
  authenticatedActionRateLimiter,
  validate(UpdateMyBranchSchema),
  updateMyBranch
);
branchesRouter.get('/me/business-calendar', getMyBranchBusinessCalendar);
branchesRouter.put(
  '/me/business-calendar',
  authenticatedActionRateLimiter,
  validate(BusinessCalendarSchema),
  updateMyBranchBusinessCalendar
);
branchesRouter.get('/analytics', getOrganizationBranchAnalytics);
branchesRouter.post(
  '/geocode',
  authenticatedActionRateLimiter,
  validate(BranchGeocodeSchema),
  geocodeBranchAddress
);
branchesRouter.get('/', listBranches);
branchesRouter.get('/audit', validate(AuditLogQuerySchema, 'query'), listOrganizationAudit);
branchesRouter.post(
  '/',
  authenticatedActionRateLimiter,
  validate(CreateBranchSchema),
  createBranch
);
branchesRouter.post(
  '/:branchId/managers',
  authenticatedActionRateLimiter,
  validate(BranchIdParamSchema, 'params'),
  validate(InviteBranchManagerSchema),
  inviteBranchManager
);
branchesRouter.delete(
  '/:branchId/managers/:userId',
  authenticatedActionRateLimiter,
  validate(BranchManagerParamSchema, 'params'),
  removeBranchManager
);
