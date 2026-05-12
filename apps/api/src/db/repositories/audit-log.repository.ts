import { BaseRepository } from './base.repository';

// ── Row types ──────────────────────────────────────────────────────────────────

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  actor_type: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  organization_id: string | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

// ── Params ─────────────────────────────────────────────────────────────────────

export interface CreateAuditLogParams {
  actorId?: string;
  actorType?: 'user' | 'staff' | 'system' | 'webhook' | 'cron';
  action: string;
  resourceType: string;
  resourceId?: string;
  organizationId?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// ── Repository ─────────────────────────────────────────────────────────────────

export class AuditLogRepository extends BaseRepository {
  /**
   * Insert an audit log entry.
   * Fire-and-forget: callers should not await on the hot path if failures are acceptable.
   */
  async create(params: CreateAuditLogParams): Promise<AuditLogRow> {
    const sql = `
      INSERT INTO audit_logs
        (actor_id, actor_type, action, resource_type, resource_id,
         organization_id, changes, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const rows = await this.query<AuditLogRow>(sql, [
      params.actorId ?? null,
      params.actorType ?? 'user',
      params.action,
      params.resourceType,
      params.resourceId ?? null,
      params.organizationId ?? null,
      params.changes ? JSON.stringify(params.changes) : null,
      params.ipAddress ?? null,
      params.userAgent ?? null,
    ]);
    return this.firstOrThrow(rows, 'auditLog.create');
  }

  /**
   * List recent audit log entries for a specific resource.
   * Used by staff/admin overviews. Returns newest first, capped at limit.
   */
  async findByResource(
    resourceType: string,
    resourceId: string,
    limit = 50
  ): Promise<AuditLogRow[]> {
    return this.query<AuditLogRow>(
      `SELECT * FROM audit_logs
       WHERE resource_type = $1 AND resource_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [resourceType, resourceId, limit]
    );
  }
}

export const auditLogRepository = new AuditLogRepository();
