exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE connector_tokens
      DROP CONSTRAINT IF EXISTS connector_tokens_status_check;

    ALTER TABLE connector_tokens
      ADD CONSTRAINT connector_tokens_status_check
      CHECK (status IN ('connected', 'disconnected', 'action_required'));

    ALTER TABLE connector_statuses
      DROP CONSTRAINT IF EXISTS connector_statuses_status_check;

    ALTER TABLE connector_statuses
      ADD CONSTRAINT connector_statuses_status_check
      CHECK (status IN ('connected', 'disconnected', 'action_required'));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    UPDATE connector_tokens
    SET status = 'disconnected'
    WHERE status = 'action_required';

    UPDATE connector_statuses
    SET status = 'disconnected'
    WHERE status = 'action_required';

    ALTER TABLE connector_tokens
      DROP CONSTRAINT IF EXISTS connector_tokens_status_check;

    ALTER TABLE connector_tokens
      ADD CONSTRAINT connector_tokens_status_check
      CHECK (status IN ('connected', 'disconnected'));

    ALTER TABLE connector_statuses
      DROP CONSTRAINT IF EXISTS connector_statuses_status_check;

    ALTER TABLE connector_statuses
      ADD CONSTRAINT connector_statuses_status_check
      CHECK (status IN ('connected', 'disconnected'));
  `);
};
