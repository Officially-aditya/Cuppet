exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE agent_runs
      ADD COLUMN queue_job_id TEXT;

    ALTER TABLE agent_runs
      ADD CONSTRAINT agent_runs_queue_job_id_key UNIQUE (queue_job_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE agent_runs
      DROP CONSTRAINT IF EXISTS agent_runs_queue_job_id_key;

    ALTER TABLE agent_runs
      DROP COLUMN IF EXISTS queue_job_id;
  `);
};
