/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE orders
      ADD COLUMN branch_id UUID,
      ADD COLUMN queue_id UUID,
      ADD COLUMN organization_name_snapshot TEXT,
      ADD COLUMN branch_name_snapshot TEXT,
      ADD COLUMN queue_name_snapshot TEXT,
      ADD COLUMN fulfilled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN fulfilled_by_name TEXT,
      ADD COLUMN fulfilled_by_employee_code TEXT,
      ADD COLUMN fulfilled_at TIMESTAMPTZ;

    UPDATE orders order_record
    SET branch_id = queue.branch_id,
        queue_id = queue.id,
        organization_name_snapshot = organization.name,
        branch_name_snapshot = branch.name,
        queue_name_snapshot = queue.name
    FROM queue_entries entry
    JOIN queues queue ON queue.id = entry.queue_id
    JOIN organizations organization ON organization.id = queue.organization_id
    JOIN organization_branches branch ON branch.id = queue.branch_id
    WHERE entry.order_id = order_record.id;

    WITH canonical_active_group AS (
      SELECT DISTINCT ON (
        order_record.organization_id,
        order_record.branch_id,
        order_record.customer_line_user_id
      )
        order_record.organization_id,
        order_record.branch_id,
        order_record.customer_line_user_id,
        order_record.booking_group_id
      FROM orders order_record
      JOIN queue_entries entry ON entry.order_id = order_record.id
      WHERE order_record.customer_line_user_id IS NOT NULL
        AND order_record.booking_group_id IS NOT NULL
        AND order_record.status IN ('pending', 'processing')
        AND entry.status IN ('waiting', 'called', 'serving')
      ORDER BY
        order_record.organization_id,
        order_record.branch_id,
        order_record.customer_line_user_id,
        order_record.created_at DESC
    )
    UPDATE orders order_record
    SET booking_group_id = canonical.booking_group_id
    FROM canonical_active_group canonical,
         queue_entries entry
    WHERE entry.order_id = order_record.id
      AND order_record.organization_id = canonical.organization_id
      AND order_record.branch_id = canonical.branch_id
      AND order_record.customer_line_user_id = canonical.customer_line_user_id
      AND order_record.status IN ('pending', 'processing')
      AND entry.status IN ('waiting', 'called', 'serving');

    ALTER TABLE orders
      ALTER COLUMN branch_id SET NOT NULL,
      ALTER COLUMN queue_id SET NOT NULL,
      ALTER COLUMN organization_name_snapshot SET NOT NULL,
      ALTER COLUMN branch_name_snapshot SET NOT NULL,
      ALTER COLUMN queue_name_snapshot SET NOT NULL,
      ADD CONSTRAINT orders_branch_scope_fk
        FOREIGN KEY (branch_id, organization_id)
        REFERENCES organization_branches(id, organization_id)
        ON DELETE RESTRICT,
      ADD CONSTRAINT orders_queue_scope_fk
        FOREIGN KEY (queue_id, organization_id, branch_id)
        REFERENCES queues(id, organization_id, branch_id)
        ON DELETE RESTRICT;

    CREATE INDEX idx_orders_branch_created
      ON orders(branch_id, created_at DESC);
    CREATE INDEX idx_orders_queue_created
      ON orders(queue_id, created_at DESC);
    CREATE INDEX idx_orders_fulfilled_by
      ON orders(fulfilled_by_user_id, fulfilled_at DESC)
      WHERE fulfilled_by_user_id IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_orders_fulfilled_by;
    DROP INDEX IF EXISTS idx_orders_queue_created;
    DROP INDEX IF EXISTS idx_orders_branch_created;

    ALTER TABLE orders
      DROP CONSTRAINT IF EXISTS orders_queue_scope_fk,
      DROP CONSTRAINT IF EXISTS orders_branch_scope_fk,
      DROP COLUMN IF EXISTS fulfilled_at,
      DROP COLUMN IF EXISTS fulfilled_by_employee_code,
      DROP COLUMN IF EXISTS fulfilled_by_name,
      DROP COLUMN IF EXISTS fulfilled_by_user_id,
      DROP COLUMN IF EXISTS queue_name_snapshot,
      DROP COLUMN IF EXISTS branch_name_snapshot,
      DROP COLUMN IF EXISTS organization_name_snapshot,
      DROP COLUMN IF EXISTS queue_id,
      DROP COLUMN IF EXISTS branch_id;
  `);
};
