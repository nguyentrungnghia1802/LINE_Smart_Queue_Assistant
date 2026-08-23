/* eslint-disable no-undef */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(String.raw`
    UPDATE queue_products assignment
    SET is_active = FALSE,
        updated_at = NOW()
    FROM products product, queues queue
    WHERE assignment.product_id = product.id
      AND assignment.queue_id = queue.id
      AND assignment.is_active = TRUE
      AND (product.is_active = FALSE OR queue.is_active = FALSE);
  `);
};

// This data repair is intentionally irreversible: reactivating assignments on rollback could
// restore products that a manager had explicitly removed from a queue before this migration.
exports.down = () => undefined;
