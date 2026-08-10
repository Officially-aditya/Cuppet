exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE waitlists (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email      TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX waitlists_email_unique_idx
      ON waitlists (LOWER(email));

    CREATE INDEX waitlists_created_at_idx
      ON waitlists(created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS waitlists_created_at_idx;
    DROP INDEX IF EXISTS waitlists_email_unique_idx;
    DROP TABLE IF EXISTS waitlists;
  `);
};
