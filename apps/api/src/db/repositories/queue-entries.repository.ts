import { PoolClient } from 'pg';

import { BaseRepository } from './base.repository';

// ── Row types ──────────────────────────────────────────────────────────────────

export interface QueueEntryRow {
  id: string;
  queue_id: string;
  user_id: string | null;
  line_user_id: string | null;
  ticket_number: number;
  ticket_display: string;
  status: string;
  skip_count: number;
  priority: number;
  notes: string | null;
  metadata: Record<string, unknown>;
  called_at: Date | null;
  serving_at: Date | null;
  completed_at: Date | null;
  skipped_at: Date | null;
  cancelled_at: Date | null;
  estimated_call_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ── Params ─────────────────────────────────────────────────────────────────────

export interface CreateEntryParams {
  queueId: string;
  ticketNumber: number;
  ticketDisplay: string;
  userId?: string;
  lineUserId?: string;
  priority?: number;
  metadata?: Record<string, unknown>;
}

// ── Repository ─────────────────────────────────────────────────────────────────

export class QueueEntriesRepository extends BaseRepository {
  async findById(id: string): Promise<QueueEntryRow | null> {
    return this.queryOne<QueueEntryRow>('SELECT * FROM queue_entries WHERE id = $1', [id]);
  }

  /**
   * Find the active ticket for a LINE user in a specific queue.
   * Hits idx_qe_line_user_active — used on each webhook message.
   */
  async findActiveByLineUser(lineUserId: string, queueId: string): Promise<QueueEntryRow | null> {
    return this.queryOne<QueueEntryRow>(
      `SELECT * FROM queue_entries
       WHERE line_user_id = $1
         AND queue_id = $2
         AND status IN ('waiting', 'called', 'serving')`,
      [lineUserId, queueId]
    );
  }

  /**
   * Find active ticket for a registered user in any queue of an org.
   * Used to enforce one-ticket-per-queue rule.
   */
  async findActiveByUser(userId: string, queueId: string): Promise<QueueEntryRow | null> {
    return this.queryOne<QueueEntryRow>(
      `SELECT * FROM queue_entries
       WHERE user_id = $1
         AND queue_id = $2
         AND status IN ('waiting', 'called', 'serving')`,
      [userId, queueId]
    );
  }

  /**
   * All waiting entries for a queue, ordered for serving (priority DESC, FIFO).
   * Staff queue board uses this to show the live list.
   */
  async listWaiting(queueId: string): Promise<QueueEntryRow[]> {
    return this.query<QueueEntryRow>(
      `SELECT * FROM queue_entries
       WHERE queue_id = $1 AND status = 'waiting'
       ORDER BY priority DESC, ticket_number ASC`,
      [queueId]
    );
  }

  /** Insert a new entry. Use inside withTransaction together with incrementAndGetCounter. */
  async create(params: CreateEntryParams, client?: PoolClient): Promise<QueueEntryRow> {
    const sql = `
      INSERT INTO queue_entries
        (queue_id, user_id, line_user_id, ticket_number, ticket_display, priority, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `;
    const args = [
      params.queueId,
      params.userId ?? null,
      params.lineUserId ?? null,
      params.ticketNumber,
      params.ticketDisplay,
      params.priority ?? 0,
      JSON.stringify(params.metadata ?? {}),
    ];
    const rows = client
      ? await this.queryTx<QueueEntryRow>(client, sql, args)
      : await this.query<QueueEntryRow>(sql, args);
    return this.firstOrThrow(rows, 'queueEntries.create');
  }

  /** Transition entry to 'called' and record called_at timestamp. */
  async markCalled(id: string, client?: PoolClient): Promise<QueueEntryRow> {
    const sql = `
      UPDATE queue_entries
      SET status = 'called', called_at = NOW()
      WHERE id = $1 AND status = 'waiting'
      RETURNING *
    `;
    const rows = client
      ? await this.queryTx<QueueEntryRow>(client, sql, [id])
      : await this.query<QueueEntryRow>(sql, [id]);
    return this.firstOrThrow(rows, 'queueEntries.markCalled');
  }

