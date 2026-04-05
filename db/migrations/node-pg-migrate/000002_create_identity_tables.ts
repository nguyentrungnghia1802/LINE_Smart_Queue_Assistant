import type { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

// ── UP ────────────────────────────────────────────────────────────────────────
export async function up(pgm: MigrationBuilder): Promise<void> {
  // ── Utility trigger: auto-set updated_at ──────────────────────────────────
  pgm.sql(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$;
  `);

  // ── users ──────────────────────────────────────────────────────────────────
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    display_name: { type: 'text', notNull: true },
    email: { type: 'text', unique: true },
    role: { type: 'user_role', notNull: true, default: 'customer' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint(
    'users',
    'users_email_format',
    `CHECK (email IS NULL OR email ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$')`,
  );

  pgm.sql(`
    CREATE TRIGGER trg_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // ── line_accounts ──────────────────────────────────────────────────────────
  pgm.createTable('line_accounts', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    line_user_id: { type: 'text', notNull: true },
    display_name: { type: 'text', notNull: true },
    picture_url: { type: 'text' },
    status_message: { type: 'text' },
    is_linked: { type: 'boolean', notNull: true, default: true },
    linked_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    last_synced_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint(
    'line_accounts',
    'line_accounts_line_user_id_unique',
    'UNIQUE (line_user_id)',
  );
  pgm.addConstraint(
    'line_accounts',
    'line_accounts_user_id_unique',
    'UNIQUE (user_id)',
  );

  // ── organizations ──────────────────────────────────────────────────────────
  pgm.createTable('organizations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true },
    slug: { type: 'text', notNull: true },
    line_channel_id: { type: 'text' },
    line_oa_basic_id: { type: 'text' },
    timezone: { type: 'text', notNull: true, default: "'Asia/Bangkok'" },
    settings: { type: 'jsonb', notNull: true, default: "'{}'" },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint(
    'organizations',
    'organizations_slug_unique',
    'UNIQUE (slug)',
  );
  pgm.addConstraint(
    'organizations',
    'organizations_slug_format',
    `CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$')`,
  );

  pgm.sql(`
    CREATE TRIGGER trg_organizations_updated_at
      BEFORE UPDATE ON organizations
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // ── organization_members ───────────────────────────────────────────────────
  pgm.createTable('organization_members', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: {
      type: 'uuid',
      notNull: true,
      references: '"organizations"',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    role: { type: 'org_member_role', notNull: true, default: 'staff' },
    joined_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint(
    'organization_members',
    'org_members_unique',
    'UNIQUE (organization_id, user_id)',
  );
}

// ── DOWN ──────────────────────────────────────────────────────────────────────
export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('organization_members');
  pgm.dropTable('organizations');
  pgm.dropTable('line_accounts');
  pgm.dropTable('users');
  pgm.sql('DROP FUNCTION IF EXISTS set_updated_at CASCADE;');
}
