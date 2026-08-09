import type { PoolClient } from 'pg';

import type { SupportedLocale } from '@line-queue/shared';

import { config } from '../../config';
import { BaseRepository } from '../../db/repositories/base.repository';

import type { TicketNotificationEventType } from './line-notification.templates';
import { notificationPreferencesRepository } from './notification-preferences.repository';

export type NotificationDeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
export type NotificationDispatchStatus = 'pending' | 'dispatching' | 'dispatched';

export interface NotificationOutboxRow {
  id: string;
  organization_id: string | null;
  queue_entry_id: string | null;
  user_id: string | null;
  line_user_id: string | null;
  event_key: string;
  event_type: TicketNotificationEventType;
  channel: string;
  status: NotificationDeliveryStatus;
  payload: Record<string, unknown>;
  locale: SupportedLocale;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: Date | null;
  processing_started_at: Date | null;
  processing_job_id: string | null;
  last_error: string | null;
  dispatch_status: NotificationDispatchStatus;
  dispatch_attempt_count: number;
  dispatch_next_retry_at: Date | null;
  dispatch_started_at: Date | null;
  dispatch_job_id: string | null;
  dispatched_at: Date | null;
  dispatch_last_error: string | null;
  sent_at: Date | null;
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
          organization_id, queue_entry_id, user_id, line_user_id,
          event_key, event_type, channel, status, payload, max_attempts,
          next_retry_at, locale
        )
      SELECT $1,$2,$3,$4,$5,$6,'line_push','pending',$7,$8,NOW(),
        COALESCE(
          (SELECT preferred_locale FROM users WHERE id = $3),
          (SELECT default_locale FROM organizations WHERE id = $1),
          'ja'
        )
      WHERE EXISTS (
        SELECT 1 FROM line_notification_preferences p
        WHERE p.line_user_id = $4
          AND p.follow_state = 'followed'
          AND p.notification_enabled = TRUE
          AND CASE
            WHEN $6 = 'eta_warning' THEN p.approaching_enabled
            WHEN $6 = 'called' THEN p.called_enabled
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
          last_error = NULL,
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

  async claimForDispatch(limit: number): Promise<NotificationOutboxRow[]> {
    return this.query<NotificationOutboxRow>(
      `WITH due AS (
         SELECT id
         FROM notifications
         WHERE channel = 'line_push'
           AND line_user_id IS NOT NULL
           AND status = 'pending'
           AND (
             (
               dispatch_status = 'pending'
               AND dispatch_next_retry_at <= NOW()
             )
             OR (
               dispatch_status = 'dispatching'
               AND dispatch_started_at < NOW() - ($2 * INTERVAL '1 second')
             )
           )
         ORDER BY dispatch_next_retry_at, created_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE notifications n
       SET dispatch_status = 'dispatching',
           dispatch_started_at = NOW(),
           dispatch_attempt_count = n.dispatch_attempt_count + 1,
           dispatch_job_id = COALESCE(n.dispatch_job_id, 'line-notification-' || n.id::text),
           dispatch_last_error = NULL,
           updated_at = NOW()
       FROM due
       WHERE n.id = due.id
       RETURNING n.*`,
      [limit, config.notifications.dispatchClaimTimeoutSeconds]
    );
  }

  async markDispatched(id: string, jobId: string): Promise<void> {
    await this.query(
      `UPDATE notifications
       SET dispatch_status = 'dispatched',
           dispatch_job_id = $2,
           dispatched_at = NOW(),
           dispatch_started_at = NULL,
           dispatch_next_retry_at = NULL,
           dispatch_last_error = NULL,
           updated_at = NOW()
       WHERE id = $1
         AND dispatch_status IN ('dispatching', 'dispatched')`,
      [id, jobId]
    );
  }

  async markDispatchRetry(id: string, nextRetryAt: Date, error: unknown): Promise<void> {
    await this.query(
      `UPDATE notifications
       SET dispatch_status = 'pending',
           dispatch_next_retry_at = $2,
           dispatch_started_at = NULL,
           dispatch_last_error = $3,
           updated_at = NOW()
       WHERE id = $1
         AND status = 'pending'`,
      [id, nextRetryAt, sanitizeNotificationError(error)]
    );
  }

  async claimForDelivery(id: string, jobId: string): Promise<NotificationOutboxRow | null> {
    const rows = await this.query<NotificationOutboxRow>(
      `UPDATE notifications
       SET status = 'processing',
           dispatch_status = 'dispatched',
           dispatched_at = COALESCE(dispatched_at, NOW()),
           dispatch_started_at = NULL,
           processing_started_at = NOW(),
           processing_job_id = $2,
           attempt_count = attempt_count + 1,
           last_error = NULL,
           updated_at = NOW()
       WHERE id = $1
         AND channel = 'line_push'
         AND dispatch_status IN ('dispatching', 'dispatched')
         AND attempt_count < max_attempts
         AND (
           status = 'pending'
           OR (status = 'processing' AND processing_job_id = $2)
         )
       RETURNING *`,
      [id, jobId]
    );
    return rows[0] ?? null;
  }

  async markSent(id: string): Promise<void> {
    await this.query(
      `UPDATE notifications
       SET status = 'sent',
           sent_at = NOW(),
           next_retry_at = NULL,
           processing_started_at = NULL,
           processing_job_id = NULL,
           last_error = NULL,
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
           processing_job_id = NULL,
           last_error = $3,
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
           processing_job_id = NULL,
           last_error = $2,
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
      oldest_pending_seconds: string;
      latency_seconds: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('pending','processing')) AS pending,
         COUNT(*) FILTER (WHERE status = 'pending' AND attempt_count > 0) AS retrying,
         COUNT(*) FILTER (WHERE status = 'failed') AS failed,
         COALESCE(
           EXTRACT(EPOCH FROM (NOW() - MIN(created_at) FILTER (
             WHERE status IN ('pending','processing')
           ))),
           0
         ) AS oldest_pending_seconds,
         COALESCE(AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) FILTER (WHERE sent_at IS NOT NULL), 0) AS latency_seconds
       FROM notifications`
    );
    return rows[0];
  }

  async dispatchMetrics(): Promise<{ undispatched: string; oldest_seconds: string }> {
    const rows = await this.query<{ undispatched: string; oldest_seconds: string }>(
      `SELECT
         COUNT(*) FILTER (
           WHERE status = 'pending' AND dispatch_status <> 'dispatched'
         ) AS undispatched,
         COALESCE(
           EXTRACT(EPOCH FROM (
             NOW() - (MIN(created_at) FILTER (
               WHERE status = 'pending' AND dispatch_status <> 'dispatched'
             ))
           )),
           0
         ) AS oldest_seconds
       FROM notifications
       WHERE channel = 'line_push'`
    );
    return rows[0] ?? { undispatched: '0', oldest_seconds: '0' };
  }
}

export const notificationOutboxRepository = new NotificationOutboxRepository();
