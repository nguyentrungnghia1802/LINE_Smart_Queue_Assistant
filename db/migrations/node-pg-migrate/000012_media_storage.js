module.exports.shorthands = undefined;

module.exports.up = async (pgm) => {
  pgm.sql(String.raw`
CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  storage_provider TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  purpose TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT media_assets_provider CHECK (storage_provider IN ('local','mock','object')),
  CONSTRAINT media_assets_purpose CHECK (purpose IN ('organization_logo','product_image')),
  CONSTRAINT media_assets_content_type CHECK (content_type IN ('image/webp','image/png','image/jpeg')),
  CONSTRAINT media_assets_size CHECK (byte_size > 0),
  CONSTRAINT media_assets_status CHECK (status IN ('active','deleted'))
);
CREATE TRIGGER trg_media_assets_updated_at
BEFORE UPDATE ON media_assets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_media_assets_org_active
  ON media_assets(organization_id, created_at DESC) WHERE status = 'active';
CREATE INDEX idx_media_assets_owner_active
  ON media_assets(owner_user_id, created_at DESC) WHERE status = 'active';
  `);
};

module.exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS media_assets;');
};
