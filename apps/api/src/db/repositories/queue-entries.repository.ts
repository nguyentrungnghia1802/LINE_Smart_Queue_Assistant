import { PoolClient } from 'pg';

import { BaseRepository } from './base.repository';

// ── Row types ──────────────────────────────────────────────────────────────────

export interface QueueEntryRow {
  id: string;
  queue_id: string;
  user_id: string | null;
  order_id: string | null;
  line_user_id: string | null;
  ticket_number: number;
  /** Human-readable ticket code, e.g. "A003". */
  ticket_code: string;
  business_date?: string;
  status: string;
  priority: number;
  position_snapshot: number | null;
  estimated_wait_seconds: number | null;
  called_at: Date | null;
  serving_started_at: Date | null;
  served_at: Date | null;
  skipped_at: Date | null;
  cancelled_at: Date | null;
  no_show_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ── Params ─────────────────────────────────────────────────────────────────────

export interface CreateEntryParams {
  queueId: string;
  ticketNumber: number;
  ticketCode: string;
  businessDate: string;
  userId?: string;
  orderId?: string;
  lineUserId?: string;
  priority?: number;
}

// ── Repository ─────────────────────────────────────────────────────────────────

export class QueueEntriesRepository extends BaseRepository {
  async findById(id: string, client?: PoolClient): Promise<QueueEntryRow | null> {
    const sql = 'SELECT * FROM queue_entries WHERE id = $1';
    const rows = client
      ? await this.queryTx<QueueEntryRow>(client, sql, [id])
      : await this.query<QueueEntryRow>(sql, [id]);
    return rows[0] ?? null;
  }

  async findActiveByLineUser(lineUserId: string, queueId: string): Promise<QueueEntryRow | null> {
    return this.queryOne<QueueEntryRow>(
      `SELECT * FROM queue_entries
       WHERE line_user_id = $1 AND queue_id = $2
         AND status IN ('waiting', 'called', 'serving')`,
      [lineUserId, queueId]
    );
  }

  async findActiveByUser(userId: string, queueId: string): Promise<QueueEntryRow | null> {
    return this.queryOne<QueueEntryRow>(
      `SELECT * FROM queue_entries
       WHERE user_id = $1 AND queue_id = $2
         AND status IN ('waiting', 'called', 'serving')`,
      [userId, queueId]
    );
  }

  async listWaiting(queueId: string, client?: PoolClient): Promise<QueueEntryRow[]> {
    const sql = `
      SELECT * FROM queue_entries
      WHERE queue_id = $1 AND status = 'waiting'
      ORDER BY priority DESC, ticket_number ASC
    `;
    return client
      ? this.queryTx<QueueEntryRow>(client, sql, [queueId])
      : this.query<QueueEntryRow>(sql, [queueId]);
  }

  async create(params: CreateEntryParams, client?: PoolClient): Promise<QueueEntryRow> {
    const sql = `
      INSERT INTO queue_entries
        (queue_id, user_id, order_id, line_user_id, ticket_number, ticket_code, business_date, priority)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `;
    const args = [
      params.queueId,
      params.userId ?? null,
      params.orderId ?? null,
      params.lineUserId ?? null,
      params.ticketNumber,
      params.ticketCode,
      params.businessDate,
      params.priority ?? 0,
    ];
    const rows = client
      ? await this.queryTx<QueueEntryRow>(client, sql, args)
      : await this.query<QueueEntryRow>(sql, args);
    return this.firstOrThrow(rows, 'queueEntries.create');
  }

  async linkOrder(id: string, orderId: string, client?: PoolClient): Promise<QueueEntryRow> {
    const sql = `UPDATE queue_entries SET order_id = $2 WHERE id = $1 RETURNING *`;
    const rows = client
      ? await this.queryTx<QueueEntryRow>(client, sql, [id, orderId])
      : await this.query<QueueEntryRow>(sql, [id, orderId]);
    return this.firstOrThrow(rows, 'queueEntries.linkOrder');
  }

  async markCalled(id: string, client?: PoolClient): Promise<QueueEntryRow> {
    const sql = `UPDATE queue_entries SET status = 'called', called_at = NOW()
      WHERE id = $1 AND status = 'waiting' RETURNING *`;
    const rows = client
      ? await this.queryTx<QueueEntryRow>(client, sql, [id])
      : await this.query<QueueEntryRow>(sql, [id]);
    return this.firstOrThrow(rows, 'queueEntries.markCalled');
  }

