import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

// ── UP ────────────────────────────────────────────────────────────────────────
export async function up(pgm: MigrationBuilder): Promise<void> {
  // ── queues ─────────────────────────────────────────────────────────────────
  pgm.createTable('queues', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: {
      type: 'uuid',
      notNull: true,
      references: '"organizations"',
      onDelete: 'RESTRICT',
    },
    name: { type: 'text', notNull: true },
    description: { type: 'text' },
    status: { type: 'queue_status', notNull: true, default: 'closed' },
    queue_type: { type: 'queue_type', notNull: true, default: 'walk_in' },
    prefix: { type: 'text', notNull: true, default: "''" },
    max_capacity: { type: 'integer' },
    daily_ticket_counter: { type: 'integer', notNull: true, default: 0 },
    last_counter_reset_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    avg_service_seconds: { type: 'integer', notNull: true, default: 300 },
    notify_ahead_positions: { type: 'integer', notNull: true, default: 3 },
    allow_skip: { type: 'boolean', notNull: true, default: true },
    max_skips_before_penalty: { type: 'integer', notNull: true, default: 2 },
    opens_at: { type: 'time' },
    closes_at: { type: 'time' },
    settings: { type: 'jsonb', notNull: true, default: "'{}'" },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint('queues', 'queues_max_capacity_positive', 'CHECK (max_capacity IS NULL OR max_capacity > 0)');
  pgm.addConstraint('queues', 'queues_avg_service_seconds_pos', 'CHECK (avg_service_seconds > 0)');
  pgm.addConstraint('queues', 'queues_notify_ahead_positive', 'CHECK (notify_ahead_positions > 0)');
  pgm.addConstraint('queues', 'queues_max_skips_non_negative', 'CHECK (max_skips_before_penalty >= 0)');
  pgm.addConstraint('queues', 'queues_daily_counter_non_negative', 'CHECK (daily_ticket_counter >= 0)');
  pgm.addConstraint('queues', 'queues_prefix_format', `CHECK (prefix ~ '^[A-Za-z0-9]{0,5}$')`);
  pgm.addConstraint('queues', 'queues_hours_valid', 'CHECK (opens_at IS NULL OR closes_at IS NULL OR opens_at < closes_at)');

  pgm.sql(`
    CREATE TRIGGER trg_queues_updated_at
      BEFORE UPDATE ON queues
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // ── queue_entries ──────────────────────────────────────────────────────────
  pgm.createTable('queue_entries', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    queue_id: {
      type: 'uuid',
      notNull: true,
      references: '"queues"',
      onDelete: 'RESTRICT',
    },
    user_id: {
      type: 'uuid',
      references: '"users"',
      onDelete: 'SET NULL',
    },
    line_user_id: { type: 'text' },
    ticket_number: { type: 'integer', notNull: true },
    ticket_display: { type: 'text', notNull: true },
    status: { type: 'entry_status', notNull: true, default: 'waiting' },
    skip_count: { type: 'smallint', notNull: true, default: 0 },
    priority: { type: 'smallint', notNull: true, default: 0 },
    notes: { type: 'text' },
    metadata: { type: 'jsonb', notNull: true, default: "'{}'" },
    called_at: { type: 'timestamptz' },
    serving_at: { type: 'timestamptz' },
    completed_at: { type: 'timestamptz' },
    skipped_at: { type: 'timestamptz' },
    cancelled_at: { type: 'timestamptz' },
    estimated_call_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint('queue_entries', 'queue_entries_ticket_unique', 'UNIQUE (queue_id, ticket_number)');
  pgm.addConstraint('queue_entries', 'queue_entries_skip_non_negative', 'CHECK (skip_count >= 0)');
  pgm.addConstraint('queue_entries', 'queue_entries_priority_range', 'CHECK (priority BETWEEN -10 AND 10)');

  // Lifecycle consistency guards
  pgm.addConstraint(
    'queue_entries',
    'queue_entries_called_at_set',
    `CHECK (
      status NOT IN ('called', 'serving', 'completed', 'skipped', 'no_show')
      OR called_at IS NOT NULL
    )`,
  );
  pgm.addConstraint(
    'queue_entries',
    'queue_entries_serving_at_set',
    `CHECK (
      status NOT IN ('serving', 'completed')
      OR serving_at IS NOT NULL
    )`,
  );
  pgm.addConstraint(
    'queue_entries',
    'queue_entries_completed_at_set',
    `CHECK (status <> 'completed' OR completed_at IS NOT NULL)`,
  );

  pgm.sql(`
    CREATE TRIGGER trg_queue_entries_updated_at
      BEFORE UPDATE ON queue_entries
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
}

// ── DOWN ──────────────────────────────────────────────────────────────────────
export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('queue_entries');
  pgm.dropTable('queues');
}
