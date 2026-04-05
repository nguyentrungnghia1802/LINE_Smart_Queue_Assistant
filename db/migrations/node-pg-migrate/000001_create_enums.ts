import type { MigrationBuilder } from 'node-pg-migrate';

// ── UP ────────────────────────────────────────────────────────────────────────
export async function up(pgm: MigrationBuilder): Promise<void> {
  // ── Users & staff roles ────────────────────────────────────────────────────

  pgm.createType('user_role', [
    'customer',
    'staff',
    'manager',
    'admin',
    'super_admin',
  ]);

  pgm.createType('org_member_role', ['owner', 'manager', 'staff']);

  // ── Queue lifecycle ────────────────────────────────────────────────────────

  pgm.createType('queue_status', ['closed', 'open', 'paused', 'disaster_mode']);

  pgm.createType('queue_type', ['walk_in', 'appointment', 'virtual']);

  // ── Queue entry lifecycle ──────────────────────────────────────────────────

  pgm.createType('entry_status', [
    'waiting',
    'called',
    'serving',
    'completed',
    'skipped',
    'cancelled',
    'no_show',
  ]);

  // ── Notification types & channels ─────────────────────────────────────────

  pgm.createType('notification_type', [
    'position_update',
    'turn_approaching',
    'called',
    'completed',
    'cancelled',
    'penalty_warned',
    'penalty_applied',
    'queue_paused',
    'queue_resumed',
    'queue_closed',
  ]);

  pgm.createType('notification_channel', [
    'line_push',
    'line_flex',
    'liff',
    'in_app',
  ]);

  pgm.createType('notification_status', [
    'pending',
    'sent',
    'delivered',
    'failed',
    'skipped',
  ]);

  // ── Penalty ────────────────────────────────────────────────────────────────

  pgm.createType('penalty_type', ['skip', 'no_show', 'abuse']);

  pgm.createType('penalty_severity', ['warning', 'minor', 'major', 'ban']);

  // ── Audit ──────────────────────────────────────────────────────────────────

  pgm.createType('audit_actor_type', [
    'user',
    'staff',
    'system',
    'webhook',
    'cron',
  ]);
}

// ── DOWN ──────────────────────────────────────────────────────────────────────
export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropType('audit_actor_type');
  pgm.dropType('penalty_severity');
  pgm.dropType('penalty_type');
  pgm.dropType('notification_status');
  pgm.dropType('notification_channel');
  pgm.dropType('notification_type');
  pgm.dropType('entry_status');
  pgm.dropType('queue_type');
  pgm.dropType('queue_status');
  pgm.dropType('org_member_role');
  pgm.dropType('user_role');
}
