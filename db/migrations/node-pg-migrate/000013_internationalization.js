module.exports.shorthands = undefined;

module.exports.up = async (pgm) => {
  pgm.sql(String.raw`
ALTER TABLE users
  ADD COLUMN preferred_locale TEXT,
  ADD CONSTRAINT users_preferred_locale_check
    CHECK (preferred_locale IS NULL OR preferred_locale IN ('ja','vi','en'));

ALTER TABLE organizations
  ADD COLUMN default_locale TEXT NOT NULL DEFAULT 'ja',
  ADD CONSTRAINT organizations_default_locale_check
    CHECK (default_locale IN ('ja','vi','en'));

ALTER TABLE notifications
  ADD COLUMN locale TEXT NOT NULL DEFAULT 'ja',
  ADD CONSTRAINT notifications_locale_check
    CHECK (locale IN ('ja','vi','en'));

CREATE TABLE organization_translations (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('ja','vi','en')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, locale)
);
CREATE TRIGGER trg_organization_translations_updated_at
BEFORE UPDATE ON organization_translations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE product_translations (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('ja','vi','en')),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, locale)
);
CREATE TRIGGER trg_product_translations_updated_at
BEFORE UPDATE ON product_translations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE queue_translations (
  queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('ja','vi','en')),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (queue_id, locale)
);
CREATE TRIGGER trg_queue_translations_updated_at
BEFORE UPDATE ON queue_translations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO organization_translations (organization_id, locale, name)
SELECT id, 'ja', name FROM organizations
ON CONFLICT (organization_id, locale) DO NOTHING;

INSERT INTO product_translations (product_id, locale, name, description)
SELECT id, 'ja', name, description FROM products
ON CONFLICT (product_id, locale) DO NOTHING;

INSERT INTO queue_translations (queue_id, locale, name, description)
SELECT id, 'ja', name, description FROM queues
ON CONFLICT (queue_id, locale) DO NOTHING;

CREATE INDEX idx_notifications_locale_due
  ON notifications(locale, next_retry_at, created_at)
  WHERE status = 'pending';
  `);
};

module.exports.down = async (pgm) => {
  pgm.sql(String.raw`
DROP TABLE IF EXISTS queue_translations;
DROP TABLE IF EXISTS product_translations;
DROP TABLE IF EXISTS organization_translations;
DROP INDEX IF EXISTS idx_notifications_locale_due;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_locale_check;
ALTER TABLE notifications DROP COLUMN IF EXISTS locale;
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_default_locale_check;
ALTER TABLE organizations DROP COLUMN IF EXISTS default_locale;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_preferred_locale_check;
ALTER TABLE users DROP COLUMN IF EXISTS preferred_locale;
  `);
};
