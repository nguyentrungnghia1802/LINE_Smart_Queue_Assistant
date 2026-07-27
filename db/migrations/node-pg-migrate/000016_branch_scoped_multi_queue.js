/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE organization_branches
      ADD COLUMN public_qr_token TEXT;

    UPDATE organization_branches
    SET public_qr_token = encode(gen_random_bytes(18), 'hex')
    WHERE public_qr_token IS NULL;

    ALTER TABLE organization_branches
      ALTER COLUMN public_qr_token SET NOT NULL,
      ALTER COLUMN public_qr_token SET DEFAULT encode(gen_random_bytes(18), 'hex'),
      ADD CONSTRAINT organization_branches_public_qr_token_unique UNIQUE (public_qr_token),
      ADD CONSTRAINT organization_branches_public_qr_token_format
        CHECK (public_qr_token ~ '^[A-Za-z0-9_-]{8,128}$');

    CREATE TABLE branch_business_hours (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      branch_id UUID NOT NULL REFERENCES organization_branches(id) ON DELETE CASCADE,
      weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
      is_closed BOOLEAN NOT NULL DEFAULT FALSE,
      opens_at TIME,
      closes_at TIME,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT branch_business_hours_unique UNIQUE (branch_id, weekday),
      CONSTRAINT branch_business_hours_valid CHECK (
        (is_closed AND opens_at IS NULL AND closes_at IS NULL)
        OR
        (NOT is_closed AND opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at)
      )
    );

    CREATE TRIGGER trg_branch_business_hours_updated_at
    BEFORE UPDATE ON branch_business_hours
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE TABLE branch_exception_days (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      branch_id UUID NOT NULL REFERENCES organization_branches(id) ON DELETE CASCADE,
      exception_date DATE NOT NULL,
      is_closed BOOLEAN NOT NULL DEFAULT TRUE,
      opens_at TIME,
      closes_at TIME,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT branch_exception_days_unique UNIQUE (branch_id, exception_date),
      CONSTRAINT branch_exception_days_valid CHECK (
        (is_closed AND opens_at IS NULL AND closes_at IS NULL)
        OR
        (NOT is_closed AND opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at)
      )
    );

    CREATE TRIGGER trg_branch_exception_days_updated_at
    BEFORE UPDATE ON branch_exception_days
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    INSERT INTO branch_business_hours (branch_id, weekday, is_closed, opens_at, closes_at)
    SELECT b.id, h.weekday, h.is_closed, h.opens_at, h.closes_at
    FROM organization_branches b
    JOIN organization_business_hours h ON h.organization_id = b.organization_id;

    INSERT INTO branch_business_hours (branch_id, weekday, is_closed, opens_at, closes_at)
    SELECT b.id,
           day.weekday,
           CASE WHEN day.weekday IN (0, 6) THEN TRUE ELSE FALSE END,
           CASE WHEN day.weekday IN (0, 6) THEN NULL ELSE TIME '09:00' END,
           CASE WHEN day.weekday IN (0, 6) THEN NULL ELSE TIME '18:00' END
    FROM organization_branches b
    CROSS JOIN generate_series(0, 6) AS day(weekday)
    WHERE NOT EXISTS (
      SELECT 1
      FROM branch_business_hours h
      WHERE h.branch_id = b.id AND h.weekday = day.weekday
    );

    INSERT INTO branch_exception_days (
      branch_id, exception_date, is_closed, opens_at, closes_at, reason
    )
    SELECT b.id, e.exception_date, e.is_closed, e.opens_at, e.closes_at, e.reason
    FROM organization_branches b
    JOIN organization_exception_days e ON e.organization_id = b.organization_id;

    DROP INDEX IF EXISTS uq_queues_active_branch;

    ALTER TABLE queues
      ADD CONSTRAINT queues_id_org_branch_unique UNIQUE (id, organization_id, branch_id);

    CREATE UNIQUE INDEX uq_queues_active_branch_name
      ON queues (branch_id, LOWER(name))
      WHERE is_active = TRUE;

    ALTER TABLE products
      ADD COLUMN branch_id UUID;

    UPDATE products p
    SET branch_id = (
      SELECT b.id
      FROM organization_branches b
      WHERE b.organization_id = p.organization_id
      ORDER BY b.created_at, b.id
      LIMIT 1
    );

    ALTER TABLE products
      ALTER COLUMN branch_id SET NOT NULL,
      ADD CONSTRAINT products_branch_org_fk
        FOREIGN KEY (branch_id, organization_id)
        REFERENCES organization_branches(id, organization_id)
        ON DELETE RESTRICT,
      ADD CONSTRAINT products_id_org_branch_unique UNIQUE (id, organization_id, branch_id);

    CREATE INDEX idx_products_branch_active
      ON products (branch_id, created_at)
      WHERE is_active = TRUE;

    CREATE TABLE queue_products (
      queue_id UUID NOT NULL,
      product_id UUID NOT NULL,
      organization_id UUID NOT NULL,
      branch_id UUID NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      display_order INT NOT NULL DEFAULT 0 CHECK (display_order >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (queue_id, product_id),
      CONSTRAINT queue_products_queue_scope_fk
        FOREIGN KEY (queue_id, organization_id, branch_id)
        REFERENCES queues(id, organization_id, branch_id)
        ON DELETE CASCADE,
      CONSTRAINT queue_products_product_scope_fk
        FOREIGN KEY (product_id, organization_id, branch_id)
        REFERENCES products(id, organization_id, branch_id)
        ON DELETE CASCADE
    );

    CREATE TRIGGER trg_queue_products_updated_at
    BEFORE UPDATE ON queue_products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    INSERT INTO queue_products (queue_id, product_id, organization_id, branch_id, display_order)
    SELECT q.id,
           p.id,
           p.organization_id,
           p.branch_id,
           ROW_NUMBER() OVER (
             PARTITION BY q.id ORDER BY p.created_at, p.id
           ) - 1
    FROM products p
    JOIN queues q
      ON q.organization_id = p.organization_id
     AND q.branch_id = p.branch_id
     AND q.is_active = TRUE
    WHERE p.is_active = TRUE;

    WITH ranked_manager_assignments AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY user_id
               ORDER BY assigned_at, id
             ) AS assignment_rank
      FROM branch_memberships
      WHERE role = 'manager'
        AND is_active = TRUE
        AND deactivated_at IS NULL
    )
    UPDATE branch_memberships membership
    SET is_active = FALSE,
        deactivated_at = NOW()
    FROM ranked_manager_assignments ranked
    WHERE membership.id = ranked.id
      AND ranked.assignment_rank > 1;

    CREATE UNIQUE INDEX uq_branch_memberships_active_manager_scope
      ON branch_memberships (user_id)
      WHERE role = 'manager' AND is_active = TRUE AND deactivated_at IS NULL;

    CREATE INDEX idx_queue_products_queue_active
      ON queue_products (queue_id, display_order, product_id)
      WHERE is_active = TRUE;

    DELETE FROM staffing_recommendations;
    DELETE FROM queue_hourly_metrics;

    ALTER TABLE staffing_recommendations
      ADD COLUMN branch_id UUID REFERENCES organization_branches(id) ON DELETE CASCADE;
    ALTER TABLE staffing_recommendations
      ALTER COLUMN branch_id SET NOT NULL;

    ALTER TABLE queue_hourly_metrics
      ADD COLUMN branch_id UUID REFERENCES organization_branches(id) ON DELETE CASCADE;
    ALTER TABLE queue_hourly_metrics
      ALTER COLUMN branch_id SET NOT NULL;

    CREATE INDEX idx_staffing_recommendations_branch_slot
      ON staffing_recommendations(branch_id, day_of_week, hour_of_day, generated_at DESC);
    CREATE INDEX idx_queue_hourly_metrics_branch_slot
      ON queue_hourly_metrics(branch_id, day_of_week, hour_of_day, generated_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_queue_hourly_metrics_branch_slot;
    DROP INDEX IF EXISTS idx_staffing_recommendations_branch_slot;
    ALTER TABLE queue_hourly_metrics DROP COLUMN IF EXISTS branch_id;
    ALTER TABLE staffing_recommendations DROP COLUMN IF EXISTS branch_id;

    DROP INDEX IF EXISTS idx_queue_products_queue_active;
    DROP INDEX IF EXISTS uq_branch_memberships_active_manager_scope;
    DROP TABLE IF EXISTS queue_products CASCADE;

    DROP INDEX IF EXISTS idx_products_branch_active;
    ALTER TABLE products
      DROP CONSTRAINT IF EXISTS products_id_org_branch_unique,
      DROP CONSTRAINT IF EXISTS products_branch_org_fk,
      DROP COLUMN IF EXISTS branch_id;

    DROP INDEX IF EXISTS uq_queues_active_branch_name;
    ALTER TABLE queues DROP CONSTRAINT IF EXISTS queues_id_org_branch_unique;
    CREATE UNIQUE INDEX uq_queues_active_branch
      ON queues (branch_id)
      WHERE is_active = TRUE;

    DROP TABLE IF EXISTS branch_exception_days CASCADE;
    DROP TABLE IF EXISTS branch_business_hours CASCADE;

    ALTER TABLE organization_branches
      DROP CONSTRAINT IF EXISTS organization_branches_public_qr_token_format,
      DROP CONSTRAINT IF EXISTS organization_branches_public_qr_token_unique,
      DROP COLUMN IF EXISTS public_qr_token;
  `);
};
