import { PoolClient } from 'pg';

import type { SupportedLocale } from '@line-queue/shared';

import { queueConfigCache } from '../../utils/cache';

import { BaseRepository } from './base.repository';

// ── Row types ──────────────────────────────────────────────────────────────────

export interface QueueRow {
  id: string;
  organization_id: string;
  branch_id?: string;
  name: string;
  description: string | null;
  status: string;
  queue_type: string;
  prefix: string;
  max_capacity: number | null;
  daily_ticket_counter: number;
  last_counter_reset_at: Date;
  counter_business_date?: string | null;
  avg_service_seconds: number;
  notify_ahead_positions: number;
  allow_skip: boolean;
  max_skips_before_penalty: number;
  auto_no_show_minutes?: number;
  absence_deferral_slots?: number;
  max_absence_count?: number;
  opens_at: string | null;
  closes_at: string | null;
  settings: Record<string, unknown>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ── Params ─────────────────────────────────────────────────────────────────────

export interface CreateQueueParams {
  organizationId: string;
  branchId: string;
  name: string;
  description?: string;
  status?: 'open' | 'paused' | 'closed';
  prefix?: string;
  queueType?: string;
  maxCapacity?: number;
  avgServiceSeconds?: number;
  notifyAheadPositions?: number;
  allowSkip?: boolean;
  maxSkipsBeforePenalty?: number;
  autoNoShowMinutes?: number;
  opensAt?: string;
  closesAt?: string;
  settings?: Record<string, unknown>;
}

// ── Repository ─────────────────────────────────────────────────────────────────

export class QueuesRepository extends BaseRepository {
  async findById(id: string): Promise<QueueRow | null> {
    const cacheKey = `queue:${id}`;
    const cached = queueConfigCache.get(cacheKey);
    if (cached !== null) return cached;

    const row = await this.queryOne<QueueRow>(
      'SELECT * FROM queues WHERE id = $1 AND is_active = TRUE',
      [id]
    );
    if (row) queueConfigCache.set(cacheKey, row, 30_000);
    return row;
  }

  async findByIdForBranch(
    id: string,
    organizationId: string,
    branchId: string,
    client?: PoolClient
  ): Promise<QueueRow | null> {
    const sql = `SELECT * FROM queues
                 WHERE id = $1
                   AND organization_id = $2
                   AND branch_id = $3
                   AND is_active = TRUE`;
    const rows = client
      ? await this.queryTx<QueueRow>(client, sql, [id, organizationId, branchId])
      : await this.query<QueueRow>(sql, [id, organizationId, branchId]);
    return rows[0] ?? null;
  }

  async lockById(id: string, client: PoolClient): Promise<QueueRow | null> {
    const rows = await this.queryTx<QueueRow>(
      client,
      `SELECT * FROM queues WHERE id = $1 AND is_active = TRUE FOR UPDATE`,
      [id]
    );
    return rows[0] ?? null;
  }

  /**
   * All open (or paused/disaster_mode) queues for an org — used by LIFF home.
   * Hits idx_queues_org_active.
   */
  async findActiveByOrg(
    organizationId: string,
    locale: SupportedLocale = 'ja'
  ): Promise<QueueRow[]> {
    return this.query<QueueRow>(
      `SELECT q.*,
              COALESCE(requested.name, tenant_default.name, japanese.name, q.name) AS name,
              COALESCE(requested.description, tenant_default.description, japanese.description, q.description) AS description
       FROM queues q
       JOIN organizations o ON o.id = q.organization_id
       LEFT JOIN queue_translations requested ON requested.queue_id = q.id AND requested.locale = $2
       LEFT JOIN queue_translations tenant_default ON tenant_default.queue_id = q.id AND tenant_default.locale = o.default_locale
       LEFT JOIN queue_translations japanese ON japanese.queue_id = q.id AND japanese.locale = 'ja'
       WHERE q.organization_id = $1 AND q.is_active = TRUE
       ORDER BY q.name`,
      [organizationId, locale]
    );
  }

  async findOpenByOrg(organizationId: string, locale: SupportedLocale = 'ja'): Promise<QueueRow[]> {
    return this.query<QueueRow>(
      `SELECT q.*,
              COALESCE(requested.name, tenant_default.name, japanese.name, q.name) AS name,
              COALESCE(requested.description, tenant_default.description, japanese.description, q.description) AS description
       FROM queues q
       JOIN organizations o ON o.id = q.organization_id
       LEFT JOIN queue_translations requested ON requested.queue_id = q.id AND requested.locale = $2
       LEFT JOIN queue_translations tenant_default ON tenant_default.queue_id = q.id AND tenant_default.locale = o.default_locale
       LEFT JOIN queue_translations japanese ON japanese.queue_id = q.id AND japanese.locale = 'ja'
       WHERE q.organization_id = $1
         AND q.is_active = TRUE
         AND q.status = 'open'
       ORDER BY q.created_at, q.id`,
      [organizationId, locale]
    );
  }

