import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';

import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './auth.cookies';
import { authService } from './auth.service';
import { EmailPasswordLoginDto, LineLoginDto } from './auth.validator';

function publicSession(session: {
  kind: 'business' | 'customer';
  idleTimeoutMs: number;
  refreshExpiresAt: Date;
}) {
  return {
    kind: session.kind,
    idleTimeoutSeconds: Math.floor(session.idleTimeoutMs / 1000),
    absoluteExpiresAt: session.refreshExpiresAt.toISOString(),
  };
}

/**
 * POST /api/v1/auth/line
 */
export const loginWithLine = asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = req.body as LineLoginDto;
  const { token, user, session } = await authService.loginWithLineToken(idToken);
  setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt);
  sendSuccess(res, { token, user, session: publicSession(session) });
});

/**
 * POST /api/v1/auth/login
 * Email + password login for manager/admin/staff accounts.
 */
export const loginWithEmailPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as EmailPasswordLoginDto;
  const { token, user, session } = await authService.loginWithEmailPassword(email, password);
  setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt);
  sendSuccess(res, { token, user, session: publicSession(session) });
});

export const refreshAuthentication = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = readRefreshCookie(req);
  if (!refreshToken) {
    clearRefreshCookie(res);
    throw new AppError('Refresh session is required', 401, 'AUTH_SESSION_REQUIRED');
  }

  try {
    const { token, user, session } = await authService.refreshSession(refreshToken);
    setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt);
    sendSuccess(res, { token, user, session: publicSession(session) });
  } catch (error) {
    clearRefreshCookie(res);
    throw error;
  }
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  sendSuccess(res, { loggedOut: true });
});