  async markServing(id: string, client?: PoolClient): Promise<QueueEntryRow> {
    const sql = `UPDATE queue_entries SET status = 'serving', serving_started_at = NOW()
      WHERE id = $1 AND status = 'called' RETURNING *`;
    const rows = client
      ? await this.queryTx<QueueEntryRow>(client, sql, [id])
      : await this.query<QueueEntryRow>(sql, [id]);
    return this.firstOrThrow(rows, 'queueEntries.markServing');
  }

  /** Status 'served' (was 'completed' in old schema). */
  async markServed(id: string, client?: PoolClient): Promise<QueueEntryRow> {
    const sql = `UPDATE queue_entries SET status = 'served', served_at = NOW()
      WHERE id = $1 AND status = 'serving' RETURNING *`;
    const rows = client
      ? await this.queryTx<QueueEntryRow>(client, sql, [id])
      : await this.query<QueueEntryRow>(sql, [id]);
    return this.firstOrThrow(rows, 'queueEntries.markServed');
  }

  async markSkipped(id: string, client?: PoolClient): Promise<QueueEntryRow> {
    const sql = `UPDATE queue_entries SET status = 'skipped', skipped_at = NOW()
      WHERE id = $1 AND status = 'called' RETURNING *`;
    const rows = client
      ? await this.queryTx<QueueEntryRow>(client, sql, [id])
      : await this.query<QueueEntryRow>(sql, [id]);
    return this.firstOrThrow(rows, 'queueEntries.markSkipped');
  }

  async markCancelled(id: string, client?: PoolClient): Promise<QueueEntryRow> {
    const sql = `UPDATE queue_entries SET status = 'cancelled', cancelled_at = NOW()
      WHERE id = $1 AND status IN ('waiting', 'called') RETURNING *`;
    const rows = client
      ? await this.queryTx<QueueEntryRow>(client, sql, [id])
      : await this.query<QueueEntryRow>(sql, [id]);
    return this.firstOrThrow(rows, 'queueEntries.markCancelled');
  }

  async markNoShow(id: string, client?: PoolClient): Promise<QueueEntryRow> {
    const sql = `UPDATE queue_entries SET status = 'no_show', no_show_at = NOW()
      WHERE id = $1 AND status = 'called' RETURNING *`;
    const rows = client
      ? await this.queryTx<QueueEntryRow>(client, sql, [id])
      : await this.query<QueueEntryRow>(sql, [id]);
    return this.firstOrThrow(rows, 'queueEntries.markNoShow');
  }

  async findByQueueAndStatus(queueId: string, status: string): Promise<QueueEntryRow | null> {
    return this.queryOne<QueueEntryRow>(
      `SELECT * FROM queue_entries WHERE queue_id = $1 AND status = $2
       ORDER BY updated_at DESC LIMIT 1`,
      [queueId, status]
    );
  }

  /** Decrement priority by 1 (customer self-service skip). */
  async deprioritize(id: string, client?: PoolClient): Promise<QueueEntryRow> {
    const sql = `UPDATE queue_entries SET priority = GREATEST(0, priority - 1)
      WHERE id = $1 AND status = 'waiting' RETURNING *`;
    const rows = client
      ? await this.queryTx<QueueEntryRow>(client, sql, [id])
      : await this.query<QueueEntryRow>(sql, [id]);
    return this.firstOrThrow(rows, 'queueEntries.deprioritize');
  }

  async getEntryIdsAhead(
    queueId: string,
    priority: number,
    ticketNumber: number
  ): Promise<string[]> {
    const rows = await this.query<{ id: string }>(
      `SELECT id FROM queue_entries
       WHERE queue_id = $1 AND status IN ('waiting', 'called', 'serving')
         AND (priority > $2 OR (priority = $2 AND ticket_number < $3))
       ORDER BY priority DESC, ticket_number ASC`,
      [queueId, priority, ticketNumber]
    );
    return rows.map((r) => r.id);
  }

