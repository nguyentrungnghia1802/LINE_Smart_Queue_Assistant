module.exports.shorthands = undefined;

module.exports.up = async (pgm) => {
  pgm.sql(String.raw`
ALTER TABLE organizations
  ADD COLUMN postal_code TEXT,
  ADD COLUMN prefecture TEXT,
  ADD COLUMN city TEXT,
  ADD COLUMN address_line1 TEXT,
  ADD COLUMN address_line2 TEXT;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_postal_code_format
  CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{3}-?[0-9]{4}$');

CREATE TABLE organization_business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  opens_at TIME,
  closes_at TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_business_hours_unique UNIQUE (organization_id, weekday),
  CONSTRAINT organization_business_hours_weekday CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT organization_business_hours_times CHECK (
    (is_closed AND opens_at IS NULL AND closes_at IS NULL)
    OR (NOT is_closed AND opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at)
  )
);
CREATE TRIGGER trg_organization_business_hours_updated_at
BEFORE UPDATE ON organization_business_hours
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE organization_exception_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT TRUE,
  opens_at TIME,
  closes_at TIME,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_exception_days_unique UNIQUE (organization_id, exception_date),
  CONSTRAINT organization_exception_days_times CHECK (
    (is_closed AND opens_at IS NULL AND closes_at IS NULL)
    OR (NOT is_closed AND opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at)
  )
);
CREATE TRIGGER trg_organization_exception_days_updated_at
BEFORE UPDATE ON organization_exception_days
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

UPDATE customer_locations
SET expires_at = captured_at + INTERVAL '30 days'
WHERE expires_at IS NULL AND deleted_at IS NULL;

CREATE INDEX idx_booking_groups_customer_updated
  ON booking_groups(customer_user_id, updated_at DESC)
  WHERE customer_user_id IS NOT NULL;
CREATE INDEX idx_booking_groups_line_updated
  ON booking_groups(customer_line_user_id, updated_at DESC)
  WHERE customer_line_user_id IS NOT NULL;
CREATE INDEX idx_organization_exception_days_lookup
  ON organization_exception_days(organization_id, exception_date);
  `);
};

module.exports.down = async (pgm) => {
  pgm.sql(String.raw`
DROP INDEX IF EXISTS idx_organization_exception_days_lookup;
DROP INDEX IF EXISTS idx_booking_groups_line_updated;
DROP INDEX IF EXISTS idx_booking_groups_customer_updated;
DROP TABLE IF EXISTS organization_exception_days;
DROP TABLE IF EXISTS organization_business_hours;
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_postal_code_format,
  DROP COLUMN IF EXISTS address_line2,
  DROP COLUMN IF EXISTS address_line1,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS prefecture,
  DROP COLUMN IF EXISTS postal_code;
  `);
};
