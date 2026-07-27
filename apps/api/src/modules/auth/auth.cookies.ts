import type { Request, Response } from 'express';

import { config } from '../../config';

const COOKIE_PATH = '/api/v1/auth';

export function readRefreshCookie(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== config.auth.refreshCookieName) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function setRefreshCookie(res: Response, refreshToken: string, expiresAt: Date): void {
  res.cookie(config.auth.refreshCookieName, refreshToken, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: COOKIE_PATH,
    expires: expiresAt,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(config.auth.refreshCookieName, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: COOKIE_PATH,
  });
}
