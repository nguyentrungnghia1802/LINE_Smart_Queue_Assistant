import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import {
  authenticatedActionRateLimiter,
  requireAuth,
  requireRole,
  validate,
} from '../../middlewares';

import {
  createBranch,
  inviteBranchManager,
  listBranches,
  listOrganizationAudit,
  removeBranchManager,
} from './branches.controller';
import {
  AuditLogQuerySchema,
  BranchIdParamSchema,
  BranchManagerParamSchema,
  CreateBranchSchema,
  InviteBranchManagerSchema,
} from './branches.validator';

export const branchesRouter = Router();

branchesRouter.use(requireAuth, requireRole(UserRole.MANAGER));
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
