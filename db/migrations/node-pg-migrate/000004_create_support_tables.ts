import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

// ── UP ────────────────────────────────────────────────────────────────────────
export async function up(pgm: MigrationBuilder): Promise<void> {
  // ── notifications ──────────────────────────────────────────────────────────
  pgm.createTable('notifications', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    queue_entry_id: {
      type: 'uuid',
      references: '"queue_entries"',
      onDelete: 'SET NULL',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    type: { type: 'notification_type', notNull: true },
    channel: { type: 'notification_channel', notNull: true, default: 'line_push' },
    status: { type: 'notification_status', notNull: true, default: 'pending' },
    payload: { type: 'jsonb', notNull: true, default: "'{}'" },
    error_message: { type: 'text' },
    sent_at: { type: 'timestamptz' },
    delivered_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    // no updated_at — rows are effectively immutable
  });

  // ── penalty_records ────────────────────────────────────────────────────────
  pgm.createTable('penalty_records', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    organization_id: {
      type: 'uuid',
      references: '"organizations"',
      onDelete: 'SET NULL',
    },
    queue_id: {
      type: 'uuid',
      references: '"queues"',
      onDelete: 'SET NULL',
    },
    queue_entry_id: {
      type: 'uuid',
      references: '"queue_entries"',
      onDelete: 'SET NULL',
    },
    type: { type: 'penalty_type', notNull: true },
    severity: { type: 'penalty_severity', notNull: true, default: 'warning' },
    is_active: { type: 'boolean', notNull: true, default: true },
    applied_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    expires_at: { type: 'timestamptz' },
    notes: { type: 'text' },
    created_by: {
      type: 'uuid',
      references: '"users"',
      onDelete: 'SET NULL',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint(
    'penalty_records',
    'penalty_expires_after_applied',
    'CHECK (expires_at IS NULL OR expires_at > applied_at)',
  );

  // ── queue_histories ────────────────────────────────────────────────────────
  pgm.createTable('queue_histories', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    queue_entry_id: { type: 'uuid' },   // soft ref — no FK
    queue_id: {
      type: 'uuid',
      notNull: true,
      references: '"queues"',
      onDelete: 'RESTRICT',
    },
    organization_id: {
      type: 'uuid',
      notNull: true,
      references: '"organizations"',
      onDelete: 'RESTRICT',
    },
    user_id: { type: 'uuid' },          // denormalized; no FK (GDPR-safe)
    line_user_id: { type: 'text' },
    ticket_number: { type: 'integer', notNull: true },
    ticket_display: { type: 'text', notNull: true },
    final_status: { type: 'entry_status', notNull: true },
    skip_count: { type: 'smallint', notNull: true, default: 0 },
    waited_seconds: { type: 'integer' },
    served_seconds: { type: 'integer' },
    metadata: { type: 'jsonb', notNull: true, default: "'{}'" },
    created_at: { type: 'timestamptz', notNull: true },  // original entry created_at
    archived_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
}

// ── DOWN ──────────────────────────────────────────────────────────────────────
export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('queue_histories');
  pgm.dropTable('penalty_records');
  pgm.dropTable('notifications');
}
