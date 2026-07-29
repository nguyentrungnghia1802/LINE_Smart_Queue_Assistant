/* eslint-disable no-undef */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE organization_branches
      ADD COLUMN google_place_id TEXT,
      ADD COLUMN formatted_map_address TEXT;

    CREATE INDEX idx_organization_branches_google_place
      ON organization_branches(google_place_id)
      WHERE google_place_id IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_organization_branches_google_place;
    ALTER TABLE organization_branches
      DROP COLUMN IF EXISTS formatted_map_address,
      DROP COLUMN IF EXISTS google_place_id;
  `);
};
