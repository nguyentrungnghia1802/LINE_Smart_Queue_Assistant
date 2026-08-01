import type { PoolClient } from 'pg';

import { pool } from '../../db/client';

import type { AuthSessionKind } from './auth-session.policy';

export interface AuthSessionRow {
  id: string;
  user_id: string;
  family_id: string;
  token_hash: string;
  session_kind: AuthSessionKind;
  idle_expires_at: Date;
  absolute_expires_at: Date;
  last_used_at: Date;
  revoked_at: Date | null;
  revocation_reason: string | null;
  replaced_by_session_id: string | null;
  created_at: Date;
}

interface CreateSessionParams {
  userId: string;
  familyId: string;
  tokenHash: string;
  sessionKind: AuthSessionKind;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

export const authSessionRepository = {
  async create(params: CreateSessionParams, client?: PoolClient): Promise<AuthSessionRow> {
    const executor = client ?? pool;
    const { rows } = await executor.query<AuthSessionRow>(
      `INSERT INTO auth_sessions (
         user_id, family_id, token_hash, session_kind, idle_expires_at, absolute_expires_at
       )
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        params.userId,
        params.familyId,
        params.tokenHash,
        params.sessionKind,
        params.idleExpiresAt,
        params.absoluteExpiresAt,
      ]
    );
    const row = rows[0];
    if (!row) throw new Error('authSessionRepository.create returned no row');
    return row;
  },

  async lockByTokenHash(tokenHash: string, client: PoolClient): Promise<AuthSessionRow | null> {
    const { rows } = await client.query<AuthSessionRow>(
      'SELECT * FROM auth_sessions WHERE token_hash = $1 FOR UPDATE',
      [tokenHash]
    );
    return rows[0] ?? null;
  },

  async replace(currentId: string, replacementId: string, client: PoolClient): Promise<void> {
    await client.query(
      `UPDATE auth_sessions
       SET revoked_at = NOW(),
           revocation_reason = 'rotated',
           replaced_by_session_id = $2,
           last_used_at = NOW()
       WHERE id = $1
         AND revoked_at IS NULL`,
      [currentId, replacementId]
    );
  },

  async revokeFamily(familyId: string, reason: string, client?: PoolClient): Promise<void> {
    const executor = client ?? pool;
    await executor.query(
      `UPDATE auth_sessions
       SET revoked_at = COALESCE(revoked_at, NOW()),
           revocation_reason = COALESCE(revocation_reason, $2)
       WHERE family_id = $1
         AND revoked_at IS NULL`,
      [familyId, reason]
    );
  },

  async revokeAllForUser(userId: string, reason: string, client?: PoolClient): Promise<void> {
    const executor = client ?? pool;
    await executor.query(
      `UPDATE auth_sessions
       SET revoked_at = COALESCE(revoked_at, NOW()),
           revocation_reason = COALESCE(revocation_reason, $2)
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [userId, reason]
    );
  },

  async isActiveFamily(familyId: string, userId: string): Promise<boolean> {
    const { rows } = await pool.query<{ active: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM auth_sessions
         WHERE family_id = $1
           AND user_id = $2
           AND revoked_at IS NULL
           AND idle_expires_at > NOW()
           AND absolute_expires_at > NOW()
      ) AS active`,
      [familyId, userId]
    );
    return rows[0]?.active ?? false;
  },

  async deleteExpired(retentionDays: number, limit = 1_000): Promise<number> {
    const { rowCount } = await pool.query(
      `DELETE FROM auth_sessions
       WHERE id IN (
         SELECT id
         FROM auth_sessions
         WHERE absolute_expires_at < NOW() - ($1 * INTERVAL '1 day')
            OR revoked_at < NOW() - ($1 * INTERVAL '1 day')
         ORDER BY COALESCE(revoked_at, absolute_expires_at)
         LIMIT $2
       )`,
      [retentionDays, limit]
    );
    return rowCount ?? 0;
  },
};
