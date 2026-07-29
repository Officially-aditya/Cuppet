exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE suggestion_exclusions
      ADD CONSTRAINT suggestion_exclusions_subject_type_check
        CHECK (subject_type IN (
          'topic', 'source', 'format', 'timing', 'agent_type', 'capability',
          'notification_policy', 'exclusion'
        )),
      ADD CONSTRAINT suggestion_exclusions_subject_key_check
        CHECK (char_length(subject_key) BETWEEN 1 AND 180);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE suggestion_exclusions
      DROP CONSTRAINT IF EXISTS suggestion_exclusions_subject_key_check,
      DROP CONSTRAINT IF EXISTS suggestion_exclusions_subject_type_check;
  `);
};
