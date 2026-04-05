import { BaseRepository } from './base.repository';

// ── Row types ──────────────────────────────────────────────────────────────────

export interface QueueRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: string;
  queue_type: string;
  prefix: string;
  max_capacity: number | null;
  daily_ticket_counter: number;
  last_counter_reset_at: Date;
  avg_service_seconds: number;
  notify_ahead_positions: number;
  allow_skip: boolean;
  max_skips_before_penalty: number;
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
  name: string;
  description?: string;
  prefix?: string;
  queueType?: string;
  maxCapacity?: number;
  avgServiceSeconds?: number;
  notifyAheadPositions?: number;
  allowSkip?: boolean;
  maxSkipsBeforePenalty?: number;
  opensAt?: string;
  closesAt?: string;
  settings?: Record<string, unknown>;
}

// ── Repository ─────────────────────────────────────────────────────────────────

export class QueuesRepository extends BaseRepository {
  async findById(id: string): Promise<QueueRow | null> {
    return this.queryOne<QueueRow>('SELECT * FROM queues WHERE id = $1 AND is_active = TRUE', [id]);
  }

  /**
   * All open (or paused/disaster_mode) queues for an org — used by LIFF home.
   * Hits idx_queues_org_active.
   */
  async findActiveByOrg(organizationId: string): Promise<QueueRow[]> {
    return this.query<QueueRow>(
      `SELECT * FROM queues
       WHERE organization_id = $1 AND is_active = TRUE
       ORDER BY name`,
      [organizationId]
    );
  }

  async create(params: CreateQueueParams): Promise<QueueRow> {
    const sql = `
      INSERT INTO queues
        (organization_id, name, description, prefix, queue_type,
         max_capacity, avg_service_seconds, notify_ahead_positions,
         allow_skip, max_skips_before_penalty, opens_at, closes_at, settings)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `;
    const rows = await this.query<QueueRow>(sql, [
      params.organizationId,
      params.name,
      params.description ?? null,
      params.prefix ?? '',
      params.queueType ?? 'walk_in',
      params.maxCapacity ?? null,
      params.avgServiceSeconds ?? 300,
      params.notifyAheadPositions ?? 3,
      params.allowSkip ?? true,
      params.maxSkipsBeforePenalty ?? 2,
      params.opensAt ?? null,
      params.closesAt ?? null,
      JSON.stringify(params.settings ?? {}),
    ]);
    return this.firstOrThrow(rows, 'queues.create');
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.query('UPDATE queues SET status = $1 WHERE id = $2', [status, id]);
  }

  /**
   * Atomically increment daily_ticket_counter and return the new value.
   * Used when creating a new queue entry to assign the next ticket number.
   * Safe for concurrent requests — PostgreSQL row-level lock on UPDATE.
   */
  async incrementAndGetCounter(id: string): Promise<number> {
    const row = await this.queryOne<{ daily_ticket_counter: number }>(
      `UPDATE queues
       SET daily_ticket_counter = daily_ticket_counter + 1
       WHERE id = $1
       RETURNING daily_ticket_counter`,
      [id]
    );
    return this.firstOrThrow(row ? [row] : [], 'queues.incrementAndGetCounter')
      .daily_ticket_counter;
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
  async countWaiting(queueId: string): Promise<number> {
    const row = await this.queryOne<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM queue_entries
       WHERE queue_id = $1 AND status = 'waiting'`,
      [queueId]
    );
    return Number(row?.cnt ?? 0);
  }
}

export const queuesRepository = new QueuesRepository();
