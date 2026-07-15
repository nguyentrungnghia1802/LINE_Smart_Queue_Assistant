import { Request, Response } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';

import { authService } from './auth.service';
import { EmailPasswordLoginDto, LineLoginDto, RegisterCustomerDto } from './auth.validator';

/**
 * POST /api/v1/auth/line
 */
export const loginWithLine = asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = req.body as LineLoginDto;
  const { token, user } = await authService.loginWithLineToken(idToken);
  sendSuccess(res, { token, user });
});

/**
 * POST /api/v1/auth/login
 * Email + password login for manager/admin/staff accounts.
 */
export const loginWithEmailPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as EmailPasswordLoginDto;
  const { token, user } = await authService.loginWithEmailPassword(email, password);
  sendSuccess(res, { token, user });
});

/**
 * POST /api/v1/auth/register
 * Public customer self-registration with email/password.
 */
export const registerCustomer = asyncHandler(async (req: Request, res: Response) => {
  const dto = req.body as RegisterCustomerDto;
  const { token, user } = await authService.registerCustomer(dto);
  res.status(201).json({ success: true, data: { token, user } });
});
