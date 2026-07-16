import { pool } from '../../db/client';
import { AppError } from '../../utils/AppError';

import type {
  NotificationDeliveryStatus,
  NotificationOutboxRow,
} from './notification-outbox.repository';

function maskedLineId(value: string | null): string | null {
  if (!value) return null;
  return `${value.slice(0, 2)}***${value.slice(-4)}`;
}

export const notificationOperationsService = {
  async list(params: {
    organizationId?: string;
    status?: NotificationDeliveryStatus;
    page: number;
    limit: number;
  }) {
    const values: unknown[] = [];
    const where: string[] = [];
    if (params.organizationId) {
      values.push(params.organizationId);
      where.push(`organization_id = $${values.length}`);
    }
    if (params.status) {
      values.push(params.status);
      where.push(`status = $${values.length}`);
    }
    values.push(params.limit, (params.page - 1) * params.limit);
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;
    const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await pool.query<NotificationOutboxRow & { total_count: string }>(
      `SELECT *, COUNT(*) OVER() AS total_count
       FROM notifications
       ${clause}
       ORDER BY created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values
    );
    return {
      items: rows.map((row) => ({
        id: row.id,
        organizationId: row.organization_id,
        queueEntryId: row.queue_entry_id,
        eventType: row.event_type,
        locale: row.locale,
        status: row.status,
        attemptCount: row.attempt_count,
        maxAttempts: row.max_attempts,
        nextRetryAt: row.next_retry_at,
        sentAt: row.sent_at,
        lastError: row.last_error,
        lineRecipient: maskedLineId(row.line_user_id),
        createdAt: row.created_at,
      })),
      page: params.page,
      limit: params.limit,
      total: Number(rows[0]?.total_count ?? 0),
    };
  },

  async retry(params: { id: string; organizationId?: string; actorId: string; note?: string }) {
    return this.mutate({ ...params, action: 'retry' });
  },

  async cancel(params: { id: string; organizationId?: string; actorId: string; note?: string }) {
    return this.mutate({ ...params, action: 'cancel' });
  },

  async mutate(params: {
    id: string;
    organizationId?: string;
    actorId: string;
    note?: string;
    action: 'retry' | 'cancel';
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<NotificationOutboxRow>(
        `SELECT * FROM notifications WHERE id = $1 FOR UPDATE`,
        [params.id]
      );
      const row = result.rows[0];
      if (!row) throw AppError.notFound('Notification');
      if (params.organizationId && row.organization_id !== params.organizationId) {
        throw AppError.forbidden('Notification is outside your organization');
      }
      if (row.status === 'sent') {
        throw AppError.conflict('Sent notifications require a new explicit domain event');
      }
      if (params.action === 'retry' && !['failed', 'cancelled'].includes(row.status)) {
        throw AppError.conflict('Only failed or cancelled notifications can be retried manually');
      }
      if (params.action === 'cancel' && !['pending', 'processing', 'failed'].includes(row.status)) {
        throw AppError.conflict('Notification cannot be cancelled from its current state');
      }

      const updated = await client.query<NotificationOutboxRow>(
        params.action === 'retry'
          ? `UPDATE notifications
             SET status = 'pending', attempt_count = 0, retry_count = 0,
                 manual_retry_count = manual_retry_count + 1,
                 next_retry_at = NOW(), processing_started_at = NULL,
                 last_error = NULL, error_message = NULL, operator_note = $2
             WHERE id = $1 RETURNING *`
          : `UPDATE notifications
             SET status = 'cancelled', next_retry_at = NULL,
                 processing_started_at = NULL, operator_note = $2
             WHERE id = $1 RETURNING *`,
        [params.id, params.note ?? null]
      );
      await client.query(
        `INSERT INTO audit_logs
           (actor_id, actor_type, action, resource_type, resource_id, organization_id, changes)
         VALUES ($1,'user',$2,'notification',$3,$4,$5)`,
        [
          params.actorId,
          `notification_manual_${params.action}`,
          row.id,
          row.organization_id,
          JSON.stringify({
            fromStatus: row.status,
            toStatus: updated.rows[0].status,
            note: params.note,
          }),
        ]
      );
      await client.query('COMMIT');
      return updated.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};
