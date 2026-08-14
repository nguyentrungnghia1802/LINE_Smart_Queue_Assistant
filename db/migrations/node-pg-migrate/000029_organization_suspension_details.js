/* eslint-disable no-undef */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(String.raw`
    ALTER TABLE organizations
      ADD COLUMN suspension_reason TEXT,
      ADD COLUMN suspension_note TEXT;

    UPDATE organizations
    SET suspension_reason = 'other'
    WHERE activation_status = 'suspended';

    ALTER TABLE organizations
      ADD CONSTRAINT organizations_suspension_reason CHECK (
        suspension_reason IS NULL OR suspension_reason IN (
          'contract_renewal_cancelled',
          'organization_request',
          'other'
        )
      ),
      ADD CONSTRAINT organizations_suspension_note_length CHECK (
        suspension_note IS NULL OR char_length(suspension_note) <= 1000
      ),
      ADD CONSTRAINT organizations_suspension_details CHECK (
        (activation_status = 'suspended' AND suspension_reason IS NOT NULL)
        OR (activation_status <> 'suspended' AND suspension_reason IS NULL AND suspension_note IS NULL)
      );
  `);
};

exports.down = (pgm) => {
  pgm.sql(String.raw`
    ALTER TABLE organizations
      DROP CONSTRAINT organizations_suspension_details,
      DROP CONSTRAINT organizations_suspension_note_length,
      DROP CONSTRAINT organizations_suspension_reason,
      DROP COLUMN suspension_note,
      DROP COLUMN suspension_reason;
  `);
};
