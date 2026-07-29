exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE personalization_settings
      DROP CONSTRAINT IF EXISTS personalization_settings_frequency_check;
    ALTER TABLE personalization_settings
      ADD CONSTRAINT personalization_settings_frequency_check
      CHECK (frequency IN ('low', 'balanced', 'high'));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    UPDATE personalization_settings
    SET frequency = 'balanced'
    WHERE frequency = 'high';
    ALTER TABLE personalization_settings
      DROP CONSTRAINT IF EXISTS personalization_settings_frequency_check;
    ALTER TABLE personalization_settings
      ADD CONSTRAINT personalization_settings_frequency_check
      CHECK (frequency IN ('low', 'balanced'));
  `);
};
