import { PoolClient } from 'pg';

import type { SupportedLocale } from '@line-queue/shared';

import { BaseRepository } from './base.repository';

// ── Row types (shape returned directly from PostgreSQL) ────────────────────────

export interface UserRow {
  id: string;
  display_name: string;
  email: string | null;
  password_hash: string | null;
  role: string;
  is_active: boolean;
  account_status?: 'invited' | 'active' | 'disabled';
  phone?: string | null;
  postal_code?: string | null;
  prefecture?: string | null;
  city?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  job_title?: string | null;
  employee_code?: string | null;
  invited_by?: string | null;
  activated_at?: Date | null;
  deactivated_at?: Date | null;
  deactivated_by?: string | null;
  preferred_locale?: SupportedLocale | null;
  created_at: Date;
  updated_at: Date;
}

export interface LineAccountRow {
  id: string;
  user_id: string;
  line_user_id: string;
  display_name: string;
  picture_url: string | null;
  status_message: string | null;
  is_linked: boolean;
  linked_at: Date;
  last_synced_at: Date;
}

// ── Params ─────────────────────────────────────────────────────────────────────

export interface CreateUserParams {
  displayName: string;
  email?: string;
  role?: string;
}

export interface UpsertLineAccountParams {
  userId: string;
  lineUserId: string;
  displayName: string;
  pictureUrl?: string | null;
  statusMessage?: string | null;
}

// ── Repository ─────────────────────────────────────────────────────────────────

export class UsersRepository extends BaseRepository {
  async findById(id: string): Promise<UserRow | null> {
    return this.queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  }

  async findOrganizationOwner(organizationId: string): Promise<UserRow | null> {
    return this.queryOne<UserRow>(
      `SELECT user_record.*
       FROM users user_record
       JOIN organization_members membership ON membership.user_id = user_record.id
       WHERE membership.organization_id = $1
         AND membership.role = 'manager'
         AND membership.is_owner = TRUE
       ORDER BY membership.joined_at
       LIMIT 1`,
      [organizationId]
    );
  }

  async findByEmail(email: string, client?: PoolClient): Promise<UserRow | null> {
    const normalized = email.trim().toLowerCase();
    return client
      ? this.queryOneTx<UserRow>(client, 'SELECT * FROM users WHERE LOWER(email) = $1', [
          normalized,
        ])
      : this.queryOne<UserRow>('SELECT * FROM users WHERE LOWER(email) = $1', [normalized]);
  }

  /**
   * Resolve a LINE userId to our users row via the line_accounts join.
   * Used by the LINE webhook handler on every incoming event.
   * Hits idx_la_line_user_id (fast).
   */
  async findByLineUserId(lineUserId: string): Promise<UserRow | null> {
    return this.queryOne<UserRow>(
      `SELECT u.*
       FROM users u
       JOIN line_accounts la ON la.user_id = u.id
       WHERE la.line_user_id = $1`,
      [lineUserId]
    );
  }

  /**
   * List users by organization and optional role.
   * Used by manager portal to view staff members.
   */
  async findByOrgAndRole(orgId: string, role?: string): Promise<UserRow[]> {
    const roleClause = role ? 'AND u.role = $2' : '';
    const params: unknown[] = role ? [orgId, role] : [orgId];
    return this.query<UserRow>(
      `SELECT u.*
       FROM users u
       JOIN organization_members om ON om.user_id = u.id
       WHERE om.organization_id = $1
         ${roleClause}
       ORDER BY u.created_at DESC`,
      params
    );
  }

  async create(params: CreateUserParams, client?: PoolClient): Promise<UserRow> {
    const sql = `
      INSERT INTO users (display_name, email, role)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const args = [params.displayName, params.email ?? null, params.role ?? 'customer'];
    const rows = client
      ? await this.queryTx<UserRow>(client, sql, args)
      : await this.query<UserRow>(sql, args);
    return this.firstOrThrow(rows, 'users.create');
  }

  async createWithPassword(
    params: {
      displayName: string;
      email: string;
      role: string;
      passwordHash: string;
    },
    client?: PoolClient
  ): Promise<UserRow> {
    const sql = `
      INSERT INTO users (display_name, email, role, password_hash)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const args = [params.displayName, params.email, params.role, params.passwordHash];
    const rows = client
      ? await this.queryTx<UserRow>(client, sql, args)
      : await this.query<UserRow>(sql, args);
    return this.firstOrThrow(rows, 'users.createWithPassword');
  }

  async findByBranchAndRole(branchId: string, role?: string): Promise<UserRow[]> {
    const roleClause = role ? 'AND u.role = $2' : '';
    const params: unknown[] = role ? [branchId, role] : [branchId];
    return this.query<UserRow>(
      `SELECT u.*
       FROM users u
       JOIN branch_memberships bm
         ON bm.user_id = u.id
        AND bm.deactivated_at IS NULL
       WHERE bm.branch_id = $1
         ${roleClause}
       ORDER BY u.created_at DESC`,
      params
    );
  }

  async findAssignedBranchId(
    organizationId: string,
    userId: string,
    client?: PoolClient
  ): Promise<string | null> {
    const sql = `SELECT branch_id
                 FROM branch_memberships
                 WHERE organization_id = $1
                   AND user_id = $2
                   AND deactivated_at IS NULL
                 ORDER BY assigned_at
                 LIMIT 1`;
    const rows = client
      ? await this.queryTx<{ branch_id: string }>(client, sql, [organizationId, userId])
      : await this.query<{ branch_id: string }>(sql, [organizationId, userId]);
    return rows[0]?.branch_id ?? null;
  }

