/* eslint-disable no-undef */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(String.raw`
    ALTER TABLE payment_transactions
      ALTER COLUMN status SET DEFAULT 'pending';

    ALTER TABLE organization_counters
      ADD COLUMN next_product_number BIGINT NOT NULL DEFAULT 1,
      ADD COLUMN next_service_number BIGINT NOT NULL DEFAULT 1,
      ADD CONSTRAINT organization_counters_product_positive CHECK (next_product_number > 0),
      ADD CONSTRAINT organization_counters_service_positive CHECK (next_service_number > 0);

    INSERT INTO organization_counters (
      organization_id,
      next_order_number,
      next_product_number,
      next_service_number
    )
    SELECT
      organization_id,
      1,
      COALESCE(MAX(SUBSTRING(product_code FROM 3)::BIGINT)
        FILTER (
          WHERE product_type = 'product'
            AND product_code ~ '^SP[1-9][0-9]*$'
        ), 0) + 1,
      COALESCE(MAX(SUBSTRING(product_code FROM 3)::BIGINT)
        FILTER (
          WHERE product_type = 'service'
            AND product_code ~ '^DV[1-9][0-9]*$'
        ), 0) + 1
    FROM products
    GROUP BY organization_id
    ON CONFLICT (organization_id) DO UPDATE SET
      next_product_number = GREATEST(
        organization_counters.next_product_number,
        EXCLUDED.next_product_number
      ),
      next_service_number = GREATEST(
        organization_counters.next_service_number,
        EXCLUDED.next_service_number
      ),
      updated_at = NOW();

    ALTER TABLE products
      DROP CONSTRAINT IF EXISTS products_service_stock_rule,
      DROP CONSTRAINT IF EXISTS products_stock_non_negative,
      DROP COLUMN IF EXISTS branch_id,
      DROP COLUMN IF EXISTS stock_quantity;

    UPDATE notifications
    SET event_type = CASE
      WHEN event_type IN (
        'booking_created', 'eta_warning', 'called', 'serving', 'completed',
        'cancelled', 'no_show', 'deferred', 'location_warning'
      ) THEN event_type
      WHEN COALESCE(event_type, type::TEXT) = 'queue_joined' THEN 'booking_created'
      WHEN COALESCE(event_type, type::TEXT) = 'queue_near_turn' THEN 'eta_warning'
      WHEN COALESCE(event_type, type::TEXT) = 'queue_called' THEN 'called'
      WHEN COALESCE(event_type, type::TEXT) = 'queue_serving' THEN 'serving'
      WHEN COALESCE(event_type, type::TEXT) = 'queue_served' THEN 'completed'
      WHEN COALESCE(event_type, type::TEXT) = 'queue_cancelled' THEN 'cancelled'
      WHEN COALESCE(event_type, type::TEXT) = 'queue_no_show' THEN 'no_show'
      WHEN COALESCE(event_type, type::TEXT) = 'queue_skipped' THEN 'deferred'
      WHEN COALESCE(event_type, type::TEXT) = 'location_warning' THEN 'location_warning'
      ELSE event_type
    END,
    attempt_count = GREATEST(attempt_count, retry_count),
    last_error = COALESCE(last_error, error_message);

    UPDATE notifications
    SET payload = payload || jsonb_build_object('legacyEventType', event_type),
        event_type = 'cancelled',
        status = 'cancelled',
        next_retry_at = NULL,
        processing_started_at = NULL,
        last_error = COALESCE(last_error, 'Unsupported legacy notification event was cancelled')
    WHERE event_type NOT IN (
      'booking_created', 'eta_warning', 'called', 'serving', 'completed',
      'cancelled', 'no_show', 'deferred', 'location_warning'
    );

    UPDATE notifications
    SET status = 'sent',
        sent_at = COALESCE(sent_at, delivered_at)
    WHERE status = 'delivered';

    DROP INDEX IF EXISTS idx_notif_entry_type;
    DROP INDEX IF EXISTS idx_notif_pending;
    DROP INDEX IF EXISTS idx_notif_processing;
    DROP INDEX IF EXISTS idx_notif_due_line_outbox;
    DROP INDEX IF EXISTS idx_notifications_locale_due;
    DROP INDEX IF EXISTS idx_notif_retry_due;
    DROP INDEX IF EXISTS idx_notif_user_recent;
    DROP INDEX IF EXISTS idx_notif_line_user_recent;

    ALTER TABLE notifications
      DROP CONSTRAINT IF EXISTS notifications_retry_count_non_negative,
      DROP COLUMN type,
      DROP COLUMN retry_count,
      DROP COLUMN error_message,
      DROP COLUMN delivered_at,
      ADD CONSTRAINT notifications_event_type_supported CHECK (
        event_type IN (
          'booking_created', 'eta_warning', 'called', 'serving', 'completed',
          'cancelled', 'no_show', 'deferred', 'location_warning'
        )
      );

    DROP TYPE notification_type;

    ALTER TABLE notifications ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE notifications ALTER COLUMN status TYPE TEXT USING status::TEXT;
    DROP TYPE notification_status;
    CREATE TYPE notification_status AS ENUM (
      'pending', 'processing', 'sent', 'failed', 'cancelled'
    );
    ALTER TABLE notifications
      ALTER COLUMN status TYPE notification_status USING status::notification_status,
      ALTER COLUMN status SET DEFAULT 'pending';

    CREATE INDEX idx_notif_pending ON notifications(created_at)
      WHERE status = 'pending';
    CREATE INDEX idx_notif_processing ON notifications(created_at)
      WHERE status = 'processing';
    CREATE INDEX idx_notif_due_line_outbox ON notifications(next_retry_at, created_at)
      WHERE channel = 'line_push' AND status = 'pending';
    CREATE INDEX idx_notifications_locale_due
      ON notifications(locale, next_retry_at, created_at)
      WHERE status = 'pending';
    CREATE INDEX idx_notif_retry_due ON notifications(next_retry_at)
      WHERE status = 'failed' AND next_retry_at IS NOT NULL;
    CREATE INDEX idx_notif_user_recent ON notifications(user_id, created_at DESC)
      WHERE user_id IS NOT NULL AND status = 'sent';
    CREATE INDEX idx_notif_line_user_recent ON notifications(line_user_id, created_at DESC)
      WHERE line_user_id IS NOT NULL AND status = 'sent';
  `);
};

