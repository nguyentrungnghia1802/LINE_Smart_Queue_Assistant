import type { PoolClient } from 'pg';

import { pool } from '../../db/client';

export interface LocationConsentRow {
  user_id: string;
  enabled: boolean;
  consented_at: Date | null;
  consent_source: string | null;
  revoked_at: Date | null;
  deletion_requested_at: Date | null;
}

export interface DueLocationAlertRow {
  id: string;
  organization_id: string;
  queue_entry_id: string;
  event_key: string;
  distance_to_org_meters: number;
  threshold_meters: number;
  attempt_count: number;
  line_user_id: string;
  user_id: string;
  ticket_code: string;
  estimated_wait_seconds: number | null;
  ahead_count: number;
}

export const locationRepository = {
  async getConsent(userId: string): Promise<LocationConsentRow | null> {
    const { rows } = await pool.query<LocationConsentRow>(
      `SELECT * FROM customer_location_consents WHERE user_id = $1`,
      [userId]
    );
    return rows[0] ?? null;
  },

  async setConsent(userId: string, enabled: boolean, source: string): Promise<LocationConsentRow> {
    const { rows } = await pool.query<LocationConsentRow>(
      `INSERT INTO customer_location_consents
         (user_id, enabled, consented_at, consent_source, revoked_at, deletion_requested_at)
       VALUES ($1,$2,CASE WHEN $2 THEN NOW() ELSE NULL END,$3,
               CASE WHEN $2 THEN NULL ELSE NOW() END,NULL)
       ON CONFLICT (user_id) DO UPDATE
       SET enabled = EXCLUDED.enabled,
           consented_at = CASE WHEN EXCLUDED.enabled THEN NOW() ELSE customer_location_consents.consented_at END,
           consent_source = EXCLUDED.consent_source,
           revoked_at = CASE WHEN EXCLUDED.enabled THEN NULL ELSE NOW() END,
           deletion_requested_at = NULL
       RETURNING *`,
      [userId, enabled, source]
    );
    return rows[0];
  },

  async isEnabled(userId: string, client: PoolClient): Promise<boolean> {
    const { rows } = await client.query<{ enabled: boolean }>(
      `SELECT enabled FROM customer_location_consents WHERE user_id = $1`,
      [userId]
    );
    return rows[0]?.enabled === true;
  },

  async revokeAndDelete(userId: string): Promise<number> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO customer_location_consents
           (user_id, enabled, revoked_at, deletion_requested_at, consent_source)
         VALUES ($1,FALSE,NOW(),NOW(),'liff_settings')
         ON CONFLICT (user_id) DO UPDATE
         SET enabled = FALSE, revoked_at = NOW(), deletion_requested_at = NOW()`,
        [userId]
      );
      const result = await client.query(
        `UPDATE customer_locations
         SET latitude = NULL, longitude = NULL, accuracy_meters = NULL,
             distance_to_org_meters = NULL, anonymized_at = NOW(), deleted_at = NOW()
         WHERE customer_user_id = $1 AND deleted_at IS NULL`,
        [userId]
      );
      await client.query(
        `UPDATE location_alerts la
         SET status = CASE WHEN status = 'pending' THEN 'skipped' ELSE status END,
             last_error = NULL,
             raw_payload = raw_payload - 'latitude' - 'longitude'
         FROM customer_locations cl
         WHERE la.customer_location_id = cl.id AND cl.customer_user_id = $1`,
        [userId]
      );
      await client.query('COMMIT');
      return result.rowCount ?? 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async claimDue(limit: number, client: PoolClient): Promise<DueLocationAlertRow[]> {
    const { rows } = await client.query<DueLocationAlertRow>(
      `SELECT la.id, la.organization_id, la.queue_entry_id, la.event_key,
              la.distance_to_org_meters, la.threshold_meters, la.attempt_count,
              qe.line_user_id, qe.user_id, qe.ticket_code, qe.estimated_wait_seconds,
              (SELECT COUNT(*)::int FROM queue_entries ahead
               WHERE ahead.queue_id = qe.queue_id AND ahead.status = 'waiting'
                 AND (ahead.priority > qe.priority OR
                      (ahead.priority = qe.priority AND ahead.ticket_number < qe.ticket_number))) AS ahead_count
       FROM location_alerts la
       JOIN queue_entries qe ON qe.id = la.queue_entry_id
       JOIN customer_location_consents c ON c.user_id = qe.user_id AND c.enabled = TRUE
       JOIN queues q ON q.id = qe.queue_id
       WHERE la.status = 'pending'
         AND COALESCE(la.next_retry_at, la.due_at, la.created_at) <= NOW()
         AND qe.status = 'waiting'
         AND qe.line_user_id IS NOT NULL
         AND qe.user_id IS NOT NULL
         AND (SELECT COUNT(*) FROM queue_entries ahead
              WHERE ahead.queue_id = qe.queue_id AND ahead.status = 'waiting'
                AND (ahead.priority > qe.priority OR
                     (ahead.priority = qe.priority AND ahead.ticket_number < qe.ticket_number)))
             <= q.notify_ahead_positions
       ORDER BY COALESCE(la.next_retry_at, la.due_at, la.created_at)
       LIMIT $1
       FOR UPDATE OF la SKIP LOCKED`,
      [limit]
    );
    return rows;
  },

  async mark(
    id: string,
    status: 'pending' | 'sent' | 'skipped' | 'failed',
    client: PoolClient,
    error?: string
  ) {
    await client.query(
      `UPDATE location_alerts
       SET status = $2, sent_at = CASE WHEN $2 = 'sent' THEN NOW() ELSE sent_at END,
           attempt_count = attempt_count + 1,
           next_retry_at = CASE WHEN $2 = 'pending' THEN NOW() + INTERVAL '5 minutes' ELSE NULL END,
           last_error = $3
       WHERE id = $1`,
      [id, status, error?.slice(0, 500) ?? null]
    );
  },

  async cleanupExpired(limit: number): Promise<number> {
    const result = await pool.query(
      `WITH due AS (
         SELECT id FROM customer_locations
         WHERE deleted_at IS NULL AND expires_at IS NOT NULL AND expires_at <= NOW()
         ORDER BY expires_at LIMIT $1 FOR UPDATE SKIP LOCKED
       )
       UPDATE customer_locations cl
       SET latitude = NULL, longitude = NULL, accuracy_meters = NULL,
           distance_to_org_meters = NULL, anonymized_at = NOW(), deleted_at = NOW()
       FROM due WHERE cl.id = due.id`,
      [limit]
    );
    return result.rowCount ?? 0;
  },
};
