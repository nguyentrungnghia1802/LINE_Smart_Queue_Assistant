import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

// ── UP ────────────────────────────────────────────────────────────────────────
export async function up(pgm: MigrationBuilder): Promise<void> {
  // ── audit_logs ─────────────────────────────────────────────────────────────
  pgm.createTable('audit_logs', {
    id: { type: 'bigserial', primaryKey: true },
    actor_id: { type: 'uuid' },
    actor_type: { type: 'audit_actor_type', notNull: true, default: 'user' },
    action: { type: 'text', notNull: true },
    resource_type: { type: 'text', notNull: true },
    resource_id: { type: 'uuid' },
    organization_id: { type: 'uuid' },   // denormalized — no FK intentionally
    changes: { type: 'jsonb' },
    ip_address: { type: 'inet' },
    user_agent: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // ── Indexes ────────────────────────────────────────────────────────────────

  // queue_entries hot path (ETA, position queries)
  pgm.createIndex(
    'queue_entries',
    [{ name: 'queue_id' }, { name: 'priority', sort: 'DESC' }, { name: 'ticket_number', sort: 'ASC' }],
    { name: 'idx_qe_queue_waiting', where: "status = 'waiting'" },
  );

  pgm.createIndex(
    'queue_entries',
    ['user_id', 'queue_id'],
    { name: 'idx_qe_user_active', where: "status IN ('waiting', 'called', 'serving')" },
  );

  pgm.createIndex(
    'queue_entries',
    ['line_user_id', 'queue_id'],
    { name: 'idx_qe_line_user_active', where: "status IN ('waiting', 'called', 'serving')" },
  );

  pgm.createIndex(
    'queue_entries',
    [{ name: 'queue_id' }, { name: 'created_at', sort: 'ASC' }],
    { name: 'idx_qe_eta_worker', where: "status = 'waiting'" },
  );

  // queues org dashboard
  pgm.createIndex(
    'queues',
    ['organization_id', 'status'],
    { name: 'idx_queues_org_active', where: 'is_active = TRUE' },
  );

  // line_accounts webhook resolution
  pgm.createIndex('line_accounts', ['line_user_id'], { name: 'idx_la_line_user_id' });
  pgm.createIndex('line_accounts', ['user_id'], { name: 'idx_la_user_id' });

  // organization_members auth middleware
  pgm.createIndex('organization_members', ['user_id'], { name: 'idx_om_user_id' });

  // notifications delivery worker + rate limiter
  pgm.createIndex(
    'notifications',
    [{ name: 'created_at', sort: 'ASC' }],
    { name: 'idx_notif_pending', where: "status = 'pending'" },
  );
  pgm.createIndex(
    'notifications',
    ['queue_entry_id', { name: 'created_at', sort: 'DESC' }],
    { name: 'idx_notif_entry' },
  );
  pgm.createIndex(
    'notifications',
    ['user_id', { name: 'created_at', sort: 'DESC' }],
    { name: 'idx_notif_user_recent', where: "status IN ('sent', 'delivered')" },
  );

  // penalty_records pre-join check
  pgm.createIndex(
    'penalty_records',
    ['user_id', 'severity', 'expires_at'],
    { name: 'idx_penalty_user_active', where: 'is_active = TRUE' },
  );
  pgm.createIndex(
    'penalty_records',
    ['organization_id', 'user_id', { name: 'applied_at', sort: 'DESC' }],
    { name: 'idx_penalty_org_user' },
  );

  // queue_histories analytics
  pgm.createIndex(
    'queue_histories',
    ['organization_id', { name: 'archived_at', sort: 'DESC' }],
    { name: 'idx_qh_org_date' },
  );
  pgm.createIndex(
    'queue_histories',
    ['queue_id', { name: 'archived_at', sort: 'DESC' }],
    { name: 'idx_qh_queue_date' },
  );
  pgm.createIndex(
    'queue_histories',
    ['user_id', { name: 'archived_at', sort: 'DESC' }],
    { name: 'idx_qh_user_date', where: 'user_id IS NOT NULL' },
  );

  // audit_logs compliance queries
  pgm.createIndex(
    'audit_logs',
    ['resource_type', 'resource_id', { name: 'created_at', sort: 'DESC' }],
    { name: 'idx_audit_resource' },
  );
  pgm.createIndex(
    'audit_logs',
    ['organization_id', { name: 'created_at', sort: 'DESC' }],
    { name: 'idx_audit_org', where: 'organization_id IS NOT NULL' },
  );
  pgm.createIndex(
    'audit_logs',
    ['actor_id', { name: 'created_at', sort: 'DESC' }],
    { name: 'idx_audit_actor', where: 'actor_id IS NOT NULL' },
  );
}

// ── DOWN ──────────────────────────────────────────────────────────────────────
export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop indexes first (dropped automatically with tables, but audit_logs persists)
  pgm.dropIndex('audit_logs', [], { name: 'idx_audit_actor' });
  pgm.dropIndex('audit_logs', [], { name: 'idx_audit_org' });
  pgm.dropIndex('audit_logs', [], { name: 'idx_audit_resource' });

  pgm.dropTable('audit_logs');

  // Remaining indexes are dropped automatically when their tables are dropped
  // (in migration 000003 and 000004 down functions).
}
