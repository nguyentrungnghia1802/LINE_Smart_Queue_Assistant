import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import { requireAuth, requireRole } from '../../middlewares';
import { validate } from '../../middlewares/validate.middleware';
import { UUIDParamSchema } from '../shared/shared.validator';

import {
  createStaff,
  createUser,
  deactivateUser,
  getUser,
  listUsers,
  updateMyProfile,
  updateStaffStatus,
} from './users.controller';
import { CreateUserSchema, UpdateMyProfileSchema } from './users.validator';

export const usersRouter = Router();

// GET /api/v1/users - list users by org/role (requires auth for manager portal)
usersRouter.get('/', requireAuth, listUsers);

// PATCH /api/v1/users/me - update current user profile
usersRouter.patch('/me', requireAuth, validate(UpdateMyProfileSchema), updateMyProfile);

// Manager staff management
usersRouter.post(
  '/staff',
  requireAuth,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  createStaff
);
usersRouter.patch(
  '/staff/:userId/status',
  requireAuth,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  updateStaffStatus
);

usersRouter.get('/:id', validate(UUIDParamSchema, 'params'), getUser);
usersRouter.post('/', validate(CreateUserSchema), createUser);
usersRouter.delete('/:id', validate(UUIDParamSchema, 'params'), deactivateUser);
