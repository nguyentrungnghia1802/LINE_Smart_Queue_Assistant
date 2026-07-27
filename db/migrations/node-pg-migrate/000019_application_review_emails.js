/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE email_outbox
      DROP CONSTRAINT IF EXISTS email_outbox_template_key_check,
      ADD CONSTRAINT email_outbox_template_key_check
        CHECK (template_key IN (
          'account_activation',
          'password_reset',
          'organization_application_submitted',
          'organization_application_rejected'
        ));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM email_outbox
    WHERE template_key IN (
      'organization_application_submitted',
      'organization_application_rejected'
    );

    ALTER TABLE email_outbox
      DROP CONSTRAINT IF EXISTS email_outbox_template_key_check,
      ADD CONSTRAINT email_outbox_template_key_check
        CHECK (template_key IN ('account_activation','password_reset'));
  `);
};
