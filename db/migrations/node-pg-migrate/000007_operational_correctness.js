module.exports.shorthands = undefined;

module.exports.up = async (pgm) => {
  pgm.sql(String.raw`
ALTER TABLE organizations ALTER COLUMN timezone SET DEFAULT 'Asia/Tokyo';
UPDATE organizations SET timezone = 'Asia/Tokyo' WHERE timezone = 'Asia/Bangkok';

CREATE TABLE organization_counters (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  next_order_number BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_counters_order_positive CHECK (next_order_number > 0)
);

INSERT INTO organization_counters (organization_id, next_order_number)
SELECT organization_id, COUNT(*) + 1
FROM orders
GROUP BY organization_id
ON CONFLICT (organization_id) DO NOTHING;

ALTER TABLE queues
  ADD COLUMN counter_business_date DATE;

UPDATE queues q
SET counter_business_date = (q.last_counter_reset_at AT TIME ZONE o.timezone)::date
FROM organizations o
WHERE o.id = q.organization_id;

ALTER TABLE queue_entries
  ADD COLUMN business_date DATE;

UPDATE queue_entries qe
SET business_date = (qe.created_at AT TIME ZONE o.timezone)::date
FROM queues q
JOIN organizations o ON o.id = q.organization_id
WHERE q.id = qe.queue_id;

ALTER TABLE queue_entries
  ALTER COLUMN business_date SET NOT NULL,
  DROP CONSTRAINT queue_entries_ticket_unique,
  DROP CONSTRAINT queue_entries_ticket_code_unique,
  ADD CONSTRAINT queue_entries_daily_ticket_unique UNIQUE (queue_id, business_date, ticket_number),
  ADD CONSTRAINT queue_entries_daily_code_unique UNIQUE (queue_id, business_date, ticket_code);

ALTER TABLE orders
  ADD COLUMN expires_at TIMESTAMPTZ;

ALTER TABLE inventory_reservations
  ADD COLUMN consumed_at TIMESTAMPTZ,
  ADD COLUMN released_at TIMESTAMPTZ,
  ADD COLUMN expired_at TIMESTAMPTZ,
  ADD COLUMN release_reason TEXT;

CREATE UNIQUE INDEX idx_inventory_reservations_order_product
  ON inventory_reservations(order_id, product_id)
  WHERE order_id IS NOT NULL;
CREATE INDEX idx_inventory_reservations_expiry
  ON inventory_reservations(expires_at)
  WHERE status = 'reserved' AND expires_at IS NOT NULL;

CREATE TABLE inventory_reservation_events (
  id BIGSERIAL PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES inventory_reservations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  from_status TEXT,
  to_status TEXT NOT NULL,
  quantity INT NOT NULL,
  reason TEXT,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_reservation_events_status CHECK (
    to_status IN ('reserved', 'consumed', 'released', 'expired')
  ),
  CONSTRAINT inventory_reservation_events_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX idx_inventory_events_order ON inventory_reservation_events(order_id, created_at DESC);
CREATE INDEX idx_inventory_events_reservation ON inventory_reservation_events(reservation_id, created_at DESC);

CREATE TABLE scheduler_job_runs (
  job_name TEXT PRIMARY KEY,
  owner_id TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scheduler_job_runs_status CHECK (status IN ('idle', 'running', 'succeeded', 'failed'))
);
  `);
};

module.exports.down = async (pgm) => {
  pgm.sql(String.raw`
DROP TABLE IF EXISTS scheduler_job_runs;
DROP TABLE IF EXISTS inventory_reservation_events;
DROP INDEX IF EXISTS idx_inventory_reservations_expiry;
DROP INDEX IF EXISTS idx_inventory_reservations_order_product;
ALTER TABLE inventory_reservations
  DROP COLUMN IF EXISTS release_reason,
  DROP COLUMN IF EXISTS expired_at,
  DROP COLUMN IF EXISTS released_at,
  DROP COLUMN IF EXISTS consumed_at;
ALTER TABLE orders DROP COLUMN IF EXISTS expires_at;
ALTER TABLE queue_entries
  DROP CONSTRAINT IF EXISTS queue_entries_daily_code_unique,
  DROP CONSTRAINT IF EXISTS queue_entries_daily_ticket_unique,
  ADD CONSTRAINT queue_entries_ticket_unique UNIQUE (queue_id, ticket_number),
  ADD CONSTRAINT queue_entries_ticket_code_unique UNIQUE (queue_id, ticket_code),
  DROP COLUMN IF EXISTS business_date;
ALTER TABLE queues DROP COLUMN IF EXISTS counter_business_date;
DROP TABLE IF EXISTS organization_counters;
ALTER TABLE organizations ALTER COLUMN timezone SET DEFAULT 'Asia/Bangkok';
  `);
};
