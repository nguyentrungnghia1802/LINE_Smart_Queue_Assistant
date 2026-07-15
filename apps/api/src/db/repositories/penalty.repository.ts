import { BaseRepository } from './base.repository';

// ── Row types ──────────────────────────────────────────────────────────────────

export interface PenaltyRecordRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  queue_id: string | null;
  queue_entry_id: string | null;
  penalty_type: 'no_show' | 'late_arrival' | 'excessive_cancel' | 'manual';
  points: number;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

// ── Params ─────────────────────────────────────────────────────────────────────

export interface CreatePenaltyParams {
  userId: string;
  organizationId?: string;
  queueId?: string;
  queueEntryId?: string;
  penaltyType: PenaltyRecordRow['penalty_type'];
  points?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// ── Repository ─────────────────────────────────────────────────────────────────

class PenaltyRepository extends BaseRepository {
  async create(params: CreatePenaltyParams): Promise<PenaltyRecordRow> {
    return this.firstOrThrow(
      await this.query<PenaltyRecordRow>(
        `INSERT INTO penalty_records
           (user_id, organization_id, queue_id, queue_entry_id,
            penalty_type, points, reason, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          params.userId,
          params.organizationId ?? null,
          params.queueId ?? null,
          params.queueEntryId ?? null,
          params.penaltyType,
          params.points ?? 1,
          params.reason ?? null,
          JSON.stringify(params.metadata ?? {}),
        ]
      ),
      'penalty.create'
    );
  }

  /**
   * Recent penalties for a user, optionally scoped to an organization.
   * New schema has no is_active or expires_at — penalties are permanent records.
   * "Active" means created within the last 24 hours.
   */
  async findActiveByUser(userId: string, organizationId?: string): Promise<PenaltyRecordRow[]> {
    const params: unknown[] = [userId];
    let orgClause = '';
    if (organizationId) {
      params.push(organizationId);
      orgClause = `AND (organization_id = $2 OR organization_id IS NULL)`;
    }
    return this.query<PenaltyRecordRow>(
      `SELECT * FROM penalty_records
       WHERE user_id = $1
         AND created_at > NOW() - INTERVAL '24 hours'
         ${orgClause}
       ORDER BY created_at DESC`,
      params
    );
  }

  async countActiveByUser(userId: string, organizationId?: string): Promise<number> {
    const rows = await this.findActiveByUser(userId, organizationId);
    return rows.length;
  }

  async findByUser(userId: string, limit = 20): Promise<PenaltyRecordRow[]> {
    return this.query<PenaltyRecordRow>(
      `SELECT * FROM penalty_records WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
  }
}

export const penaltyRepository = new PenaltyRepository();
