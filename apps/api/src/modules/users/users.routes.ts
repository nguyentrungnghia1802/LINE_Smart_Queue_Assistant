import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import { authenticatedActionRateLimiter, requireAuth, requireRole } from '../../middlewares';
import { validate } from '../../middlewares/validate.middleware';
import { UUIDParamSchema } from '../shared/shared.validator';

import {
  changeMyPassword,
  createStaff,
  createUser,
  deactivateUser,
  getUser,
  listUsers,
  removeStaff,
  updateMyProfile,
  updateStaff,
  updateStaffStatus,
} from './users.controller';
import {
  ChangeMyPasswordSchema,
  CreateUserSchema,
  InviteStaffSchema,
  StaffUserParamSchema,
  UpdateMyProfileSchema,
  UpdateStaffSchema,
  UpdateStaffStatusSchema,
} from './users.validator';

export const usersRouter = Router();

usersRouter.patch(
  '/me/password',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF),
  authenticatedActionRateLimiter,
  validate(ChangeMyPasswordSchema),
  changeMyPassword
);

// GET /api/v1/users - list users by org/role (requires auth for manager portal)
usersRouter.get('/', requireAuth, requireRole(UserRole.MANAGER, UserRole.ADMIN), listUsers);

// PATCH /api/v1/users/me - update current user profile
usersRouter.patch(
  '/me',
  requireAuth,
  authenticatedActionRateLimiter,
  validate(UpdateMyProfileSchema),
  updateMyProfile
);

// Manager staff management
usersRouter.post(
  '/staff',
  requireAuth,
  requireRole(UserRole.MANAGER),
  authenticatedActionRateLimiter,
  validate(InviteStaffSchema),
  createStaff
);
usersRouter.patch(
  '/staff/:userId/status',
  requireAuth,
  requireRole(UserRole.MANAGER),
  authenticatedActionRateLimiter,
  validate(StaffUserParamSchema, 'params'),
  validate(UpdateStaffStatusSchema),
  updateStaffStatus
);
usersRouter.patch(
  '/staff/:userId',
  requireAuth,
  requireRole(UserRole.MANAGER),
  authenticatedActionRateLimiter,
  validate(StaffUserParamSchema, 'params'),
  validate(UpdateStaffSchema),
  updateStaff
);
usersRouter.delete(
  '/staff/:userId',
  requireAuth,
  requireRole(UserRole.MANAGER),
  authenticatedActionRateLimiter,
  validate(StaffUserParamSchema, 'params'),
  removeStaff
);

usersRouter.get('/:id', requireAuth, validate(UUIDParamSchema, 'params'), getUser);
usersRouter.post(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN),
  authenticatedActionRateLimiter,
  validate(CreateUserSchema),
  createUser
);
usersRouter.delete(
  '/:id',
  requireAuth,
  requireRole(UserRole.ADMIN),
  authenticatedActionRateLimiter,
  validate(UUIDParamSchema, 'params'),
  deactivateUser
);