exports.down = (pgm) => {
  pgm.sql(String.raw`
    DROP INDEX IF EXISTS idx_notif_line_user_recent;
    DROP INDEX IF EXISTS idx_notif_user_recent;
    DROP INDEX IF EXISTS idx_notif_retry_due;
    DROP INDEX IF EXISTS idx_notifications_locale_due;
    DROP INDEX IF EXISTS idx_notif_due_line_outbox;
    DROP INDEX IF EXISTS idx_notif_processing;
    DROP INDEX IF EXISTS idx_notif_pending;

    ALTER TABLE notifications ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE notifications ALTER COLUMN status TYPE TEXT USING status::TEXT;
    DROP TYPE notification_status;
    CREATE TYPE notification_status AS ENUM (
      'pending', 'processing', 'sent', 'delivered', 'failed', 'cancelled'
    );
    ALTER TABLE notifications
      ALTER COLUMN status TYPE notification_status USING status::notification_status,
      ALTER COLUMN status SET DEFAULT 'pending';

    CREATE TYPE notification_type AS ENUM (
      'queue_joined', 'queue_near_turn', 'queue_called', 'queue_skipped',
      'queue_cancelled', 'queue_serving', 'queue_served', 'queue_no_show',
      'payment_required', 'payment_received', 'location_warning'
    );

    ALTER TABLE notifications
      DROP CONSTRAINT IF EXISTS notifications_event_type_supported,
      ADD COLUMN type notification_type,
      ADD COLUMN retry_count INT NOT NULL DEFAULT 0,
      ADD COLUMN error_message TEXT,
      ADD COLUMN delivered_at TIMESTAMPTZ;

    UPDATE notifications
    SET type = CASE event_type
      WHEN 'booking_created' THEN 'queue_joined'::notification_type
      WHEN 'eta_warning' THEN 'queue_near_turn'::notification_type
      WHEN 'called' THEN 'queue_called'::notification_type
      WHEN 'serving' THEN 'queue_serving'::notification_type
      WHEN 'completed' THEN 'queue_served'::notification_type
      WHEN 'cancelled' THEN 'queue_cancelled'::notification_type
      WHEN 'no_show' THEN 'queue_no_show'::notification_type
      WHEN 'deferred' THEN 'queue_skipped'::notification_type
      ELSE 'location_warning'::notification_type
    END,
    retry_count = attempt_count,
    error_message = last_error;

    ALTER TABLE notifications
      ALTER COLUMN type SET NOT NULL,
      ADD CONSTRAINT notifications_retry_count_non_negative CHECK (retry_count >= 0);

    CREATE INDEX idx_notif_entry_type ON notifications(queue_entry_id, type, created_at DESC)
      WHERE queue_entry_id IS NOT NULL;
    CREATE INDEX idx_notif_pending ON notifications(created_at)
      WHERE status = 'pending';
    CREATE INDEX idx_notif_processing ON notifications(created_at)
      WHERE status = 'processing';
    CREATE INDEX idx_notif_due_line_outbox ON notifications(next_retry_at, created_at)
      WHERE channel = 'line_push' AND status = 'pending';
    CREATE INDEX idx_notifications_locale_due
      ON notifications(locale, next_retry_at, created_at)
      WHERE status = 'pending';
    CREATE INDEX idx_notif_retry_due ON notifications(next_retry_at)
      WHERE status = 'failed' AND next_retry_at IS NOT NULL;
    CREATE INDEX idx_notif_user_recent ON notifications(user_id, created_at DESC)
      WHERE user_id IS NOT NULL AND status IN ('sent', 'delivered');
    CREATE INDEX idx_notif_line_user_recent ON notifications(line_user_id, created_at DESC)
      WHERE line_user_id IS NOT NULL AND status IN ('sent', 'delivered');

    ALTER TABLE products
      ADD COLUMN branch_id UUID,
      ADD COLUMN stock_quantity INT,
      ADD CONSTRAINT products_stock_non_negative CHECK (
        stock_quantity IS NULL OR stock_quantity >= 0
      ),
      ADD CONSTRAINT products_service_stock_rule CHECK (
        product_type = 'product' OR stock_quantity IS NULL
      );

    UPDATE products product
    SET branch_id = (
          SELECT inventory.branch_id
          FROM branch_product_inventories inventory
          WHERE inventory.product_id = product.id
          ORDER BY inventory.created_at, inventory.branch_id
          LIMIT 1
        ),
        stock_quantity = CASE
          WHEN product.product_type = 'product' THEN (
            SELECT inventory.stock_quantity
            FROM branch_product_inventories inventory
            WHERE inventory.product_id = product.id
            ORDER BY inventory.created_at, inventory.branch_id
            LIMIT 1
          )
          ELSE NULL
        END;

    ALTER TABLE organization_counters
      DROP CONSTRAINT IF EXISTS organization_counters_service_positive,
      DROP CONSTRAINT IF EXISTS organization_counters_product_positive,
      DROP COLUMN IF EXISTS next_service_number,
      DROP COLUMN IF EXISTS next_product_number;

    ALTER TABLE payment_transactions
      ALTER COLUMN status SET DEFAULT 'unpaid';
  `);
};
