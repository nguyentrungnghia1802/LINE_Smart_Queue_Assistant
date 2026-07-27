import { Request, Response } from 'express';

import { UserRole } from '@line-queue/shared';

import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { usersRepository } from '../../db/repositories/users.repository';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendCreated, sendNoContent, sendSuccess } from '../../utils/response';

import { usersService } from './users.service';
import type { CreateUserDto, InviteStaffDto, UpdateStaffDto } from './users.validator';

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user;
  if (!actor) throw AppError.unauthorized();
  const targetUserId = req.params['id'] ?? '';

  if (actor.id !== targetUserId && actor.role !== UserRole.ADMIN) {
    const orgId = actor.organizationId;
    if (!orgId) throw AppError.forbidden();
    const member = await organizationsRepository.findMember(orgId, targetUserId);
    if (!member) throw AppError.forbidden('User is outside your organization');
    if (!actor.isOrganizationOwner) {
      const targetBranchId = await usersRepository.findAssignedBranchId(orgId, targetUserId);
      if (actor.branchIds?.length !== 1 || targetBranchId !== actor.branchIds[0]) {
        throw AppError.forbidden('User is outside your assigned branch');
      }
    }
  }

  const user = await usersService.getUser(targetUserId);
  sendSuccess(res, user);
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user;
  if (!actor) throw AppError.unauthorized();
  const requestedOrgId = req.query['orgId'] as string | undefined;
  const role = req.query['role'] as string | undefined;
  let users;
  if (actor.role === UserRole.ADMIN) {
    if (!requestedOrgId) throw AppError.badRequest('orgId is required');
    users = await usersService.listUsersByOrg(requestedOrgId, role);
  } else {
    users = await usersService.listUsersForBranchManager(actor, role);
  }
  sendSuccess(res, users);
});

export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const updated = await usersService.updateMyProfile(userId, req.body);
  sendSuccess(res, updated);
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.createUser(req.body as CreateUserDto);
  sendCreated(res, user);
});

export const deactivateUser = asyncHandler(async (req: Request, res: Response) => {
  await usersService.deactivateUser(req.params['id'] ?? '');
  sendNoContent(res);
});

/** Manager creates a staff account and adds them to their org. */
export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const user = await usersService.createStaff(req.user, req.body as InviteStaffDto);
  sendCreated(res, user);
});

/** Manager updates a staff member's active status. */
export const updateStaffStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const { userId } = req.params as { userId: string };
  const { isActive } = req.body as { isActive: boolean };
  const user = await usersService.updateStaffStatus(req.user, userId, isActive);
  sendSuccess(res, user);
});

export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const { userId } = req.params as { userId: string };
  const user = await usersService.updateStaff(req.user, userId, req.body as UpdateStaffDto);
  sendSuccess(res, user);
});

export const removeStaff = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const { userId } = req.params as { userId: string };
  await usersService.removeStaff(req.user, userId);
  sendNoContent(res);
});
