import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import {
  authenticatedActionRateLimiter,
  publicWriteRateLimiter,
  requireAuth,
  requireRole,
  validate,
} from '../../middlewares';

import {
  approveOrganizationApplication,
  listOrganizationApplications,
  rejectOrganizationApplication,
  submitOrganizationApplication,
  updateOrganizationApplication,
} from './organization-applications.controller';
import {
  CreateOrganizationApplicationSchema,
  OrganizationApplicationIdParamSchema,
  OrganizationApplicationListQuerySchema,
  ReviewOrganizationApplicationSchema,
  UpdateOrganizationApplicationSchema,
} from './organization-applications.validator';

export const organizationApplicationsRouter = Router();

organizationApplicationsRouter.post(
  '/',
  publicWriteRateLimiter,
  validate(CreateOrganizationApplicationSchema),
  submitOrganizationApplication
);

organizationApplicationsRouter.get(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN),
  validate(OrganizationApplicationListQuerySchema, 'query'),
  listOrganizationApplications
);

organizationApplicationsRouter.patch(
  '/:applicationId',
  requireAuth,
  requireRole(UserRole.ADMIN),
  authenticatedActionRateLimiter,
  validate(OrganizationApplicationIdParamSchema, 'params'),
  validate(UpdateOrganizationApplicationSchema),
  updateOrganizationApplication
);

organizationApplicationsRouter.post(
  '/:applicationId/approve',
  requireAuth,
  requireRole(UserRole.ADMIN),
  authenticatedActionRateLimiter,
  validate(OrganizationApplicationIdParamSchema, 'params'),
  validate(ReviewOrganizationApplicationSchema),
  approveOrganizationApplication
);

organizationApplicationsRouter.post(
  '/:applicationId/reject',
  requireAuth,
  requireRole(UserRole.ADMIN),
  authenticatedActionRateLimiter,
  validate(OrganizationApplicationIdParamSchema, 'params'),
  validate(ReviewOrganizationApplicationSchema),
  rejectOrganizationApplication
);
