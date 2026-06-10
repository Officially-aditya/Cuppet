exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS jwks (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "publicKey"   TEXT NOT NULL,
      "privateKey"  TEXT NOT NULL,
      alg           TEXT,
      crv           TEXT,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "expiresAt"   TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_jwks_created_at
      ON jwks("createdAt" DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS jwks;
  `);
};
