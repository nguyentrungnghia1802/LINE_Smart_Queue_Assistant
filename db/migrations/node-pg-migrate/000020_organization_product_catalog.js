/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE organization_branches
      ADD COLUMN payment_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

    ALTER TABLE products
      ADD COLUMN product_code TEXT;

    WITH ranked AS (
      SELECT id,
             CASE product_type
               WHEN 'service' THEN 'DV'
               ELSE 'SP'
             END
             || ROW_NUMBER() OVER (
               PARTITION BY organization_id, product_type
               ORDER BY created_at, id
             )::TEXT AS generated_code
      FROM products
    )
    UPDATE products product
    SET product_code = ranked.generated_code
    FROM ranked
    WHERE ranked.id = product.id;

    ALTER TABLE queue_products
      DROP CONSTRAINT IF EXISTS queue_products_product_scope_fk;

    ALTER TABLE products
      DROP CONSTRAINT IF EXISTS products_id_org_branch_unique,
      DROP CONSTRAINT IF EXISTS products_branch_org_fk,
      ALTER COLUMN branch_id DROP NOT NULL,
      ALTER COLUMN product_code SET NOT NULL,
      ADD CONSTRAINT products_id_org_unique UNIQUE (id, organization_id),
      ADD CONSTRAINT products_product_code_format
        CHECK (product_code ~ '^(DV|SP)[1-9][0-9]*$');

    DROP INDEX IF EXISTS idx_products_branch_active;

    CREATE UNIQUE INDEX uq_products_organization_code
      ON products (organization_id, UPPER(product_code));
    CREATE INDEX idx_products_organization_active
      ON products (organization_id, created_at)
      WHERE is_active = TRUE;

    ALTER TABLE queue_products
      ADD CONSTRAINT queue_products_product_org_fk
        FOREIGN KEY (product_id, organization_id)
        REFERENCES products(id, organization_id)
        ON DELETE CASCADE;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE queue_products
      DROP CONSTRAINT IF EXISTS queue_products_product_org_fk;

    UPDATE products product
    SET branch_id = COALESCE(
      product.branch_id,
      (
        SELECT branch.id
        FROM organization_branches branch
        WHERE branch.organization_id = product.organization_id
        ORDER BY branch.created_at, branch.id
        LIMIT 1
      )
    );

    DELETE FROM queue_products assignment
    USING products product
    WHERE assignment.product_id = product.id
      AND assignment.branch_id <> product.branch_id;

    DROP INDEX IF EXISTS idx_products_organization_active;
    DROP INDEX IF EXISTS uq_products_organization_code;

    ALTER TABLE products
      DROP CONSTRAINT IF EXISTS products_product_code_format,
      DROP CONSTRAINT IF EXISTS products_id_org_unique,
      ALTER COLUMN branch_id SET NOT NULL,
      ADD CONSTRAINT products_branch_org_fk
        FOREIGN KEY (branch_id, organization_id)
        REFERENCES organization_branches(id, organization_id)
        ON DELETE RESTRICT,
      ADD CONSTRAINT products_id_org_branch_unique
        UNIQUE (id, organization_id, branch_id),
      DROP COLUMN IF EXISTS product_code;

    CREATE INDEX idx_products_branch_active
      ON products (branch_id, created_at)
      WHERE is_active = TRUE;

    ALTER TABLE queue_products
      ADD CONSTRAINT queue_products_product_scope_fk
        FOREIGN KEY (product_id, organization_id, branch_id)
        REFERENCES products(id, organization_id, branch_id)
        ON DELETE CASCADE;

    ALTER TABLE organization_branches
      DROP COLUMN IF EXISTS payment_settings;
  `);
};