  async create(params: CreateQueueParams, client?: PoolClient): Promise<QueueRow> {
    const sql = `
      INSERT INTO queues
        (organization_id, branch_id, name, description, status, prefix, queue_type,
         max_capacity, avg_service_seconds, notify_ahead_positions,
         allow_skip, max_skips_before_penalty, auto_no_show_minutes,
         opens_at, closes_at, settings)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `;
    const args = [
      params.organizationId,
      params.branchId,
      params.name,
      params.description ?? null,
      params.status ?? 'open',
      params.prefix ?? '',
      params.queueType ?? 'walk_in',
      params.maxCapacity ?? null,
      params.avgServiceSeconds ?? 300,
      params.notifyAheadPositions ?? 3,
      params.allowSkip ?? true,
      params.maxSkipsBeforePenalty ?? 2,
      params.autoNoShowMinutes ?? 5,
      params.opensAt ?? null,
      params.closesAt ?? null,
      JSON.stringify(params.settings ?? {}),
    ];
    const rows = client
      ? await this.queryTx<QueueRow>(client, sql, args)
      : await this.query<QueueRow>(sql, args);
    const queue = this.firstOrThrow(rows, 'queues.create');
    const translationSql = `INSERT INTO queue_translations (queue_id, locale, name, description)
       VALUES ($1,'ja',$2,$3)
       ON CONFLICT (queue_id, locale) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`;
    const translationArgs = [queue.id, queue.name, queue.description];
    if (client) await this.queryTx(client, translationSql, translationArgs);
    else await this.query(translationSql, translationArgs);
    return queue;
  }

  async findActiveByBranches(
    organizationId: string,
    branchIds: string[],
    locale: SupportedLocale = 'ja'
  ): Promise<QueueRow[]> {
    if (branchIds.length === 0) return [];
    return this.query<QueueRow>(
      `SELECT q.*,
              COALESCE(requested.name, tenant_default.name, japanese.name, q.name) AS name,
              COALESCE(requested.description, tenant_default.description, japanese.description, q.description) AS description
       FROM queues q
       JOIN organizations o ON o.id = q.organization_id
       LEFT JOIN queue_translations requested ON requested.queue_id = q.id AND requested.locale = $3
       LEFT JOIN queue_translations tenant_default ON tenant_default.queue_id = q.id AND tenant_default.locale = o.default_locale
       LEFT JOIN queue_translations japanese ON japanese.queue_id = q.id AND japanese.locale = 'ja'
       WHERE q.organization_id = $1
         AND q.branch_id = ANY($2::uuid[])
         AND q.is_active = TRUE
       ORDER BY q.created_at, q.id`,
      [organizationId, branchIds, locale]
    );
  }

  /** All queues (active and inactive) for an org — used by admin views. */
  async findByOrg(organizationId: string): Promise<QueueRow[]> {
    return this.query<QueueRow>(`SELECT * FROM queues WHERE organization_id = $1 ORDER BY name`, [
      organizationId,
    ]);
  }

  async update(
    id: string,
    params: Partial<{
      name: string;
      description: string | undefined;
      status: string;
      maxCapacity: number | undefined;
      avgServiceSeconds: number | undefined;
      autoNoShowMinutes: number | undefined;
    }>,
    client?: PoolClient
  ): Promise<QueueRow | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.name !== undefined) {
      sets.push(`name = $${idx++}`);
      values.push(params.name);
    }
    if (params.description !== undefined) {
      sets.push(`description = $${idx++}`);
      values.push(params.description);
    }
    if (params.status !== undefined) {
      sets.push(`status = $${idx++}`);
      values.push(params.status);
    }
    if (params.maxCapacity !== undefined) {
      sets.push(`max_capacity = $${idx++}`);
      values.push(params.maxCapacity);
    }
    if (params.avgServiceSeconds !== undefined) {
      sets.push(`avg_service_seconds = $${idx++}`);
      values.push(params.avgServiceSeconds);
    }
    if (params.autoNoShowMinutes !== undefined) {
      sets.push(`auto_no_show_minutes = $${idx++}`);
      values.push(params.autoNoShowMinutes);
    }

    if (sets.length === 0) {
      return client
        ? ((await this.queryTx<QueueRow>(client, 'SELECT * FROM queues WHERE id = $1', [id]))[0] ??
            null)
        : this.findById(id);
    }

