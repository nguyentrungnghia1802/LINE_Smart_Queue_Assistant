import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import {
  authenticatedActionRateLimiter,
  requireAuth,
  requireRole,
  validate,
} from '../../middlewares';

import {
  createManager,
  createOrganization,
  listManagers,
  listOrganizations,
  registerOrganization,
  removeManager,
  removeOrganization,
  updateManager,
  updateOrganization,
} from './admin.controller';
import {
  AdminOrgIdParamSchema,
  AdminOrgManagerParamSchema,
  CreateManagerSchema,
  CreateOrganizationRegistrationSchema,
  CreateOrganizationSchema,
  UpdateManagerSchema,
  UpdateOrganizationSchema,
} from './admin.validator';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(UserRole.ADMIN));

adminRouter.get('/organizations', listOrganizations);
adminRouter.post(
  '/organizations',
  authenticatedActionRateLimiter,
  validate(CreateOrganizationSchema),
  createOrganization
);
adminRouter.post(
  '/organizations/register',
  authenticatedActionRateLimiter,
  validate(CreateOrganizationRegistrationSchema),
  registerOrganization
);
adminRouter.patch(
  '/organizations/:orgId',
  authenticatedActionRateLimiter,
  validate(AdminOrgIdParamSchema, 'params'),
  validate(UpdateOrganizationSchema),
  updateOrganization
);
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
adminRouter.post(
  '/organizations/:orgId/managers',
  authenticatedActionRateLimiter,
  validate(AdminOrgIdParamSchema, 'params'),
  validate(CreateManagerSchema),
  createManager
);
adminRouter.patch(
  '/organizations/:orgId/managers/:userId',
  authenticatedActionRateLimiter,
  validate(AdminOrgManagerParamSchema, 'params'),
  validate(UpdateManagerSchema),
  updateManager
);
adminRouter.delete(
  '/organizations/:orgId/managers/:userId',
  authenticatedActionRateLimiter,
  validate(AdminOrgManagerParamSchema, 'params'),
  removeManager
);
