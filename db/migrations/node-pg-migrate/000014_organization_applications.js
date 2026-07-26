module.exports.shorthands = undefined;

module.exports.up = async (pgm) => {
  pgm.sql(String.raw`
CREATE TABLE organization_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  legal_name TEXT NOT NULL,
  trade_name TEXT NOT NULL,
  business_type TEXT NOT NULL
    CHECK (business_type IN ('restaurant','salon','clinic','retail','public_service','other')),
  registration_number TEXT,
  website_url TEXT,
  contact_name TEXT NOT NULL,
  contact_title TEXT,
  work_email TEXT NOT NULL,
  phone TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  prefecture TEXT NOT NULL,
  city TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  location_count INT NOT NULL CHECK (location_count BETWEEN 1 AND 10000),
  expected_monthly_customers INT NOT NULL
    CHECK (expected_monthly_customers BETWEEN 1 AND 10000000),
  plan_code TEXT NOT NULL CHECK (plan_code IN ('starter','standard','scale')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly','annual')),
  default_locale TEXT NOT NULL DEFAULT 'ja' CHECK (default_locale IN ('ja','vi','en')),
  logo_url TEXT,
  manager_password_hash TEXT,
  payment_provider TEXT NOT NULL DEFAULT 'demo',
  payment_status TEXT NOT NULL DEFAULT 'paid'
    CHECK (payment_status IN ('pending','paid','failed','refunded')),
  payment_reference TEXT NOT NULL UNIQUE,
  amount_yen INT NOT NULL CHECK (amount_yen >= 0),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_applications_postal_code_format
    CHECK (postal_code ~ '^[0-9]{3}-?[0-9]{4}$'),
  CONSTRAINT organization_applications_review_state
    CHECK (
      (status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL)
      OR
      (status IN ('approved','rejected') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
    )
);

CREATE TRIGGER trg_organization_applications_updated_at
BEFORE UPDATE ON organization_applications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX uq_organization_applications_pending_email
  ON organization_applications (LOWER(work_email))
  WHERE status = 'pending';
CREATE INDEX idx_organization_applications_status_submitted
  ON organization_applications (status, submitted_at DESC);
CREATE INDEX idx_organization_applications_organization
  ON organization_applications (organization_id)
  WHERE organization_id IS NOT NULL;
  `);
};

module.exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS organization_applications;');
};