  async createInvited(
    params: {
      displayName: string;
      email: string;
      phone: string;
      role: 'manager' | 'staff';
      invitedBy: string;
      postalCode?: string | null;
      prefecture?: string | null;
      city?: string | null;
      addressLine1?: string | null;
      addressLine2?: string | null;
      jobTitle?: string | null;
      employeeCode?: string | null;
    },
    client: PoolClient
  ): Promise<UserRow> {
    const rows = await this.queryTx<UserRow>(
      client,
      `INSERT INTO users (
         display_name, email, phone, role, password_hash, is_active, account_status,
         invited_by, postal_code, prefecture, city, address_line1, address_line2,
         job_title, employee_code
       )
       VALUES ($1,LOWER($2),$3,$4,NULL,FALSE,'invited',$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        params.displayName,
        params.email,
        params.phone,
        params.role,
        params.invitedBy,
        params.postalCode ?? null,
        params.prefecture ?? null,
        params.city ?? null,
        params.addressLine1 ?? null,
        params.addressLine2 ?? null,
        params.jobTitle ?? null,
        params.employeeCode ?? null,
      ]
    );
    return this.firstOrThrow(rows, 'users.createInvited');
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.query('UPDATE users SET is_active = $1 WHERE id = $2', [isActive, id]);
  }

  async setPassword(id: string, passwordHash: string): Promise<void> {
    await this.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      passwordHash,
      id,
    ]);
  }

  async deactivate(id: string): Promise<void> {
    await this.query('UPDATE users SET is_active = FALSE WHERE id = $1', [id]);
  }

  /**
   * Update current user's profile (display_name, email).
   * Used by users/me endpoint for self-service profile editing.
   */
  async updateProfile(
    id: string,
    data: Partial<{ displayName: string; email: string; preferredLocale: SupportedLocale | null }>
  ): Promise<UserRow | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (data.displayName !== undefined) {
      fields.push(`display_name = $${i++}`);
      values.push(data.displayName);
    }
    if (data.email !== undefined) {
      fields.push(`email = $${i++}`);
      values.push(data.email);
    }
    if (data.preferredLocale !== undefined) {
      fields.push(`preferred_locale = $${i++}`);
      values.push(data.preferredLocale);
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    const rows = await this.query<UserRow>(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return rows[0] ?? null;
  }

  async updateEmployeeProfile(
    id: string,
    data: Partial<{
      displayName: string;
      email: string;
      phone: string;
      currentAddress: string;
      jobTitle: string;
      employeeCode: string | null;
    }>,
    client?: PoolClient
  ): Promise<UserRow | null> {
    const mapping: Array<[keyof typeof data, string]> = [
      ['displayName', 'display_name'],
      ['email', 'email'],
      ['phone', 'phone'],
      ['currentAddress', 'address_line1'],
      ['jobTitle', 'job_title'],
      ['employeeCode', 'employee_code'],
    ];
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of mapping) {
      if (data[key] !== undefined) {
        values.push(key === 'email' ? String(data[key]).toLowerCase() : data[key]);
        fields.push(`${column} = $${values.length}`);
      }
    }
    if (!fields.length) return this.findById(id);
    values.push(id);
    const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = NOW()
                 WHERE id = $${values.length} RETURNING *`;
    const rows = client
      ? await this.queryTx<UserRow>(client, sql, values)
      : await this.query<UserRow>(sql, values);
    return rows[0] ?? null;
  }

  /**
   * Persist an email verified by LINE only when the user has no email and the
   * address is not already owned by another platform identity.
   */
  async setVerifiedLineEmailIfAvailable(id: string, email: string): Promise<UserRow | null> {
    const rows = await this.query<UserRow>(
      `UPDATE users AS target
       SET email = $2, updated_at = NOW()
       WHERE target.id = $1
         AND target.email IS NULL
         AND NOT EXISTS (
           SELECT 1
           FROM users AS existing
           WHERE existing.email = $2
             AND existing.id <> target.id
         )
       RETURNING target.*`,
      [id, email]
    );
    return rows[0] ?? this.findById(id);
  }

  // ── LineAccounts ────────────────────────────────────────────────────────────

  /**
   * Insert or update the LINE account linked to userId.
   * Called on every LINE "follow" event and profile sync.
   */
  async upsertLineAccount(
    params: UpsertLineAccountParams,
    client?: PoolClient
  ): Promise<LineAccountRow> {
    const sql = `
      INSERT INTO line_accounts (user_id, line_user_id, display_name, picture_url, status_message, is_linked, last_synced_at)
      VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
      ON CONFLICT (line_user_id) DO UPDATE SET
        display_name   = EXCLUDED.display_name,
        picture_url    = EXCLUDED.picture_url,
        status_message = EXCLUDED.status_message,
        is_linked      = TRUE,
        last_synced_at = NOW()
      RETURNING *
    `;
    const args = [
      params.userId,
      params.lineUserId,
      params.displayName,
      params.pictureUrl ?? null,
      params.statusMessage ?? null,
    ];
    const rows = client
      ? await this.queryTx<LineAccountRow>(client, sql, args)
      : await this.query<LineAccountRow>(sql, args);
    return this.firstOrThrow(rows, 'users.upsertLineAccount');
  }

  async markLineAccountUnlinked(lineUserId: string): Promise<void> {
    await this.query('UPDATE line_accounts SET is_linked = FALSE WHERE line_user_id = $1', [
      lineUserId,
    ]);
  }

  async findLineAccount(lineUserId: string): Promise<LineAccountRow | null> {
    return this.queryOne<LineAccountRow>('SELECT * FROM line_accounts WHERE line_user_id = $1', [
      lineUserId,
    ]);
  }
}

export const usersRepository = new UsersRepository();
