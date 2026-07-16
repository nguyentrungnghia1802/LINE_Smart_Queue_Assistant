import type { PoolClient } from 'pg';

import { config } from '../../config';
import { BaseRepository } from '../../db/repositories/base.repository';

import type { TicketNotificationEventType } from './line-notification.templates';
import { notificationPreferencesRepository } from './notification-preferences.repository';

export type NotificationDeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface NotificationOutboxRow {
  id: string;
  organization_id: string | null;
  queue_entry_id: string | null;
  user_id: string | null;
  line_user_id: string | null;
  type: string;
  event_key: string;
  event_type: TicketNotificationEventType;
  channel: string;
  status: NotificationDeliveryStatus;
  payload: Record<string, unknown>;
  retry_count: number;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: Date | null;
  processing_started_at: Date | null;
  error_message: string | null;
  last_error: string | null;
  sent_at: Date | null;
  delivered_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface EnqueueNotificationParams {
  organizationId: string;
  queueEntryId: string;
  userId?: string | null;
  lineUserId: string;
  eventType: TicketNotificationEventType;
  eventKey: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}

const LEGACY_TYPE_BY_EVENT: Record<TicketNotificationEventType, string> = {
  booking_created: 'queue_joined',
  eta_warning: 'queue_near_turn',
  called: 'queue_called',
  serving: 'queue_serving',
  completed: 'queue_served',
  cancelled: 'queue_cancelled',
  no_show: 'queue_no_show',
  location_warning: 'location_warning',
};

export function buildQueueNotificationEventKey(
  queueEntryId: string,
  eventType: TicketNotificationEventType
): string {
  return `queue_entry:${queueEntryId}:${eventType}`;
}

export function sanitizeNotificationError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]').slice(0, 500);
}

export class NotificationOutboxRepository extends BaseRepository {
  async enqueue(
    params: EnqueueNotificationParams,
    client?: PoolClient
  ): Promise<NotificationOutboxRow | null> {
    const sql = `
      INSERT INTO notifications
        (
          organization_id, queue_entry_id, user_id, line_user_id, type,
          event_key, event_type, channel, status, payload, max_attempts,
          next_retry_at
        )
      SELECT $1,$2,$3,$4,$5,$6,$7,'line_push','pending',$8,$9,NOW()
      WHERE EXISTS (
        SELECT 1 FROM line_notification_preferences p
        WHERE p.line_user_id = $4
          AND p.follow_state = 'followed'
          AND p.notification_enabled = TRUE
          AND CASE
            WHEN $7 = 'eta_warning' THEN p.approaching_enabled
            WHEN $7 = 'called' THEN p.called_enabled
            ELSE p.lifecycle_enabled
          END
      )
      ON CONFLICT (event_key) DO UPDATE
        SET updated_at = notifications.updated_at
      RETURNING *
    `;
    const args = [
      params.organizationId,
      params.queueEntryId,
      params.userId ?? null,
      params.lineUserId,
      LEGACY_TYPE_BY_EVENT[params.eventType],
      params.eventKey,
      params.eventType,
      JSON.stringify(params.payload),
      params.maxAttempts ?? config.notifications.maxAttempts,
    ];
    const rows = client
      ? await this.queryTx<NotificationOutboxRow>(client, sql, args)
      : await this.query<NotificationOutboxRow>(sql, args);
    return rows[0] ?? null;
  }

  async claimDue(limit: number, client?: PoolClient): Promise<NotificationOutboxRow[]> {
    const sql = `
      WITH due AS (
        SELECT id
        FROM notifications
        WHERE channel = 'line_push'
          AND line_user_id IS NOT NULL
          AND (
            (
              status = 'pending'
              AND (next_retry_at IS NULL OR next_retry_at <= NOW())
            )
            OR (
              status = 'processing'
              AND processing_started_at < NOW() - ($2 * INTERVAL '1 second')
            )
          )
        ORDER BY COALESCE(next_retry_at, created_at), created_at
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE notifications n
      SET status = 'processing',
          processing_started_at = NOW(),
          attempt_count = n.attempt_count + 1,
          retry_count = n.attempt_count + 1,
          last_error = NULL,
          error_message = NULL,
          updated_at = NOW()
      FROM due
      WHERE n.id = due.id
      RETURNING n.*
    `;
    const args = [limit, config.notifications.processingTimeoutSeconds];
    return client
      ? this.queryTx<NotificationOutboxRow>(client, sql, args)
      : this.query<NotificationOutboxRow>(sql, args);
  }

  async markSent(id: string): Promise<void> {
    await this.query(
      `UPDATE notifications
       SET status = 'sent',
           sent_at = NOW(),
           next_retry_at = NULL,
           processing_started_at = NULL,
           last_error = NULL,
           error_message = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  async markRetry(id: string, nextRetryAt: Date, error: unknown): Promise<void> {
    const safeError = sanitizeNotificationError(error);
    await this.query(
      `UPDATE notifications
       SET status = 'pending',
           next_retry_at = $2,
           processing_started_at = NULL,
           last_error = $3,
           error_message = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [id, nextRetryAt, safeError]
    );
  }

  async markFailed(id: string, error: unknown): Promise<void> {
    const safeError = sanitizeNotificationError(error);
    await this.query(
      `UPDATE notifications
       SET status = 'failed',
           next_retry_at = NULL,
           processing_started_at = NULL,
           last_error = $2,
           error_message = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [id, safeError]
    );
  }

  async cancelPendingForEntry(queueEntryId: string, exceptEventKey?: string, client?: PoolClient) {
    const sql = `
      UPDATE notifications
      SET status = 'cancelled',
          next_retry_at = NULL,
          processing_started_at = NULL,
          updated_at = NOW()
      WHERE queue_entry_id = $1
        AND status = 'pending'
        AND ($2::text IS NULL OR event_key <> $2)
    `;
    const args = [queueEntryId, exceptEventKey ?? null];
    if (client) {
      await this.queryTx(client, sql, args);
    } else {
      await this.query(sql, args);
    }
  }

  async cancel(id: string, note?: string): Promise<void> {
    await this.query(
      `UPDATE notifications
       SET status = 'cancelled', next_retry_at = NULL, processing_started_at = NULL,
           operator_note = COALESCE($2, operator_note), updated_at = NOW()
       WHERE id = $1 AND status IN ('pending','processing','failed')`,
      [id, note ?? null]
    );
  }

  async canDeliver(row: NotificationOutboxRow): Promise<boolean> {
    return notificationPreferencesRepository.canDeliver(row.line_user_id ?? '', row.event_type);
  }

  async deliveryMetrics() {
    const rows = await this.query<{
      pending: string;
      retrying: string;
      failed: string;
      latency_seconds: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('pending','processing')) AS pending,
         COUNT(*) FILTER (WHERE status = 'pending' AND attempt_count > 0) AS retrying,
         COUNT(*) FILTER (WHERE status = 'failed') AS failed,
         COALESCE(AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) FILTER (WHERE sent_at IS NOT NULL), 0) AS latency_seconds
       FROM notifications`
    );
    return rows[0];
  }
}

export const notificationOutboxRepository = new NotificationOutboxRepository();
