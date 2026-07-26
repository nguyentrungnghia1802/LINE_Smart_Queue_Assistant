import type { PoolClient } from 'pg';

import { BaseRepository } from '../../db/repositories/base.repository';

export interface BranchRow {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  phone: string;
  email: string | null;
  postal_code: string;
  prefecture: string;
  city: string;
  address_line1: string;
  address_line2: string | null;
  timezone: string;
  is_active: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface BranchSummaryRow extends BranchRow {
  queue_id: string | null;
  queue_name: string | null;
  manager_count: number;
  staff_count: number;
  managers: Array<{
    id: string;
    displayName: string;
    email: string;
    accountStatus: string;
    isOwner: boolean;
  }>;
}

export interface OrganizationAuditRow {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  changes: Record<string, unknown> | null;
  created_at: Date;
}

export class BranchesRepository extends BaseRepository {
  async list(organizationId: string): Promise<BranchSummaryRow[]> {
    return this.query<BranchSummaryRow>(
      `SELECT b.*,
              q.id AS queue_id,
              q.name AS queue_name,
              COUNT(*) FILTER (
                WHERE bm.role = 'manager' AND bm.deactivated_at IS NULL
              )::INT AS manager_count,
              COUNT(*) FILTER (
                WHERE bm.role = 'staff' AND bm.deactivated_at IS NULL
              )::INT AS staff_count,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', u.id,
                  'displayName', u.display_name,
                  'email', u.email,
                  'accountStatus', u.account_status,
                  'isOwner', om.is_owner
                ) ORDER BY om.is_owner DESC, u.display_name)
                FROM branch_memberships managers
                JOIN users u ON u.id = managers.user_id
                JOIN organization_members om
                  ON om.organization_id = managers.organization_id
                 AND om.user_id = managers.user_id
                WHERE managers.branch_id = b.id
                  AND managers.role = 'manager'
                  AND managers.deactivated_at IS NULL
              ), '[]'::jsonb) AS managers
       FROM organization_branches b
       LEFT JOIN queues q ON q.branch_id = b.id AND q.is_active = TRUE
       LEFT JOIN branch_memberships bm ON bm.branch_id = b.id
       WHERE b.organization_id = $1 AND b.is_active = TRUE
       GROUP BY b.id, q.id, q.name
       ORDER BY b.created_at, b.id`,
      [organizationId]
    );
  }

  async findById(
    id: string,
    organizationId: string,
    client?: PoolClient
  ): Promise<BranchRow | null> {
    const sql =
      'SELECT * FROM organization_branches WHERE id = $1 AND organization_id = $2 AND is_active = TRUE';
    return client
      ? this.queryOneTx<BranchRow>(client, sql, [id, organizationId])
      : this.queryOne<BranchRow>(sql, [id, organizationId]);
  }

  async create(
    params: {
      organizationId: string;
      name: string;
      code: string;
      phone: string;
      email?: string | null;
      postalCode: string;
      prefecture: string;
      city: string;
      addressLine1: string;
      addressLine2?: string | null;
      createdBy: string;
    },
    client: PoolClient
  ): Promise<BranchRow> {
    const rows = await this.queryTx<BranchRow>(
      client,
      `INSERT INTO organization_branches (
         organization_id, name, code, phone, email, postal_code, prefecture,
         city, address_line1, address_line2, created_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        params.organizationId,
        params.name,
        params.code,
        params.phone,
        params.email ?? null,
        params.postalCode,
        params.prefecture,
        params.city,
        params.addressLine1,
        params.addressLine2 ?? null,
        params.createdBy,
      ]
    );
    return this.firstOrThrow(rows, 'branches.create');
  }

  async assignMember(
    params: {
      organizationId: string;
      branchId: string;
      userId: string;
      role: 'manager' | 'staff';
      assignedBy: string;
      isActive?: boolean;
    },
    client: PoolClient
  ): Promise<void> {
    await client.query(
      `INSERT INTO branch_memberships (
         organization_id, branch_id, user_id, role, is_active, assigned_by
       )
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (branch_id, user_id) DO UPDATE SET
         role = EXCLUDED.role,
         is_active = EXCLUDED.is_active,
         assigned_by = EXCLUDED.assigned_by,
         assigned_at = NOW(),
         deactivated_at = NULL`,
      [
        params.organizationId,
        params.branchId,
        params.userId,
        params.role,
        params.isActive ?? false,
        params.assignedBy,
      ]
    );
  }

  async findManagerAssignment(
    branchId: string,
    organizationId: string,
    userId: string,
    client: PoolClient
  ): Promise<{ is_owner: boolean; deactivated_at: Date | null } | null> {
    const rows = await this.queryTx<{ is_owner: boolean; deactivated_at: Date | null }>(
      client,
      `SELECT om.is_owner, bm.deactivated_at
       FROM branch_memberships bm
       JOIN organization_members om
         ON om.organization_id = bm.organization_id AND om.user_id = bm.user_id
       WHERE bm.branch_id = $1
         AND bm.organization_id = $2
         AND bm.user_id = $3
         AND bm.role = 'manager'
       FOR UPDATE OF bm, om`,
      [branchId, organizationId, userId]
    );
    return rows[0] ?? null;
  }

  async countAssignedManagers(
    branchId: string,
    exceptUserId: string,
    client: PoolClient
  ): Promise<number> {
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count
       FROM branch_memberships
       WHERE branch_id = $1
         AND role = 'manager'
         AND user_id <> $2
         AND deactivated_at IS NULL`,
      [branchId, exceptUserId]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async deactivateManager(
    branchId: string,
    organizationId: string,
    userId: string,
    actorId: string,
    client: PoolClient
  ): Promise<void> {
    await client.query(
      `UPDATE branch_memberships
       SET is_active = FALSE, deactivated_at = NOW()
       WHERE branch_id = $1 AND organization_id = $2 AND user_id = $3`,
      [branchId, organizationId, userId]
    );
    const remaining = await client.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count
       FROM branch_memberships
       WHERE organization_id = $1
         AND user_id = $2
         AND role = 'manager'
         AND deactivated_at IS NULL`,
      [organizationId, userId]
    );
    if (Number(remaining.rows[0]?.count ?? 0) === 0) {
      await client.query(
        `UPDATE organization_members
         SET is_active = FALSE
         WHERE organization_id = $1 AND user_id = $2 AND is_owner = FALSE`,
        [organizationId, userId]
      );
      await client.query(
        `UPDATE users
         SET is_active = FALSE,
             account_status = 'disabled',
             deactivated_at = NOW(),
             deactivated_by = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [userId, actorId]
      );
    }
  }

  async listAudit(organizationId: string, limit: number): Promise<OrganizationAuditRow[]> {
    return this.query<OrganizationAuditRow>(
      `SELECT a.id::TEXT,
              a.actor_id,
              actor.display_name AS actor_name,
              a.action,
              a.resource_type,
              a.resource_id,
              a.changes,
              a.created_at
       FROM audit_logs a
       LEFT JOIN users actor ON actor.id = a.actor_id
       WHERE a.organization_id = $1
         AND (
           a.resource_type IN ('organization_branch','organization_member','branch_membership','user')
           OR a.action LIKE 'staff_%'
           OR a.action LIKE 'manager_%'
           OR a.action LIKE 'branch_%'
           OR a.action IN ('account_activated','password_reset')
         )
       ORDER BY a.created_at DESC
       LIMIT $2`,
      [organizationId, limit]
    );
  }
}

export const branchesRepository = new BranchesRepository();
