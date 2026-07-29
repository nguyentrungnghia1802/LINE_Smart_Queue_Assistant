/* eslint-disable no-undef */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE branch_product_inventories (
      branch_id UUID NOT NULL REFERENCES organization_branches(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      stock_quantity INT,
      low_stock_threshold INT NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (branch_id, product_id),
      CONSTRAINT branch_product_inventories_stock_non_negative
        CHECK (stock_quantity IS NULL OR stock_quantity >= 0)
    );
    CREATE INDEX idx_branch_product_inventories_low_stock
      ON branch_product_inventories(branch_id, stock_quantity)
      WHERE stock_quantity IS NOT NULL;
    CREATE TRIGGER trg_branch_product_inventories_updated_at
      BEFORE UPDATE ON branch_product_inventories
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    -- Existing global values become the initial value for every already-assigned branch.
    -- They were never branch-scoped, so operators should review copied quantities after rollout.
    INSERT INTO branch_product_inventories (branch_id, product_id, organization_id, stock_quantity)
    SELECT DISTINCT qp.branch_id, qp.product_id, qp.organization_id,
           CASE WHEN p.product_type = 'product' THEN p.stock_quantity ELSE NULL END
    FROM queue_products qp
    JOIN products p ON p.id = qp.product_id
    ON CONFLICT (branch_id, product_id) DO NOTHING;

    ALTER TABLE inventory_reservations ADD COLUMN branch_id UUID;
    UPDATE inventory_reservations ir
    SET branch_id = o.branch_id
    FROM orders o
    WHERE o.id = ir.order_id AND ir.branch_id IS NULL;
    ALTER TABLE inventory_reservations
      ADD CONSTRAINT inventory_reservations_branch_fk
        FOREIGN KEY (branch_id) REFERENCES organization_branches(id) ON DELETE RESTRICT,
      ADD CONSTRAINT inventory_reservations_branch_required
        CHECK (branch_id IS NOT NULL) NOT VALID;
    CREATE INDEX idx_inventory_reservations_branch_product_active
      ON inventory_reservations(branch_id, product_id, status);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_inventory_reservations_branch_product_active;
    ALTER TABLE inventory_reservations
      DROP CONSTRAINT IF EXISTS inventory_reservations_branch_required,
      DROP CONSTRAINT IF EXISTS inventory_reservations_branch_fk,
      DROP COLUMN IF EXISTS branch_id;
    DROP TABLE IF EXISTS branch_product_inventories CASCADE;
  `);
};
