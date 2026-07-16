import type { PoolClient } from 'pg';

import { pool } from '../../db/client';

import type { TicketNotificationEventType } from './line-notification.templates';

export interface LineNotificationPreferencesRow {
  user_id: string;
  line_user_id: string;
  follow_state: 'unknown' | 'followed' | 'unfollowed';
  notification_enabled: boolean;
  approaching_enabled: boolean;
  called_enabled: boolean;
  lifecycle_enabled: boolean;
  consented_at: Date | null;
  consent_source: string | null;
  revoked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function executor(client?: PoolClient) {
  return client ?? pool;
}

export const notificationPreferencesRepository = {
  async findByUser(userId: string): Promise<LineNotificationPreferencesRow | null> {
    const { rows } = await pool.query<LineNotificationPreferencesRow>(
      `SELECT * FROM line_notification_preferences WHERE user_id = $1`,
      [userId]
    );
    return rows[0] ?? null;
  },

  async updateForVerifiedUser(
    params: {
      userId: string;
      lineUserId: string;
      notificationEnabled: boolean;
      approachingEnabled: boolean;
      calledEnabled: boolean;
      lifecycleEnabled: boolean;
    },
    client?: PoolClient
  ): Promise<LineNotificationPreferencesRow> {
    const { rows } = await executor(client).query<LineNotificationPreferencesRow>(
      `INSERT INTO line_notification_preferences
         (user_id, line_user_id, follow_state, notification_enabled,
          approaching_enabled, called_enabled, lifecycle_enabled,
          consented_at, consent_source, revoked_at)
       SELECT $1,$2,
              CASE WHEN la.is_linked THEN 'followed' ELSE 'unfollowed' END,
              $3,$4,$5,$6,
              CASE WHEN $3 THEN NOW() ELSE NULL END,
              'liff_settings',
              CASE WHEN $3 THEN NULL ELSE NOW() END
       FROM line_accounts la
       WHERE la.user_id = $1 AND la.line_user_id = $2
       ON CONFLICT (user_id) DO UPDATE
       SET notification_enabled = EXCLUDED.notification_enabled,
           approaching_enabled = EXCLUDED.approaching_enabled,
           called_enabled = EXCLUDED.called_enabled,
           lifecycle_enabled = EXCLUDED.lifecycle_enabled,
           consented_at = CASE WHEN EXCLUDED.notification_enabled THEN NOW() ELSE line_notification_preferences.consented_at END,
           consent_source = 'liff_settings',
           revoked_at = CASE WHEN EXCLUDED.notification_enabled THEN NULL ELSE NOW() END
       RETURNING *`,
      [
        params.userId,
        params.lineUserId,
        params.notificationEnabled,
        params.approachingEnabled,
        params.calledEnabled,
        params.lifecycleEnabled,
      ]
    );
    if (!rows[0]) throw new Error('Verified LINE account was not found');
    return rows[0];
  },

  async setFollowState(lineUserId: string, followed: boolean): Promise<void> {
    await pool.query(
      `INSERT INTO line_notification_preferences
         (user_id, line_user_id, follow_state, notification_enabled,
          consented_at, consent_source, revoked_at)
       SELECT la.user_id, la.line_user_id, $2,
              $3, CASE WHEN $3 THEN NOW() ELSE NULL END,
              CASE WHEN $3 THEN 'line_follow' ELSE NULL END,
              CASE WHEN $3 THEN NULL ELSE NOW() END
       FROM line_accounts la WHERE la.line_user_id = $1
       ON CONFLICT (user_id) DO UPDATE
       SET follow_state = EXCLUDED.follow_state,
           notification_enabled = CASE WHEN $3 THEN line_notification_preferences.notification_enabled OR TRUE ELSE FALSE END,
           consented_at = CASE WHEN $3 THEN COALESCE(line_notification_preferences.consented_at, NOW()) ELSE line_notification_preferences.consented_at END,
           consent_source = CASE WHEN $3 THEN COALESCE(line_notification_preferences.consent_source, 'line_follow') ELSE line_notification_preferences.consent_source END,
           revoked_at = CASE WHEN $3 THEN NULL ELSE NOW() END`,
      [lineUserId, followed ? 'followed' : 'unfollowed', followed]
    );
  },

  async canDeliver(
    lineUserId: string,
    eventType: TicketNotificationEventType,
    client?: PoolClient
  ): Promise<boolean> {
    const categoryColumn =
      eventType === 'eta_warning'
        ? 'approaching_enabled'
        : eventType === 'called'
          ? 'called_enabled'
          : 'lifecycle_enabled';
    const { rows } = await executor(client).query<{ allowed: boolean }>(
      `SELECT notification_enabled
              AND follow_state = 'followed'
              AND ${categoryColumn} AS allowed
       FROM line_notification_preferences
       WHERE line_user_id = $1`,
      [lineUserId]
    );
    return rows[0]?.allowed === true;
  },
};
