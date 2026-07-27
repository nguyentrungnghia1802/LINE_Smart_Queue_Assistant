import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { UserRole } from '@line-queue/shared';

import { withTransaction } from '../../db/transaction';
import { AppError } from '../../utils/AppError';

import { AuthSessionPolicy, nextIdleExpiry, sessionPolicyForRole } from './auth-session.policy';
import { authSessionRepository } from './auth-session.repository';

const TOKEN_BYTES = 48;
const ROTATION_GRACE_MS = 30_000;

export interface IssuedAuthSession {
  id: string;
  familyId: string;
  userId: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  kind: 'business' | 'customer';
  idleTimeoutMs: number;
}

type RotationOutcome =
  | { session: IssuedAuthSession; error?: never }
  | { session?: never; error: 'invalid' | 'reused' | 'expired' };

function generateRefreshToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function expiryForNewSession(policy: AuthSessionPolicy, now: Date) {
  const absoluteExpiresAt = new Date(now.getTime() + policy.absoluteTimeoutMs);
  return {
    absoluteExpiresAt,
    idleExpiresAt: nextIdleExpiry(now, absoluteExpiresAt, policy.idleTimeoutMs),
  };
}

export const authSessionService = {
  async issue(userId: string, role: UserRole): Promise<IssuedAuthSession> {
    const refreshToken = generateRefreshToken();
    const policy = sessionPolicyForRole(role);
    const now = new Date();
    const { absoluteExpiresAt, idleExpiresAt } = expiryForNewSession(policy, now);
    const row = await authSessionRepository.create({
      userId,
      familyId: randomUUID(),
      tokenHash: hashRefreshToken(refreshToken),
      sessionKind: policy.kind,
      idleExpiresAt,
      absoluteExpiresAt,
    });

    return {
      id: row.id,
      familyId: row.family_id,
      userId: row.user_id,
      refreshToken,
      refreshExpiresAt: row.absolute_expires_at,
      kind: row.session_kind,
      idleTimeoutMs: policy.idleTimeoutMs,
    };
  },

  async rotate(refreshToken: string): Promise<IssuedAuthSession> {
    const currentHash = hashRefreshToken(refreshToken);
    const replacementToken = generateRefreshToken();

    const outcome = await withTransaction<RotationOutcome>(async (client) => {
      const current = await authSessionRepository.lockByTokenHash(currentHash, client);
      if (!current) {
        return { error: 'invalid' as const };
      }
      const now = new Date();
      const isRecentRotation =
        current.revocation_reason === 'rotated' &&
        current.revoked_at !== null &&
        now.getTime() - current.revoked_at.getTime() <= ROTATION_GRACE_MS;
      if (current.revoked_at && !isRecentRotation) {
        await authSessionRepository.revokeFamily(current.family_id, 'refresh_token_reuse', client);
        return { error: 'reused' as const };
      }

      if (
        current.idle_expires_at.getTime() <= now.getTime() ||
        current.absolute_expires_at.getTime() <= now.getTime()
      ) {
        await authSessionRepository.revokeFamily(current.family_id, 'expired', client);
        return { error: 'expired' as const };
      }

      const policy = sessionPolicyForRole(
        current.session_kind === 'customer' ? UserRole.CUSTOMER : UserRole.STAFF
      );
      const replacement = await authSessionRepository.create(
        {
          userId: current.user_id,
          familyId: current.family_id,
          tokenHash: hashRefreshToken(replacementToken),
          sessionKind: current.session_kind,
          idleExpiresAt: nextIdleExpiry(now, current.absolute_expires_at, policy.idleTimeoutMs),
          absoluteExpiresAt: current.absolute_expires_at,
        },
        client
      );
      await authSessionRepository.replace(current.id, replacement.id, client);

      return {
        session: {
          id: replacement.id,
          familyId: replacement.family_id,
          userId: replacement.user_id,
          refreshToken: replacementToken,
          refreshExpiresAt: replacement.absolute_expires_at,
          kind: replacement.session_kind,
          idleTimeoutMs: policy.idleTimeoutMs,
        },
      };
    });

    if (outcome.session) return outcome.session;
    if (outcome.error === 'reused') {
      throw new AppError('Refresh session has already been used', 401, 'AUTH_SESSION_REUSED');
    }
    if (outcome.error === 'expired') {
      throw new AppError('Refresh session has expired', 401, 'AUTH_SESSION_EXPIRED');
    }
    throw new AppError('Refresh session is invalid', 401, 'AUTH_SESSION_INVALID');
  },

  async revoke(refreshToken: string, reason = 'logout'): Promise<void> {
    await withTransaction(async (client) => {
      const current = await authSessionRepository.lockByTokenHash(
        hashRefreshToken(refreshToken),
        client
      );
      if (current) {
        await authSessionRepository.revokeFamily(current.family_id, reason, client);
      }
    });
  },

  async revokeAllForUser(userId: string, reason = 'account_invalid'): Promise<void> {
    await authSessionRepository.revokeAllForUser(userId, reason);
  },
};
