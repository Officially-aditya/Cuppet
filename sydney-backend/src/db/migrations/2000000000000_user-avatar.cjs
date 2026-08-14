exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      ADD COLUMN avatar SMALLINT;

    UPDATE users
    SET avatar = CASE image
      WHEN 'assets/icons/bear.png' THEN 1
      WHEN 'assets/icons/capybara.png' THEN 2
      WHEN 'assets/icons/fox_black.png' THEN 3
      WHEN 'assets/icons/koala.png' THEN 4
      WHEN 'assets/icons/owl.png' THEN 5
      WHEN 'assets/icons/panda.png' THEN 6
      WHEN 'assets/icons/pingu.png' THEN 7
      WHEN 'assets/icons/porcu.png' THEN 8
      WHEN 'assets/icons/slowpoke.png' THEN 9
      ELSE NULL
    END
    WHERE image LIKE 'assets/icons/%';

    ALTER TABLE users
      ADD CONSTRAINT users_avatar_number_check
      CHECK (avatar BETWEEN 1 AND 9);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_avatar_number_check,
      DROP COLUMN IF EXISTS avatar;
  `);
};
