import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import {
  authenticatedActionRateLimiter,
  requireAuth,
  requireRole,
  validate,
} from '../../middlewares';

import {
  getDashboard,
  getOperationalHealth,
  listManagers,
  listOrganizations,
  removeOrganization,
  updateOwnerEmail,
} from './admin.controller';
import {
  AdminOrgIdParamSchema,
  AdminOrgManagerParamSchema,
  UpdateOwnerEmailSchema,
} from './admin.validator';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(UserRole.ADMIN));

adminRouter.get('/dashboard', getDashboard);
adminRouter.get('/operations/health', getOperationalHealth);
adminRouter.get('/organizations', listOrganizations);
adminRouter.delete(
  '/organizations/:orgId',
  authenticatedActionRateLimiter,
  validate(AdminOrgIdParamSchema, 'params'),
  removeOrganization
);
adminRouter.get(
  '/organizations/:orgId/managers',
  validate(AdminOrgIdParamSchema, 'params'),
  listManagers
);
adminRouter.patch(
  '/organizations/:orgId/managers/:userId',
  authenticatedActionRateLimiter,
  validate(AdminOrgManagerParamSchema, 'params'),
  validate(UpdateOwnerEmailSchema),
  updateOwnerEmail
);
