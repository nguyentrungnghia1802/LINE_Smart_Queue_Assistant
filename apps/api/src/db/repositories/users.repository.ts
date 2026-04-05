import { PoolClient } from 'pg';

import { BaseRepository } from './base.repository';

// ── Row types (shape returned directly from PostgreSQL) ────────────────────────

export interface UserRow {
  id: string;
  display_name: string;
  email: string | null;
  role: string;
  is_active: boolean;
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

  async findByEmail(email: string): Promise<UserRow | null> {
    return this.queryOne<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
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

  async deactivate(id: string): Promise<void> {
    await this.query('UPDATE users SET is_active = FALSE WHERE id = $1', [id]);
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
