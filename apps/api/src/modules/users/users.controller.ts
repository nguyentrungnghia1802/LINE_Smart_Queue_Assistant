import { Request, Response } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import { sendCreated, sendNoContent, sendSuccess } from '../../utils/response';

import { usersService } from './users.service';
import { CreateUserDto } from './users.validator';

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.getUser(req.params['id'] ?? '');
  sendSuccess(res, user);
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.createUser(req.body as CreateUserDto);
  sendCreated(res, user);
});

export const deactivateUser = asyncHandler(async (req: Request, res: Response) => {
  await usersService.deactivateUser(req.params['id'] ?? '');
  sendNoContent(res);
});
