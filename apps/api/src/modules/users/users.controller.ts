import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendCreated, sendNoContent, sendSuccess } from '../../utils/response';

import { usersService } from './users.service';
import type { ChangeMyPasswordDto, InviteStaffDto, UpdateStaffDto } from './users.validator';

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user;
  if (!actor) throw AppError.unauthorized();
  const targetUserId = req.params['id'] ?? '';

  const user = await usersService.getUser(actor, targetUserId);
  sendSuccess(res, user);
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user;
  if (!actor) throw AppError.unauthorized();
  const users = await usersService.listUsersForBranchManager(actor);
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

export const changeMyPassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const result = await usersService.changeMyPassword(req.user, req.body as ChangeMyPasswordDto);
  sendSuccess(res, result);
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
