import { Request, Response } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';

import { authService } from './auth.service';
import { LineLoginDto } from './auth.validator';

/**
 * POST /api/v1/auth/line
 *
 * Accepts a LINE OIDC id_token from the LIFF frontend, verifies it with
 * LINE's server, and returns an internal JWT + safe user profile.
 *
 * Response: { token: string, user: { id, lineUserId, role } }
 */
export const loginWithLine = asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = req.body as LineLoginDto;
  const { token, user } = await authService.loginWithLineToken(idToken);
  sendSuccess(res, { token, user });
});
