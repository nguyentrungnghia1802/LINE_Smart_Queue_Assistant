module.exports.shorthands = undefined;

module.exports.up = async (pgm) => {
  pgm.sql(String.raw`
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'authorized';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS return_url TEXT,
  ADD COLUMN IF NOT EXISTS webhook_status TEXT,
  ADD COLUMN IF NOT EXISTS webhook_event_id TEXT,
  ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider                 TEXT NOT NULL,
  event_id                 TEXT NOT NULL,
  event_type               TEXT NOT NULL,
  payment_transaction_id   UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
  signature_valid          BOOLEAN NOT NULL DEFAULT FALSE,
  processing_status        TEXT NOT NULL DEFAULT 'received',
  raw_payload              JSONB NOT NULL DEFAULT '{}',
  error_message            TEXT,
  processed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT payment_webhook_events_status_valid CHECK (
    processing_status IN ('received', 'processed', 'failed')
  ),
  CONSTRAINT payment_webhook_events_unique_event UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_intent
  ON payment_transactions(provider, payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_state
  ON payment_transactions(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_transaction
  ON payment_webhook_events(payment_transaction_id)
  WHERE payment_transaction_id IS NOT NULL;

COMMENT ON COLUMN payment_transactions.payment_intent_id IS
  'Provider-side payment intent/session id. Never stores provider secrets.';
COMMENT ON COLUMN payment_transactions.metadata IS
  'Server-computed cart coverage and reconciliation metadata.';
COMMENT ON TABLE payment_webhook_events IS
  'Idempotent payment webhook event log for replay-safe processing.';
  `);
};

module.exports.down = async (pgm) => {
  pgm.sql(String.raw`
DROP TABLE IF EXISTS payment_webhook_events CASCADE;
DROP INDEX IF EXISTS idx_payment_transactions_intent;
DROP INDEX IF EXISTS idx_payment_transactions_state;
ALTER TABLE payment_transactions
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS last_error,
  DROP COLUMN IF EXISTS last_verified_at,
  DROP COLUMN IF EXISTS cancelled_at,
  DROP COLUMN IF EXISTS failed_at,
  DROP COLUMN IF EXISTS authorized_at,
  DROP COLUMN IF EXISTS webhook_event_id,
  DROP COLUMN IF EXISTS webhook_status,
  DROP COLUMN IF EXISTS return_url,
  DROP COLUMN IF EXISTS checkout_url,
  DROP COLUMN IF EXISTS payment_intent_id;
  `);
};
