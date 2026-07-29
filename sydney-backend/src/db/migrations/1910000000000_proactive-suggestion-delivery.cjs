exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE personalization_settings
      ADD COLUMN quiet_hours_start TIME NOT NULL DEFAULT '21:00:00',
      ADD COLUMN quiet_hours_end TIME NOT NULL DEFAULT '08:00:00';

    ALTER TABLE suggestions
      ADD COLUMN delivery_surface TEXT NOT NULL DEFAULT 'in_chat'
        CHECK (delivery_surface IN ('in_chat', 'proactive', 'push'));

    CREATE INDEX idx_suggestions_user_surface
      ON suggestions(user_id, delivery_surface, delivered_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_suggestions_user_surface;
    ALTER TABLE suggestions DROP COLUMN IF EXISTS delivery_surface;
    ALTER TABLE personalization_settings
      DROP COLUMN IF EXISTS quiet_hours_start,
      DROP COLUMN IF EXISTS quiet_hours_end;
  `);
};