  /** Transition entry to 'serving' and record serving_at. */
  async markServing(id: string, client?: PoolClient): Promise<QueueEntryRow> {
    const sql = `
      UPDATE queue_entries
      SET status = 'serving', serving_at = NOW()
      WHERE id = $1 AND status = 'called'
      RETURNING *
    `;
    const rows = client
      ? await this.queryTx<QueueEntryRow>(client, sql, [id])
      : await this.query<QueueEntryRow>(sql, [id]);
    return this.firstOrThrow(rows, 'queueEntries.markServing');
  }

  /** Transition to 'completed' and write queue_histories row within same transaction. */
  async markCompleted(id: string, client?: PoolClient): Promise<QueueEntryRow> {
    const sql = `
      UPDATE queue_entries
      SET status = 'completed', completed_at = NOW()
      WHERE id = $1 AND status = 'serving'
      RETURNING *
    `;
    const rows = client
      ? await this.queryTx<QueueEntryRow>(client, sql, [id])
      : await this.query<QueueEntryRow>(sql, [id]);
    return this.firstOrThrow(rows, 'queueEntries.markCompleted');
  }

  /** Transition to 'skipped' and increment skip_count. */
  async markSkipped(id: string, client?: PoolClient): Promise<QueueEntryRow> {
    const sql = `
      UPDATE queue_entries
      SET status = 'skipped', skipped_at = NOW(), skip_count = skip_count + 1
      WHERE id = $1 AND status = 'called'
      RETURNING *
    `;
    const rows = client
      ? await this.queryTx<QueueEntryRow>(client, sql, [id])
      : await this.query<QueueEntryRow>(sql, [id]);
    return this.firstOrThrow(rows, 'queueEntries.markSkipped');
  }

  /** Transition to 'cancelled' (customer self-service or staff action). */
  async markCancelled(id: string, client?: PoolClient): Promise<QueueEntryRow> {
    const sql = `
      UPDATE queue_entries
      SET status = 'cancelled', cancelled_at = NOW()
      WHERE id = $1 AND status IN ('waiting', 'called')
      RETURNING *
    `;
    const rows = client
      ? await this.queryTx<QueueEntryRow>(client, sql, [id])
      : await this.query<QueueEntryRow>(sql, [id]);
    return this.firstOrThrow(rows, 'queueEntries.markCancelled');
  }

  /**
   * Bulk update estimated_call_at for all waiting entries in a queue.
   * Called by the ETA background worker.
   *
   * Each row's ETA = NOW() + (position * avgServiceSeconds) seconds.
   * Uses a window function to compute row number within the queue.
   */
  async bulkUpdateEta(queueId: string, avgServiceSeconds: number): Promise<void> {
    await this.query(
      `UPDATE queue_entries AS qe
       SET estimated_call_at = NOW() + (
         (ROW_NUMBER() OVER (
           PARTITION BY qe.queue_id
           ORDER BY qe.priority DESC, qe.ticket_number ASC
         ) - 1) * $2
       ) * INTERVAL '1 second'
       FROM (
         SELECT id FROM queue_entries
         WHERE queue_id = $1 AND status = 'waiting'
       ) AS waiting
       WHERE qe.id = waiting.id`,
      [queueId, avgServiceSeconds]
    );
  }

  async archiveToHistory(entry: QueueEntryRow, client?: PoolClient): Promise<void> {
    const waitedSeconds =
      entry.serving_at && entry.created_at
        ? Math.round((entry.serving_at.getTime() - entry.created_at.getTime()) / 1000)
        : null;

    const servedSeconds =
      entry.completed_at && entry.serving_at
        ? Math.round((entry.completed_at.getTime() - entry.serving_at.getTime()) / 1000)
        : null;

    const sql = `
      INSERT INTO queue_histories
        (queue_entry_id, queue_id, organization_id, user_id, line_user_id,
         ticket_number, ticket_display, final_status, skip_count,
         waited_seconds, served_seconds, metadata, created_at)
      SELECT
        $1, q.id,  q.organization_id, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12
      FROM queues q WHERE q.id = $2
    `;
    const args = [
      entry.id,
      entry.queue_id,
      entry.user_id,
      entry.line_user_id,
      entry.ticket_number,
      entry.ticket_display,
      entry.status,
      entry.skip_count,
      waitedSeconds,
      servedSeconds,
      JSON.stringify(entry.metadata),
      entry.created_at,
    ];
    if (client) {
      await this.queryTx(client, sql, args);
    } else {
      await this.query(sql, args);
    }
  }
}

export const queueEntriesRepository = new QueueEntriesRepository();
