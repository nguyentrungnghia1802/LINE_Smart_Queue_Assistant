/* eslint-disable no-undef */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(String.raw`
    ALTER TABLE notifications
      ALTER COLUMN dispatch_next_retry_at DROP NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(String.raw`
    UPDATE notifications
    SET dispatch_next_retry_at = COALESCE(dispatched_at, updated_at, NOW())
    WHERE dispatch_next_retry_at IS NULL;

    ALTER TABLE notifications
      ALTER COLUMN dispatch_next_retry_at SET NOT NULL;
  `);
};
