import type { Request, Response } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';

import { accountLifecycleService } from './account-lifecycle.service';
import type { CompleteAccountActionDto, ForgotPasswordDto } from './account-lifecycle.validator';

export const inspectAccountAction = asyncHandler(async (req: Request, res: Response) => {
  const result = await accountLifecycleService.inspect(String(req.query['token'] ?? ''));
  sendSuccess(res, result);
});

export const activateAccount = asyncHandler(async (req: Request, res: Response) => {
  const result = await accountLifecycleService.activate(req.body as CompleteAccountActionDto);
  sendSuccess(res, result);
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  await accountLifecycleService.requestPasswordReset(req.body as ForgotPasswordDto);
  sendSuccess(res, { accepted: true }, 202);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await accountLifecycleService.resetPassword(req.body as CompleteAccountActionDto);
  sendSuccess(res, result);
});
