exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      ADD COLUMN time_zone TEXT,
      ADD COLUMN follow_device_time_zone BOOLEAN NOT NULL DEFAULT TRUE;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      DROP COLUMN IF EXISTS follow_device_time_zone,
      DROP COLUMN IF EXISTS time_zone;
  `);
};
