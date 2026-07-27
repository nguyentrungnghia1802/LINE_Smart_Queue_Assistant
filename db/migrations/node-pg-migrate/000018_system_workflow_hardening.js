/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE organization_branches
      ADD COLUMN latitude NUMERIC(9,6),
      ADD COLUMN longitude NUMERIC(9,6),
      ADD CONSTRAINT organization_branches_latitude_range
        CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
      ADD CONSTRAINT organization_branches_longitude_range
        CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
      ADD CONSTRAINT organization_branches_coordinates_pair
        CHECK ((latitude IS NULL) = (longitude IS NULL));

    ALTER TABLE queues
      ALTER COLUMN auto_no_show_minutes SET DEFAULT 5,
      ADD COLUMN absence_deferral_slots INT NOT NULL DEFAULT 3,
      ADD COLUMN max_absence_count INT NOT NULL DEFAULT 3,
      ADD CONSTRAINT queues_absence_deferral_slots_positive
        CHECK (absence_deferral_slots > 0),
      ADD CONSTRAINT queues_max_absence_count_positive
        CHECK (max_absence_count > 0);

    UPDATE queues
    SET auto_no_show_minutes = 5
    WHERE auto_no_show_minutes IS NULL;

    ALTER TABLE queue_entries
      ADD COLUMN absence_count INT NOT NULL DEFAULT 0,
      ADD CONSTRAINT queue_entries_absence_count_non_negative
        CHECK (absence_count >= 0);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE queue_entries
      DROP CONSTRAINT IF EXISTS queue_entries_absence_count_non_negative,
      DROP COLUMN IF EXISTS absence_count;

    ALTER TABLE queues
      DROP CONSTRAINT IF EXISTS queues_max_absence_count_positive,
      DROP CONSTRAINT IF EXISTS queues_absence_deferral_slots_positive,
      DROP COLUMN IF EXISTS max_absence_count,
      DROP COLUMN IF EXISTS absence_deferral_slots,
      ALTER COLUMN auto_no_show_minutes DROP DEFAULT;

    ALTER TABLE organization_branches
      DROP CONSTRAINT IF EXISTS organization_branches_coordinates_pair,
      DROP CONSTRAINT IF EXISTS organization_branches_longitude_range,
      DROP CONSTRAINT IF EXISTS organization_branches_latitude_range,
      DROP COLUMN IF EXISTS longitude,
      DROP COLUMN IF EXISTS latitude;
  `);
};
