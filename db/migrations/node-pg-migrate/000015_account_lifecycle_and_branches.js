/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE organizations
      ADD COLUMN activation_status TEXT NOT NULL DEFAULT 'active'
        CHECK (activation_status IN ('pending_activation','active','suspended'));

    ALTER TABLE users
      ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'
        CHECK (account_status IN ('invited','active','disabled')),
      ADD COLUMN postal_code TEXT,
      ADD COLUMN prefecture TEXT,
      ADD COLUMN city TEXT,
      ADD COLUMN address_line1 TEXT,
      ADD COLUMN address_line2 TEXT,
      ADD COLUMN job_title TEXT,
      ADD COLUMN employee_code TEXT,
      ADD COLUMN invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN activated_at TIMESTAMPTZ,
      ADD COLUMN deactivated_at TIMESTAMPTZ,
      ADD COLUMN deactivated_by UUID REFERENCES users(id) ON DELETE SET NULL;

    UPDATE users
    SET account_status = CASE WHEN is_active THEN 'active' ELSE 'disabled' END,
        activated_at = CASE WHEN is_active THEN COALESCE(updated_at, created_at) ELSE NULL END;

    ALTER TABLE organization_members
      ADD COLUMN is_owner BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN invited_at TIMESTAMPTZ,
      ADD COLUMN activated_at TIMESTAMPTZ;

    UPDATE organization_members
    SET activated_at = joined_at
    WHERE is_active = TRUE;

    WITH ranked_managers AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY organization_id
               ORDER BY joined_at, id
             ) AS owner_rank
      FROM organization_members
      WHERE role = 'manager' AND is_active = TRUE
    )
    UPDATE organization_members om
    SET is_owner = TRUE
    FROM ranked_managers ranked
    WHERE om.id = ranked.id AND ranked.owner_rank = 1;

    ALTER TABLE organization_members
      ADD CONSTRAINT organization_members_owner_role
      CHECK (is_owner = FALSE OR role = 'manager');

    CREATE UNIQUE INDEX uq_organization_members_owner
      ON organization_members (organization_id)
      WHERE is_owner = TRUE AND is_active = TRUE;

    CREATE UNIQUE INDEX uq_users_normalized_email
      ON users (LOWER(email))
      WHERE email IS NOT NULL;

    CREATE TABLE organization_branches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      postal_code TEXT NOT NULL,
      prefecture TEXT NOT NULL,
      city TEXT NOT NULL,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT,
      timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT organization_branches_code_format
        CHECK (code ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
      CONSTRAINT organization_branches_postal_code_format
        CHECK (postal_code ~ '^[0-9]{3}-?[0-9]{4}$'),
      CONSTRAINT organization_branches_org_code_unique UNIQUE (organization_id, code),
      CONSTRAINT organization_branches_id_org_unique UNIQUE (id, organization_id)
    );

    CREATE TRIGGER trg_organization_branches_updated_at
    BEFORE UPDATE ON organization_branches
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    INSERT INTO organization_branches (
      id, organization_id, name, code, phone, email, postal_code, prefecture,
      city, address_line1, address_line2, timezone, is_active
    )
    SELECT q.id,
           q.organization_id,
           q.name,
           'queue-' || ROW_NUMBER() OVER (
             PARTITION BY q.organization_id ORDER BY q.created_at, q.id
           )::TEXT,
           COALESCE(NULLIF(o.phone, ''), '0000000000'),
           NULL,
           COALESCE(o.postal_code, '100-0001'),
           COALESCE(o.prefecture, '東京都'),
           COALESCE(o.city, '未設定'),
           COALESCE(o.address_line1, '未設定'),
           o.address_line2,
           o.timezone,
           q.is_active
    FROM queues q
    JOIN organizations o ON o.id = q.organization_id;

    INSERT INTO organization_branches (
      organization_id, name, code, phone, email, postal_code, prefecture,
      city, address_line1, address_line2, timezone, is_active
    )
    SELECT o.id,
           o.name,
           'main',
           COALESCE(NULLIF(o.phone, ''), '0000000000'),
           NULL,
           COALESCE(o.postal_code, '100-0001'),
           COALESCE(o.prefecture, '東京都'),
           COALESCE(o.city, '未設定'),
           COALESCE(o.address_line1, '未設定'),
           o.address_line2,
           o.timezone,
           o.is_active
    FROM organizations o
    WHERE NOT EXISTS (
      SELECT 1 FROM organization_branches b WHERE b.organization_id = o.id
    );

    CREATE TABLE branch_memberships (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      branch_id UUID NOT NULL,
      user_id UUID NOT NULL,
      role org_member_role NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deactivated_at TIMESTAMPTZ,
      CONSTRAINT branch_memberships_branch_org_fk
        FOREIGN KEY (branch_id, organization_id)
        REFERENCES organization_branches(id, organization_id)
        ON DELETE CASCADE,
      CONSTRAINT branch_memberships_member_fk
        FOREIGN KEY (organization_id, user_id)
        REFERENCES organization_members(organization_id, user_id)
        ON DELETE CASCADE,
      CONSTRAINT branch_memberships_unique UNIQUE (branch_id, user_id)
    );

    INSERT INTO branch_memberships (
      organization_id, branch_id, user_id, role, is_active, assigned_at
    )
    SELECT om.organization_id,
           b.id,
           om.user_id,
           om.role,
           om.is_active,
           om.joined_at
    FROM organization_members om
    JOIN organization_branches b ON b.organization_id = om.organization_id
    WHERE om.role IN ('manager', 'staff');

    ALTER TABLE queues ADD COLUMN branch_id UUID;

    UPDATE queues SET branch_id = id;

    ALTER TABLE queues
      ALTER COLUMN branch_id SET NOT NULL,
      ADD CONSTRAINT queues_branch_org_fk
        FOREIGN KEY (branch_id, organization_id)
        REFERENCES organization_branches(id, organization_id)
        ON DELETE RESTRICT;

    CREATE UNIQUE INDEX uq_queues_active_branch
      ON queues (branch_id)
      WHERE is_active = TRUE;

    CREATE TABLE account_action_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL CHECK (purpose IN ('account_activation','password_reset')),
      token_hash CHAR(64) NOT NULL UNIQUE,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT account_action_tokens_expiry_valid CHECK (expires_at > created_at)
    );

    CREATE TABLE email_outbox (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_key TEXT NOT NULL UNIQUE,
      recipient_email TEXT NOT NULL,
      template_key TEXT NOT NULL CHECK (template_key IN ('account_activation','password_reset')),
      locale TEXT NOT NULL DEFAULT 'ja' CHECK (locale IN ('ja','vi','en')),
      template_data JSONB NOT NULL DEFAULT '{}',
      encrypted_action_token TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','processing','sent','failed','cancelled')),
      attempt_count INT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      max_attempts INT NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
      next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processing_started_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TRIGGER trg_email_outbox_updated_at
    BEFORE UPDATE ON email_outbox
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE INDEX idx_branches_org_active
      ON organization_branches (organization_id, created_at)
      WHERE is_active = TRUE;
    CREATE INDEX idx_branch_memberships_user_active
      ON branch_memberships (user_id, branch_id)
      WHERE is_active = TRUE;
    CREATE INDEX idx_branch_memberships_branch_role_active
      ON branch_memberships (branch_id, role)
      WHERE is_active = TRUE;
    CREATE INDEX idx_account_action_tokens_user_purpose
      ON account_action_tokens (user_id, purpose, created_at DESC);
    CREATE INDEX idx_account_action_tokens_active
      ON account_action_tokens (token_hash, expires_at)
      WHERE used_at IS NULL AND revoked_at IS NULL;
    CREATE INDEX idx_email_outbox_due
      ON email_outbox (next_retry_at, created_at)
      WHERE status = 'pending';

    ALTER TABLE organization_applications DROP COLUMN manager_password_hash;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE organization_applications ADD COLUMN manager_password_hash TEXT;

    DROP TABLE IF EXISTS email_outbox CASCADE;
    DROP TABLE IF EXISTS account_action_tokens CASCADE;

    DROP INDEX IF EXISTS uq_queues_active_branch;
    ALTER TABLE queues DROP CONSTRAINT IF EXISTS queues_branch_org_fk;
    ALTER TABLE queues DROP COLUMN IF EXISTS branch_id;

    DROP TABLE IF EXISTS branch_memberships CASCADE;
    DROP TABLE IF EXISTS organization_branches CASCADE;

    DROP INDEX IF EXISTS uq_users_normalized_email;
    DROP INDEX IF EXISTS uq_organization_members_owner;
    ALTER TABLE organization_members
      DROP CONSTRAINT IF EXISTS organization_members_owner_role,
      DROP COLUMN IF EXISTS activated_at,
      DROP COLUMN IF EXISTS invited_at,
      DROP COLUMN IF EXISTS is_owner;

    ALTER TABLE users
      DROP COLUMN IF EXISTS deactivated_by,
      DROP COLUMN IF EXISTS deactivated_at,
      DROP COLUMN IF EXISTS activated_at,
      DROP COLUMN IF EXISTS invited_by,
      DROP COLUMN IF EXISTS employee_code,
      DROP COLUMN IF EXISTS job_title,
      DROP COLUMN IF EXISTS address_line2,
      DROP COLUMN IF EXISTS address_line1,
      DROP COLUMN IF EXISTS city,
      DROP COLUMN IF EXISTS prefecture,
      DROP COLUMN IF EXISTS postal_code,
      DROP COLUMN IF EXISTS account_status;

    ALTER TABLE organizations DROP COLUMN IF EXISTS activation_status;
  `);
};
