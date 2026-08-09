import type { PoolClient } from 'pg';

import { BaseRepository } from '../../db/repositories/base.repository';

import type { TicketNotificationEventType } from './line-notification.templates';
import type {
  NotificationDeliveryStatus,
  NotificationOutboxRow,
} from './notification-outbox.repository';

export interface NotificationOperationScope {
  organizationId?: string;
  branchId?: string;
}

export interface NotificationOperationFilters extends NotificationOperationScope {
  status?: NotificationDeliveryStatus;
  eventType?: TicketNotificationEventType;
  createdFrom?: Date;
  createdTo?: Date;
  page: number;
  limit: number;
}

export interface NotificationOperationRow extends NotificationOutboxRow {
  manual_retry_count: number;
  operator_note: string | null;
  ticket_code: string | null;
  ticket_status: string | null;
  queue_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  organization_name: string | null;
}

interface NotificationOperationListRow extends NotificationOperationRow {
  total_count: string;
}

function buildWhere(filters: NotificationOperationFilters | NotificationOperationScope) {
  const values: unknown[] = [];
  const where: string[] = [];
  const add = (sql: string, value: unknown) => {
    values.push(value);
    where.push(sql.replace('?', `$${values.length}`));
  };

  if (filters.organizationId) add('n.organization_id = ?', filters.organizationId);
  if (filters.branchId) add('q.branch_id = ?', filters.branchId);
  if ('status' in filters && filters.status) add('n.status = ?', filters.status);
  if ('eventType' in filters && filters.eventType) add('n.event_type = ?', filters.eventType);
  if ('createdFrom' in filters && filters.createdFrom)
    add('n.created_at >= ?', filters.createdFrom);
  if ('createdTo' in filters && filters.createdTo) add('n.created_at <= ?', filters.createdTo);

  return { values, clause: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '' };
}

const OPERATION_SELECT = `
  SELECT n.*,
         qe.ticket_code,
         qe.status::text AS ticket_status,
         q.name AS queue_name,
         q.branch_id,
         b.name AS branch_name,
         o.name AS organization_name
  FROM notifications n
  LEFT JOIN queue_entries qe ON qe.id = n.queue_entry_id
  LEFT JOIN queues q ON q.id = qe.queue_id
  LEFT JOIN organization_branches b ON b.id = q.branch_id
  LEFT JOIN organizations o ON o.id = n.organization_id
`;

export class NotificationOperationsRepository extends BaseRepository {
  async list(filters: NotificationOperationFilters): Promise<{
    rows: NotificationOperationListRow[];
    total: number;
  }> {
    const { values, clause } = buildWhere(filters);
    values.push(filters.limit, (filters.page - 1) * filters.limit);
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;
    const rows = await this.query<NotificationOperationListRow>(
      `${OPERATION_SELECT.replace('SELECT n.*', 'SELECT n.*, COUNT(*) OVER() AS total_count')}
       ${clause}
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values
    );
    return { rows, total: Number(rows[0]?.total_count ?? 0) };
  }

  async findById(
    id: string,
    scope: NotificationOperationScope
  ): Promise<NotificationOperationRow | null> {
    const { values, where } = this.buildIdScope(id, scope);
    return this.queryOne<NotificationOperationRow>(
      `${OPERATION_SELECT} WHERE ${where.join(' AND ')}`,
      values
    );
  }

  async findByIdForUpdate(
    client: PoolClient,
    id: string,
    scope: NotificationOperationScope
  ): Promise<NotificationOperationRow | null> {
    const { values, where } = this.buildIdScope(id, scope);
    return this.queryOneTx<NotificationOperationRow>(
      client,
      `${OPERATION_SELECT} WHERE ${where.join(' AND ')} FOR UPDATE OF n`,
      values
    );
  }

  private buildIdScope(id: string, scope: NotificationOperationScope) {
    const values: unknown[] = [id];
    const where = ['n.id = $1'];
    if (scope.organizationId) {
      values.push(scope.organizationId);
      where.push(`n.organization_id = $${values.length}`);
    }
    if (scope.branchId) {
      values.push(scope.branchId);
      where.push(`q.branch_id = $${values.length}`);
    }
    return { values, where };
  }

  async retryFailed(
    client: PoolClient,
    id: string,
    note: string
  ): Promise<NotificationOperationRow | null> {
    return this.queryOneTx<NotificationOperationRow>(
      client,
      `UPDATE notifications
       SET status = 'pending',
           attempt_count = 0,
           manual_retry_count = manual_retry_count + 1,
           next_retry_at = NOW(),
           processing_started_at = NULL,
           processing_job_id = NULL,
           last_error = NULL,
           operator_note = $2,
           dispatch_status = 'pending',
           dispatch_attempt_count = 0,
           dispatch_next_retry_at = NOW(),
           dispatch_started_at = NULL,
           dispatch_job_id = 'line-notification-' || id::text || '-manual-' || (manual_retry_count + 1)::text,
           dispatched_at = NULL,
           dispatch_last_error = NULL,
           updated_at = NOW()
       WHERE id = $1 AND status = 'failed'
       RETURNING *`,
      [id, note]
    );
  }

  async cancelObsoletePending(
    client: PoolClient,
    id: string,
    note: string
  ): Promise<NotificationOperationRow | null> {
    return this.queryOneTx<NotificationOperationRow>(
      client,
      `UPDATE notifications
       SET status = 'cancelled',
           next_retry_at = NULL,
           processing_started_at = NULL,
           processing_job_id = NULL,
           operator_note = $2,
           updated_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id, note]
    );
  }

  async insertAudit(
    client: PoolClient,
    params: {
      actorId: string;
      action: 'notification_manual_retry' | 'notification_manual_cancel';
      row: NotificationOperationRow;
      fromStatus: NotificationDeliveryStatus;
      reason: string;
      failureCategory: string | null;
    }
  ): Promise<void> {
    await this.queryTx(
      client,
      `INSERT INTO audit_logs
         (actor_id, actor_type, action, resource_type, resource_id, organization_id, changes)
       VALUES ($1, 'user', $2, 'notification', $3, $4, $5)`,
      [
        params.actorId,
        params.action,
        params.row.id,
        params.row.organization_id,
        JSON.stringify({
          fromStatus: params.fromStatus,
          toStatus: params.row.status,
          reason: params.reason,
          failureCategory: params.failureCategory,
        }),
      ]
    );
  }
}

export const notificationOperationsRepository = new NotificationOperationsRepository();
