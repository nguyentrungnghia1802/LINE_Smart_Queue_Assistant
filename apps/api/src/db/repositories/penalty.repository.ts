import { BaseRepository } from './base.repository';

// ── Row types ──────────────────────────────────────────────────────────────────

export interface PenaltyRecordRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  queue_id: string | null;
  queue_entry_id: string | null;
  type: 'skip' | 'no_show' | 'abuse';
  severity: 'warning' | 'minor' | 'major' | 'ban';
  is_active: boolean;
  applied_at: Date;
  expires_at: Date | null;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
}

// ── Params ─────────────────────────────────────────────────────────────────────

export interface CreatePenaltyParams {
  userId: string;
  organizationId?: string;
  queueId?: string;
  queueEntryId?: string;
  type: PenaltyRecordRow['type'];
  severity: PenaltyRecordRow['severity'];
  expiresAt?: Date | null;
  notes?: string;
  createdBy?: string;
}

// ── Repository ─────────────────────────────────────────────────────────────────

class PenaltyRepository extends BaseRepository {
  /**
   * Insert a new penalty record.
   */
  async create(params: CreatePenaltyParams): Promise<PenaltyRecordRow> {
    return this.firstOrThrow(
      await this.query<PenaltyRecordRow>(
        `INSERT INTO penalty_records
           (user_id, organization_id, queue_id, queue_entry_id,
            type, severity, expires_at, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          params.userId,
          params.organizationId ?? null,
          params.queueId ?? null,
          params.queueEntryId ?? null,
          params.type,
          params.severity,
          params.expiresAt ?? null,
          params.notes ?? null,
          params.createdBy ?? null,
        ]
      ),
      'penalty.create'
    );
  }

  /**
   * Active penalties for a user, optionally scoped to an organization.
   *
   * An "active" penalty satisfies:
   *   is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())
   *
   * When organizationId is provided, returns penalties scoped to that org
   * plus platform-wide penalties (organization_id IS NULL).
   *
   * Hits idx_penalty_user_active.
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
         AND is_active = TRUE
         AND (expires_at IS NULL OR expires_at > NOW())
         ${orgClause}
       ORDER BY applied_at DESC`,
      params
    );
  }

  /**
   * Count active penalties for a user in an organization.
   * Used to decide whether to apply a join-time priority deduction.
   */
  async countActiveByUser(userId: string, organizationId?: string): Promise<number> {
    const rows = await this.findActiveByUser(userId, organizationId);
    return rows.length;
  }
}

export const penaltyRepository = new PenaltyRepository();
