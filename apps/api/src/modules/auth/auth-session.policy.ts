import { UserRole } from '@line-queue/shared';

import { config } from '../../config';

export type AuthSessionKind = 'business' | 'customer';

export interface AuthSessionPolicy {
  kind: AuthSessionKind;
  idleTimeoutMs: number;
  absoluteTimeoutMs: number;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function sessionPolicyForRole(role: UserRole): AuthSessionPolicy {
  if (role === UserRole.CUSTOMER) {
    return {
      kind: 'customer',
      idleTimeoutMs: config.auth.customerSessionDays * DAY_MS,
      absoluteTimeoutMs: config.auth.customerSessionDays * DAY_MS,
    };
  }

  return {
    kind: 'business',
    idleTimeoutMs: config.auth.businessIdleTimeoutMinutes * MINUTE_MS,
    absoluteTimeoutMs: config.auth.businessAbsoluteTimeoutHours * HOUR_MS,
  };
}

export function nextIdleExpiry(now: Date, absoluteExpiresAt: Date, idleTimeoutMs: number): Date {
  return new Date(Math.min(now.getTime() + idleTimeoutMs, absoluteExpiresAt.getTime()));
}