    values.push(id);
    const sql = `UPDATE queues SET ${sets.join(', ')}, updated_at = NOW()
      WHERE id = $${idx} RETURNING *`;
    const updated = client
      ? ((await this.queryTx<QueueRow>(client, sql, values))[0] ?? null)
      : await this.queryOne<QueueRow>(sql, values);
    if (updated) {
      if (params.name !== undefined || params.description !== undefined) {
        const translationSql = `INSERT INTO queue_translations (queue_id, locale, name, description)
          VALUES ($1,'ja',$2,$3)
          ON CONFLICT (queue_id, locale) DO UPDATE
          SET name = EXCLUDED.name, description = EXCLUDED.description`;
        const translationArgs = [updated.id, updated.name, updated.description];
        if (client) await this.queryTx(client, translationSql, translationArgs);
        else await this.query(translationSql, translationArgs);
      }
      if (!client) queueConfigCache.set(`queue:${id}`, updated, 30_000);
    }
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    await this.query(`UPDATE queues SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [id]);
    queueConfigCache.invalidate(`queue:${id}`);
  }

  async countStaffAssignments(id: string): Promise<number> {
    const row = await this.queryOne<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count
       FROM branch_memberships
       WHERE queue_id = $1
         AND role = 'staff'
         AND deactivated_at IS NULL`,
      [id]
    );
    return Number(row?.count ?? 0);
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.query('UPDATE queues SET status = $1 WHERE id = $2', [status, id]);
    queueConfigCache.invalidate(`queue:${id}`);
  }

  /**
   * Atomically increment daily_ticket_counter and return the new value.
   * Used when creating a new queue entry to assign the next ticket number.
   *
   * Concurrency: PostgreSQL's UPDATE acquires an implicit row-level lock on
   * the queues row. Concurrent joins for the same queue serialize here,
   * guaranteeing unique ticket numbers with no advisory locks needed.
   *
   * Pass `client` to run inside an existing transaction (required so the
   * increment and the queue_entries.create are committed atomically).
   */
  async incrementAndGetCounter(
    id: string,
    client?: PoolClient
  ): Promise<{ ticketNumber: number; businessDate: string }> {
    const sql = `
      UPDATE queues q
      SET daily_ticket_counter = CASE
            WHEN q.counter_business_date = (NOW() AT TIME ZONE o.timezone)::date
              THEN q.daily_ticket_counter + 1
            ELSE 1
          END,
          counter_business_date = (NOW() AT TIME ZONE o.timezone)::date,
          last_counter_reset_at = CASE
            WHEN q.counter_business_date IS DISTINCT FROM (NOW() AT TIME ZONE o.timezone)::date
              THEN NOW()
            ELSE q.last_counter_reset_at
          END
      FROM organizations o
      WHERE q.id = $1 AND o.id = q.organization_id
      RETURNING q.daily_ticket_counter, q.counter_business_date
    `;
    const rows = client
      ? await this.queryTx<{ daily_ticket_counter: number; counter_business_date: string }>(
          client,
          sql,
          [id]
        )
      : await this.query<{ daily_ticket_counter: number; counter_business_date: string }>(sql, [
          id,
        ]);
    const row = this.firstOrThrow(rows, 'queues.incrementAndGetCounter');
    return { ticketNumber: row.daily_ticket_counter, businessDate: row.counter_business_date };
  }

  async resetDailyCounter(id: string): Promise<void> {
    await this.query(
      `UPDATE queues SET daily_ticket_counter = 0, last_counter_reset_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  /**
   * How many entries are currently waiting ahead of a given ticket?
   * Used for realtime position lookup.
   * Hits idx_qe_queue_waiting (partial index, very fast).
   */
  async getWaitingPosition(
    queueId: string,
    priority: number,
    ticketNumber: number
  ): Promise<number> {
    const row = await this.queryOne<{ pos: string }>(
      `SELECT COUNT(*) AS pos
       FROM queue_entries
       WHERE queue_id = $1
         AND status = 'waiting'
         AND (priority > $2 OR (priority = $2 AND ticket_number < $3))`,
      [queueId, priority, ticketNumber]
    );
    return Number(row?.pos ?? 0);
  }

  /**
   * Count all currently waiting entries (capacity check before allowing join).
   */
  async countWaiting(queueId: string, client?: PoolClient): Promise<number> {
    const sql = `SELECT COUNT(*) AS cnt FROM queue_entries
       WHERE queue_id = $1 AND status IN ('waiting','called','serving')`;
    const rows = client
      ? await this.queryTx<{ cnt: string }>(client, sql, [queueId])
      : await this.query<{ cnt: string }>(sql, [queueId]);
    return Number(rows[0]?.cnt ?? 0);
  }
}

export const queuesRepository = new QueuesRepository();
