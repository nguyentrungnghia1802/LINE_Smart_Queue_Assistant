import type { PoolClient } from 'pg';

import { BaseRepository } from '../../db/repositories/base.repository';

export type AccountActionPurpose = 'account_activation' | 'password_reset';

export interface AccountActionTokenRow {
  id: string;
  user_id: string;
  purpose: AccountActionPurpose;
  token_hash: string;
  created_by: string | null;
  expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

export interface AccountActionContextRow extends AccountActionTokenRow {
  display_name: string;
  email: string;
  role: string;
  account_status: string;
  is_active: boolean;
  organization_id: string | null;
  organization_name: string | null;
  organization_is_active: boolean | null;
  is_owner: boolean;
}

export class AccountLifecycleRepository extends BaseRepository {
  async revokeActive(
    userId: string,
    purpose: AccountActionPurpose,
    client: PoolClient
  ): Promise<void> {
    await client.query(
      `UPDATE account_action_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND purpose = $2
         AND used_at IS NULL
         AND revoked_at IS NULL`,
      [userId, purpose]
    );
  }

  async createToken(
    params: {
      userId: string;
      purpose: AccountActionPurpose;
      tokenHash: string;
      createdBy?: string;
      expiresAt: Date;
    },
    client: PoolClient
  ): Promise<AccountActionTokenRow> {
    const rows = await this.queryTx<AccountActionTokenRow>(
      client,
      `INSERT INTO account_action_tokens
         (user_id, purpose, token_hash, created_by, expires_at)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [params.userId, params.purpose, params.tokenHash, params.createdBy ?? null, params.expiresAt]
    );
    return this.firstOrThrow(rows, 'accountLifecycle.createToken');
  }

  async findValid(tokenHash: string): Promise<AccountActionContextRow | null> {
    return this.queryOne<AccountActionContextRow>(
      `${this.contextQuery()}
       WHERE token.token_hash = $1
         AND token.used_at IS NULL
         AND token.revoked_at IS NULL
         AND token.expires_at > NOW()`,
      [tokenHash]
    );
  }

  async lockValid(tokenHash: string, client: PoolClient): Promise<AccountActionContextRow | null> {
    const rows = await this.queryTx<AccountActionContextRow>(
      client,
      `${this.contextQuery()}
       WHERE token.token_hash = $1
         AND token.used_at IS NULL
         AND token.revoked_at IS NULL
         AND token.expires_at > NOW()
       FOR UPDATE OF token, u`,
      [tokenHash]
    );
    return rows[0] ?? null;
  }

  async activateAccount(
    context: AccountActionContextRow,
    passwordHash: string,
    client: PoolClient
  ): Promise<void> {
    await client.query(
      `UPDATE users
       SET password_hash = $2,
           is_active = TRUE,
           account_status = 'active',
           activated_at = COALESCE(activated_at, NOW()),
           deactivated_at = NULL,
           deactivated_by = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [context.user_id, passwordHash]
    );
    await client.query(
      `UPDATE organization_members
       SET is_active = TRUE,
           activated_at = COALESCE(activated_at, NOW())
       WHERE user_id = $1
         AND ($2::uuid IS NULL OR organization_id = $2)`,
      [context.user_id, context.organization_id]
    );
    await client.query(
      `UPDATE branch_memberships
       SET is_active = TRUE,
           deactivated_at = NULL
       WHERE user_id = $1
         AND ($2::uuid IS NULL OR organization_id = $2)`,
      [context.user_id, context.organization_id]
    );
    if (context.is_owner && context.organization_id) {
      await client.query(
        `UPDATE organizations
         SET is_active = TRUE,
             activation_status = 'active',
             updated_at = NOW()
         WHERE id = $1`,
        [context.organization_id]
      );
    }
    await this.markUsed(context.id, client);
    await this.audit(
      {
        actorId: context.user_id,
        action: 'account_activated',
        resourceType: 'user',
        resourceId: context.user_id,
        organizationId: context.organization_id,
      },
      client
    );
  }

  async resetPassword(
    context: AccountActionContextRow,
    passwordHash: string,
    client: PoolClient
  ): Promise<void> {
    await client.query(
      `UPDATE users
       SET password_hash = $2, updated_at = NOW()
       WHERE id = $1 AND is_active = TRUE AND account_status = 'active'`,
      [context.user_id, passwordHash]
    );
    await this.markUsed(context.id, client);
    await this.audit(
      {
        actorId: context.user_id,
        action: 'password_reset',
        resourceType: 'user',
        resourceId: context.user_id,
        organizationId: context.organization_id,
      },
      client
    );
  }

  private async markUsed(id: string, client: PoolClient): Promise<void> {
    await client.query(
      `UPDATE account_action_tokens
       SET used_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  private async audit(
    params: {
      actorId: string;
      action: string;
      resourceType: string;
      resourceId: string;
      organizationId: string | null;
    },
    client: PoolClient
  ): Promise<void> {
    await client.query(
      `INSERT INTO audit_logs
         (actor_id, actor_type, action, resource_type, resource_id, organization_id)
       VALUES ($1,'user',$2,$3,$4,$5)`,
      [params.actorId, params.action, params.resourceType, params.resourceId, params.organizationId]
    );
  }

  private contextQuery(): string {
    return `SELECT token.*,
                   u.display_name,
                   u.email,
                   u.role::text,
                   u.account_status,
                   u.is_active,
                   om.organization_id,
                   o.name AS organization_name,
                   o.is_active AS organization_is_active,
                   COALESCE(om.is_owner, FALSE) AS is_owner
            FROM account_action_tokens token
            JOIN users u ON u.id = token.user_id
            LEFT JOIN organization_members om
              ON om.user_id = u.id
             AND om.role IN ('manager','staff')
            LEFT JOIN organizations o ON o.id = om.organization_id`;
  }
}

export const accountLifecycleRepository = new AccountLifecycleRepository();
