import { Request, Response } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import { sendCreated, sendNoContent, sendSuccess } from '../../utils/response';

import { usersService } from './users.service';
import { CreateUserDto } from './users.validator';

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.getUser(req.params['id'] ?? '');
  sendSuccess(res, user);
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.query['orgId'] as string | undefined;
  const role = req.query['role'] as string | undefined;
  if (!orgId) {
    res.status(400).json({ message: 'orgId is required' });
    return;
  }
  const users = await usersService.listUsersByOrg(orgId, role);
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
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(400).json({ success: false, error: { code: 'NO_ORG', message: 'User has no organization' } });
    return;
  }
  const { displayName, email, password } = req.body as { displayName: string; email: string; password: string };
  const user = await usersService.createStaff(orgId, { displayName, email, password });
  sendCreated(res, user);
});

/** Manager updates a staff member's active status. */
export const updateStaffStatus = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(400).json({ success: false, error: { code: 'NO_ORG', message: 'User has no organization' } });
    return;
  }
  const { userId } = req.params as { userId: string };
  const { isActive } = req.body as { isActive: boolean };
  const user = await usersService.updateStaffStatus(orgId, userId, isActive);
  sendSuccess(res, user);
});
