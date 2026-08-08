import type { PoolClient } from 'pg';

import { BaseRepository } from '../../db/repositories/base.repository';

export interface BranchRow {
  id: string;
  organization_id: string;
  public_qr_token: string;
  name: string;
  code: string;
  phone: string;
  email: string | null;
  postal_code: string;
  prefecture: string;
  city: string;
  address_line1: string;
  address_line2: string | null;
  latitude: string | null;
  longitude: string | null;
  google_place_id: string | null;
  formatted_map_address: string | null;
  timezone: string;
  payment_settings: Record<string, unknown>;
  is_active: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface BranchSummaryRow extends BranchRow {
  queue_count: number;
  queues: Array<{ id: string; name: string; status: string }>;
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

export interface BranchAnalyticsRow {
  branch_id: string;
  branch_name: string;
  total_revenue: string;
  order_count: number;
  cancelled_count: number;
  cancellation_rate: string;
  queue_count: number;
}

export interface BranchRevenuePointRow {
  revenue_date: string;
  revenue: string;
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
  async countActive(organizationId: string, client?: PoolClient): Promise<number> {
    const rows = client
      ? await this.queryTx<{ count: string }>(
          client,
          `SELECT COUNT(*)::text AS count
           FROM organization_branches
           WHERE organization_id = $1 AND is_active = TRUE`,
          [organizationId]
        )
      : await this.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count
           FROM organization_branches
           WHERE organization_id = $1 AND is_active = TRUE`,
          [organizationId]
        );
    return Number(rows[0]?.count ?? 0);
  }

  async list(organizationId: string): Promise<BranchSummaryRow[]> {
    return this.query<BranchSummaryRow>(
      `SELECT b.*,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', q.id,
                  'name', q.name,
                  'status', q.status
                ) ORDER BY q.created_at, q.id)
                FROM queues q
                WHERE q.branch_id = b.id AND q.is_active = TRUE
              ), '[]'::jsonb) AS queues,
              (
                SELECT COUNT(*)::INT
                FROM queues q
                WHERE q.branch_id = b.id AND q.is_active = TRUE
              ) AS queue_count,
              (
                SELECT COUNT(*)::INT
                FROM branch_memberships bm
                WHERE bm.branch_id = b.id
                  AND bm.role = 'manager'
                  AND bm.is_active = TRUE
                  AND bm.deactivated_at IS NULL
              ) AS manager_count,
              (
                SELECT COUNT(*)::INT
                FROM branch_memberships bm
                WHERE bm.branch_id = b.id
                  AND bm.role = 'staff'
                  AND bm.is_active = TRUE
                  AND bm.deactivated_at IS NULL
              ) AS staff_count,
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
       WHERE b.organization_id = $1 AND b.is_active = TRUE
       ORDER BY b.created_at, b.id`,
      [organizationId]
    );
  }

  async findAssignedManagerBranch(
    organizationId: string,
    userId: string
  ): Promise<BranchRow | null> {
    return this.queryOne<BranchRow>(
      `SELECT b.*
       FROM organization_branches b
       JOIN branch_memberships bm
         ON bm.branch_id = b.id
        AND bm.organization_id = b.organization_id
       WHERE b.organization_id = $1
         AND bm.user_id = $2
         AND bm.role = 'manager'
         AND bm.is_active = TRUE
         AND bm.deactivated_at IS NULL
         AND b.is_active = TRUE`,
      [organizationId, userId]
    );
  }

  async findByPublicToken(token: string): Promise<BranchRow | null> {
    return this.queryOne<BranchRow>(
      `SELECT *
       FROM organization_branches
       WHERE public_qr_token = $1 AND is_active = TRUE`,
      [token]
    );
  }

  async findFirstByOrganization(organizationId: string): Promise<BranchRow | null> {
    return this.queryOne<BranchRow>(
      `SELECT *
       FROM organization_branches
       WHERE organization_id = $1 AND is_active = TRUE
       ORDER BY created_at, id
       LIMIT 1`,
      [organizationId]
    );
  }

  async isOpenNow(branchId: string): Promise<boolean> {
    const result = await this.queryOne<{ is_open: boolean }>(
      `WITH branch_time AS (
         SELECT b.id,
                (NOW() AT TIME ZONE b.timezone)::DATE AS local_date,
                (NOW() AT TIME ZONE b.timezone)::TIME AS local_time,
                EXTRACT(DOW FROM NOW() AT TIME ZONE b.timezone)::INT AS weekday
         FROM organization_branches b
         WHERE b.id = $1 AND b.is_active = TRUE
       )
       SELECT CASE
         WHEN exception.id IS NOT NULL THEN
           NOT exception.is_closed
           AND branch.local_time >= exception.opens_at
           AND branch.local_time < exception.closes_at
         ELSE
           NOT COALESCE(hours.is_closed, TRUE)
           AND branch.local_time >= hours.opens_at
           AND branch.local_time < hours.closes_at
       END AS is_open
       FROM branch_time branch
       LEFT JOIN branch_exception_days exception
         ON exception.branch_id = branch.id
        AND exception.exception_date = branch.local_date
       LEFT JOIN branch_business_hours hours
         ON hours.branch_id = branch.id
        AND hours.weekday = branch.weekday`,
      [branchId]
    );
    return result?.is_open ?? false;
  }

  async getBusinessCalendar(branchId: string) {
    const [weeklyHours, exceptionDays] = await Promise.all([
      this.query<{
        weekday: number;
        is_closed: boolean;
        opens_at: string | null;
        closes_at: string | null;
      }>(
        `SELECT weekday, is_closed, opens_at::TEXT, closes_at::TEXT
         FROM branch_business_hours
         WHERE branch_id = $1
         ORDER BY weekday`,
        [branchId]
      ),
      this.query<{
        exception_date: string;
        is_closed: boolean;
        opens_at: string | null;
        closes_at: string | null;
        reason: string | null;
      }>(
        `SELECT exception_date::TEXT, is_closed, opens_at::TEXT, closes_at::TEXT, reason
         FROM branch_exception_days
         WHERE branch_id = $1
         ORDER BY exception_date`,
        [branchId]
      ),
    ]);
    return { weeklyHours, exceptionDays };
  }

  async replaceBusinessCalendar(
    branchId: string,
    calendar: {
      weeklyHours: Array<{
        weekday: number;
        isClosed: boolean;
        opensAt: string | null;
        closesAt: string | null;
      }>;
      exceptionDays: Array<{
        date: string;
        isClosed: boolean;
        opensAt: string | null;
        closesAt: string | null;
        reason?: string | null;
      }>;
    },
    client: PoolClient
  ): Promise<void> {
    await client.query('DELETE FROM branch_business_hours WHERE branch_id = $1', [branchId]);
    for (const hour of calendar.weeklyHours) {
      await client.query(
        `INSERT INTO branch_business_hours (
           branch_id, weekday, is_closed, opens_at, closes_at
         ) VALUES ($1,$2,$3,$4,$5)`,
        [branchId, hour.weekday, hour.isClosed, hour.opensAt, hour.closesAt]
      );
    }
    await client.query('DELETE FROM branch_exception_days WHERE branch_id = $1', [branchId]);
    for (const day of calendar.exceptionDays) {
      await client.query(
        `INSERT INTO branch_exception_days (
           branch_id, exception_date, is_closed, opens_at, closes_at, reason
         ) VALUES ($1,$2,$3,$4,$5,$6)`,
        [branchId, day.date, day.isClosed, day.opensAt, day.closesAt, day.reason ?? null]
      );
    }
  }

  async listAnalytics(organizationId: string): Promise<BranchAnalyticsRow[]> {
    return this.query<BranchAnalyticsRow>(
      `SELECT b.id AS branch_id,
              b.name AS branch_name,
              COALESCE(SUM(o.subtotal) FILTER (
                WHERE o.payment_status = 'paid' AND o.status = 'completed'
              ), 0)::TEXT
                AS total_revenue,
              COUNT(DISTINCT o.id)::INT AS order_count,
              COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'cancelled')::INT
                AS cancelled_count,
              CASE
                WHEN COUNT(DISTINCT o.id) = 0 THEN '0'
                ELSE ROUND(
                  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'cancelled')::NUMERIC
                  * 100 / COUNT(DISTINCT o.id),
                  2
                )::TEXT
              END AS cancellation_rate,
              COUNT(DISTINCT q.id) FILTER (WHERE q.is_active = TRUE)::INT AS queue_count
       FROM organization_branches b
       LEFT JOIN queues q ON q.branch_id = b.id
       LEFT JOIN queue_entries qe ON qe.queue_id = q.id
       LEFT JOIN orders o ON o.id = qe.order_id
       WHERE b.organization_id = $1 AND b.is_active = TRUE
       GROUP BY b.id, b.name
       ORDER BY b.created_at, b.id`,
      [organizationId]
    );
  }

  async revenueSeries(organizationId: string, days: number): Promise<BranchRevenuePointRow[]> {
    return this.query<BranchRevenuePointRow>(
      `SELECT series.day::DATE::TEXT AS revenue_date,
              COALESCE(SUM(o.subtotal) FILTER (
                WHERE o.payment_status = 'paid' AND o.status = 'completed'
              ), 0)::TEXT
                AS revenue
       FROM generate_series(
         CURRENT_DATE - ($2::INT - 1),
         CURRENT_DATE,
         INTERVAL '1 day'
       ) AS series(day)
       LEFT JOIN orders o
         ON o.organization_id = $1
        AND o.created_at >= series.day
        AND o.created_at < series.day + INTERVAL '1 day'
       GROUP BY series.day
       ORDER BY series.day`,
      [organizationId, days]
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

  async findByIdForUpdate(
    id: string,
    organizationId: string,
    client: PoolClient
  ): Promise<BranchRow | null> {
    return this.queryOneTx<BranchRow>(
      client,
      `SELECT *
       FROM organization_branches
       WHERE id = $1 AND organization_id = $2 AND is_active = TRUE
       FOR UPDATE`,
      [id, organizationId]
    );
  }

  async deleteWithDependencies(branch: BranchRow, actorId: string, client: PoolClient) {
    const queueResult = await client.query<{ id: string }>(
      'SELECT id FROM queues WHERE branch_id = $1 AND organization_id = $2 FOR UPDATE',
      [branch.id, branch.organization_id]
    );
    const queueIds = queueResult.rows.map((row) => row.id);
    const orderResult = await client.query<{ id: string; booking_group_id: string | null }>(
      `SELECT id, booking_group_id
       FROM orders
       WHERE branch_id = $1 AND organization_id = $2
       FOR UPDATE`,
      [branch.id, branch.organization_id]
    );
    const orderIds = orderResult.rows.map((row) => row.id);
    const bookingGroupIds = [
      ...new Set(
        orderResult.rows
          .map((row) => row.booking_group_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const entryResult = await client.query<{ id: string }>(
      `SELECT id
       FROM queue_entries
       WHERE queue_id = ANY($1::uuid[])
       FOR UPDATE`,
      [queueIds]
    );
    const entryIds = entryResult.rows.map((row) => row.id);
    const paymentResult = await client.query<{ id: string }>(
      `SELECT DISTINCT transaction_id AS id
       FROM (
         SELECT pt.id AS transaction_id
         FROM payment_transactions pt
         WHERE pt.order_id = ANY($1::uuid[])
         UNION ALL
         SELECT oi.payment_transaction_id AS transaction_id
         FROM order_items oi
         WHERE oi.order_id = ANY($1::uuid[])
           AND oi.payment_transaction_id IS NOT NULL
       ) payments`,
      [orderIds]
    );
    const paymentIds = paymentResult.rows.map((row) => row.id);
    const accountResult = await client.query<{ id: string; email: string | null }>(
      `SELECT DISTINCT u.id, u.email
       FROM branch_memberships bm
       JOIN organization_members om
         ON om.organization_id = bm.organization_id
        AND om.user_id = bm.user_id
       JOIN users u ON u.id = bm.user_id
       WHERE bm.branch_id = $1
         AND bm.organization_id = $2
         AND bm.role IN ('manager', 'staff')
         AND om.is_owner = FALSE`,
      [branch.id, branch.organization_id]
    );
    const accountIds = accountResult.rows.map((row) => row.id);

    await client.query('DELETE FROM notifications WHERE queue_entry_id = ANY($1::uuid[])', [
      entryIds,
    ]);
    await client.query('DELETE FROM location_alerts WHERE queue_entry_id = ANY($1::uuid[])', [
      entryIds,
    ]);
    await client.query('DELETE FROM customer_locations WHERE queue_entry_id = ANY($1::uuid[])', [
      entryIds,
    ]);
    await client.query(
      `DELETE FROM penalty_records
       WHERE queue_id = ANY($1::uuid[]) OR queue_entry_id = ANY($2::uuid[])`,
      [queueIds, entryIds]
    );
    await client.query('DELETE FROM queue_histories WHERE queue_id = ANY($1::uuid[])', [queueIds]);
    await client.query(
      'DELETE FROM payment_webhook_events WHERE payment_transaction_id = ANY($1::uuid[])',
      [paymentIds]
    );
    await client.query(
      `DELETE FROM payment_reconciliation_operations
       WHERE payment_transaction_id = ANY($1::uuid[]) OR order_id = ANY($2::uuid[])`,
      [paymentIds, orderIds]
    );
    await client.query('DELETE FROM payment_transactions WHERE id = ANY($1::uuid[])', [paymentIds]);
    await client.query('DELETE FROM queue_entries WHERE id = ANY($1::uuid[])', [entryIds]);
    await client.query('DELETE FROM inventory_reservations WHERE branch_id = $1', [branch.id]);
    await client.query('DELETE FROM orders WHERE id = ANY($1::uuid[])', [orderIds]);
    await client.query(
      `DELETE FROM booking_groups bg
       WHERE bg.id = ANY($1::uuid[])
         AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.booking_group_id = bg.id)`,
      [bookingGroupIds]
    );
    await client.query(
      'DELETE FROM branch_memberships WHERE branch_id = $1 AND organization_id = $2',
      [branch.id, branch.organization_id]
    );
    await client.query('DELETE FROM queues WHERE id = ANY($1::uuid[])', [queueIds]);
    await client.query('DELETE FROM organization_branches WHERE id = $1 AND organization_id = $2', [
      branch.id,
      branch.organization_id,
    ]);

    await client.query(
      `DELETE FROM organization_members om
       WHERE om.organization_id = $1
         AND om.user_id = ANY($2::uuid[])
         AND om.is_owner = FALSE
         AND NOT EXISTS (
           SELECT 1
           FROM branch_memberships bm
           WHERE bm.organization_id = om.organization_id
             AND bm.user_id = om.user_id
             AND bm.deactivated_at IS NULL
         )`,
      [branch.organization_id, accountIds]
    );
    const deletedUsers = await client.query<{ id: string; email: string | null }>(
      `DELETE FROM users u
       WHERE u.id = ANY($1::uuid[])
         AND u.role IN ('manager', 'staff')
         AND NOT EXISTS (SELECT 1 FROM organization_members om WHERE om.user_id = u.id)
       RETURNING u.id, u.email`,
      [accountIds]
    );
    const deletedAccountEmails = deletedUsers.rows
      .map((row) => row.email)
      .filter((email): email is string => Boolean(email));
    await client.query(
      `UPDATE email_outbox
       SET status = 'cancelled', processing_started_at = NULL, updated_at = NOW()
       WHERE recipient_email = ANY($1::text[])
         AND status IN ('pending', 'processing')`,
      [deletedAccountEmails]
    );
    await client.query(
      `INSERT INTO audit_logs
         (actor_id, action, resource_type, resource_id, organization_id, changes)
       VALUES ($1,'branch_deleted','organization_branch',$2,$3,$4)`,
      [
        actorId,
        branch.id,
        branch.organization_id,
        JSON.stringify({
          name: branch.name,
          deletedQueues: queueIds.length,
          deletedOrders: orderIds.length,
          deletedAccounts: deletedUsers.rowCount ?? 0,
        }),
      ]
    );
    return {
      deleted: true,
      branchId: branch.id,
      deletedQueues: queueIds.length,
      deletedOrders: orderIds.length,
      deletedAccounts: deletedUsers.rowCount ?? 0,
    };
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
      latitude?: number | null;
      longitude?: number | null;
      googlePlaceId?: string | null;
      formattedMapAddress?: string | null;
      paymentSettings?: Record<string, unknown>;
      createdBy: string;
    },
    client: PoolClient
  ): Promise<BranchRow> {
    const rows = await this.queryTx<BranchRow>(
      client,
      `INSERT INTO organization_branches (
         organization_id, name, code, phone, email, postal_code, prefecture,
         city, address_line1, address_line2, latitude, longitude,
         google_place_id, formatted_map_address, created_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
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
        params.latitude ?? null,
        params.longitude ?? null,
        params.googlePlaceId ?? null,
        params.formattedMapAddress ?? null,
        params.createdBy,
      ]
    );
    return this.firstOrThrow(rows, 'branches.create');
  }

  async update(
    id: string,
    organizationId: string,
    values: {
      name?: string;
      phone?: string;
      email?: string | null;
      postalCode?: string;
      prefecture?: string;
      city?: string;
      addressLine1?: string;
      addressLine2?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      googlePlaceId?: string | null;
      formattedMapAddress?: string | null;
      paymentSettings?: Record<string, unknown>;
    },
    client: PoolClient
  ): Promise<BranchRow | null> {
    const columns: Record<string, string> = {
      name: 'name',
      phone: 'phone',
      email: 'email',
      postalCode: 'postal_code',
      prefecture: 'prefecture',
      city: 'city',
      addressLine1: 'address_line1',
      addressLine2: 'address_line2',
      latitude: 'latitude',
      longitude: 'longitude',
      googlePlaceId: 'google_place_id',
      formattedMapAddress: 'formatted_map_address',
      paymentSettings: 'payment_settings',
    };
    const sets: string[] = [];
    const parameters: unknown[] = [];
    for (const [key, column] of Object.entries(columns)) {
      if (key in values) {
        parameters.push((values as Record<string, unknown>)[key]);
        sets.push(`${column} = $${parameters.length}`);
      }
    }
    if (sets.length === 0) return this.findById(id, organizationId, client);
    parameters.push(id, organizationId);
    const rows = await this.queryTx<BranchRow>(
      client,
      `UPDATE organization_branches
       SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${parameters.length - 1}
         AND organization_id = $${parameters.length}
         AND is_active = TRUE
       RETURNING *`,
      parameters
    );
    return rows[0] ?? null;
  }

  async assignMember(
    params: {
      organizationId: string;
      branchId: string;
      userId: string;
      role: 'manager' | 'staff';
      assignedBy: string;
      isActive?: boolean;
      queueId?: string | null;
    },
    client: PoolClient
  ): Promise<void> {
    await client.query(
      `INSERT INTO branch_memberships (
         organization_id, branch_id, queue_id, user_id, role, is_active, assigned_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (branch_id, user_id) DO UPDATE SET
         queue_id = EXCLUDED.queue_id,
         role = EXCLUDED.role,
         is_active = EXCLUDED.is_active,
         assigned_by = EXCLUDED.assigned_by,
         assigned_at = NOW(),
         deactivated_at = NULL`,
      [
        params.organizationId,
        params.branchId,
        params.queueId ?? null,
        params.userId,
        params.role,
        params.isActive ?? false,
        params.assignedBy,
      ]
    );
  }

  async updateStaffQueue(
    organizationId: string,
    branchId: string,
    userId: string,
    queueId: string,
    assignedBy: string,
    client: PoolClient
  ): Promise<boolean> {
    const result = await client.query(
      `UPDATE branch_memberships
       SET queue_id = $4, assigned_by = $5, assigned_at = NOW()
       WHERE organization_id = $1
         AND branch_id = $2
         AND user_id = $3
         AND role = 'staff'
         AND deactivated_at IS NULL`,
      [organizationId, branchId, userId, queueId, assignedBy]
    );
    return result.rowCount === 1;
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
         AND is_active = TRUE
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