  async findAllActiveForActor(userId?: string, lineUserId?: string): Promise<QueueEntryRow[]> {
    if (!userId && !lineUserId) return [];
    const conditions: string[] = ["status IN ('waiting', 'called', 'serving')"];
    const params: unknown[] = [];
    let idx = 1;
    if (userId && lineUserId) {
      conditions.push(`(user_id = $${idx++} OR line_user_id = $${idx++})`);
      params.push(userId, lineUserId);
    } else if (userId) {
      conditions.push(`user_id = $${idx++}`);
      params.push(userId);
    } else {
      conditions.push(`line_user_id = $${idx++}`);
      params.push(lineUserId);
    }
    return this.query<QueueEntryRow>(
      `SELECT * FROM queue_entries WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      params
    );
  }

  /**
   * Bulk-update estimated_wait_seconds for all waiting entries in a queue.
   */
  async bulkUpdateEta(queueId: string, avgServiceSeconds: number): Promise<void> {
    await this.query(
      `WITH ranked AS (
         SELECT id, (ROW_NUMBER() OVER (ORDER BY priority DESC, ticket_number ASC) - 1) AS pos
         FROM queue_entries WHERE queue_id = $1 AND status = 'waiting'
       )
       UPDATE queue_entries
       SET estimated_wait_seconds = (ranked.pos * $2)::int
       FROM ranked WHERE queue_entries.id = ranked.id`,
      [queueId, avgServiceSeconds]
    );
  }

  /**
   * Archive a terminal entry to queue_histories.
   */
  async archiveToHistory(
    entry: QueueEntryRow,
    fromStatus: string,
    toStatus: string,
    reason?: string,
    client?: PoolClient,
    actorUserId?: string
  ): Promise<void> {
    const waitSeconds =
      entry.serving_started_at && entry.created_at
        ? Math.max(
            0,
            Math.round((entry.serving_started_at.getTime() - entry.created_at.getTime()) / 1000)
          )
        : null;
    const serviceSeconds =
      entry.served_at && entry.serving_started_at
        ? Math.max(
            0,
            Math.round((entry.served_at.getTime() - entry.serving_started_at.getTime()) / 1000)
          )
        : null;
    const sql = `
      INSERT INTO queue_histories
        (queue_entry_id, queue_id, organization_id, actor_id, line_user_id,
         ticket_number, ticket_code, from_status, to_status, reason,
         wait_seconds, service_seconds, metadata, created_at)
      SELECT $1, q.id, q.organization_id, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      FROM queues q WHERE q.id = $2`;
    const args = [
      entry.id,
      entry.queue_id,
      actorUserId ?? null,
      entry.line_user_id,
      entry.ticket_number,
      entry.ticket_code,
      fromStatus,
      toStatus,
      reason ?? null,
      waitSeconds,
      serviceSeconds,
      '{}',
      entry.created_at,
    ];
    if (client) {
      await this.queryTx(client, sql, args);
    } else {
      await this.query(sql, args);
    }
  }

  async findNearThresholdWaiting(
    threshold: number
  ): Promise<Array<QueueEntryRow & { ahead_count: number }>> {
    return this.query<QueueEntryRow & { ahead_count: number }>(
      `WITH ranked AS (
         SELECT e.*,
           (ROW_NUMBER() OVER (PARTITION BY e.queue_id ORDER BY e.priority DESC, e.ticket_number ASC) - 1)::int AS ahead_count
         FROM queue_entries e
         JOIN queues q ON q.id = e.queue_id
         WHERE e.status = 'waiting' AND q.status = 'open' AND q.is_active = TRUE AND e.line_user_id IS NOT NULL
       )
       SELECT * FROM ranked WHERE ahead_count BETWEEN 1 AND $1`,
      [threshold]
    );
  }

  async findRecentlyCalled(maxAgeMinutes: number, minAgeSeconds: number): Promise<QueueEntryRow[]> {
    return this.query<QueueEntryRow>(
      `SELECT * FROM queue_entries
       WHERE status = 'called'
         AND called_at >= NOW() - ($1 * INTERVAL '1 minute')
         AND called_at <  NOW() - ($2 * INTERVAL '1 second')
         AND line_user_id IS NOT NULL`,
      [maxAgeMinutes, minAgeSeconds]
    );
  }
}

export const queueEntriesRepository = new QueueEntriesRepository();
