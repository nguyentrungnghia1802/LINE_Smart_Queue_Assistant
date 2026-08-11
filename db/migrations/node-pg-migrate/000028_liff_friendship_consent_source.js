/* eslint-disable no-undef */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(String.raw`
    ALTER TABLE line_notification_preferences
      DROP CONSTRAINT line_preferences_consent_source,
      ADD CONSTRAINT line_preferences_consent_source CHECK (
        consent_source IS NULL OR consent_source IN (
          'line_follow',
          'liff_settings',
          'liff_friendship',
          'legacy_link'
        )
      );
  `);
};

exports.down = (pgm) => {
  pgm.sql(String.raw`
    UPDATE line_notification_preferences
    SET consent_source = 'liff_settings'
    WHERE consent_source = 'liff_friendship';

    ALTER TABLE line_notification_preferences
      DROP CONSTRAINT line_preferences_consent_source,
      ADD CONSTRAINT line_preferences_consent_source CHECK (
        consent_source IS NULL OR consent_source IN (
          'line_follow',
          'liff_settings',
          'legacy_link'
        )
      );
  `);
};
