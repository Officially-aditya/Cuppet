exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE message_attachments
      ADD COLUMN context_expires_at TIMESTAMPTZ,
      ADD COLUMN context_purged_at TIMESTAMPTZ;

    ALTER TABLE assistant_pending_actions
      DROP CONSTRAINT IF EXISTS assistant_pending_actions_target_agent_id_fkey,
      DROP CONSTRAINT IF EXISTS assistant_pending_actions_source_message_id_fkey,
      ADD CONSTRAINT assistant_pending_actions_target_agent_id_fkey
        FOREIGN KEY (target_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
      ADD CONSTRAINT assistant_pending_actions_source_message_id_fkey
        FOREIGN KEY (source_message_id) REFERENCES agent_messages(id) ON DELETE SET NULL;

    UPDATE message_attachments AS attachment
    SET context_expires_at = COALESCE(
      (
        SELECT uploaded.expires_at
        FROM uploaded_files AS uploaded
        WHERE uploaded.id = attachment.uploaded_file_id
      ),
      attachment.created_at + INTERVAL '1 day'
    ) + INTERVAL '1 day';

    ALTER TABLE message_attachments
      ALTER COLUMN context_expires_at SET NOT NULL;

    CREATE INDEX idx_message_attachments_context_expiry
      ON message_attachments(context_expires_at)
      WHERE extracted_context IS NOT NULL;

    CREATE INDEX idx_assistant_pending_actions_consumed
      ON assistant_pending_actions(consumed_at)
      WHERE consumed_at IS NOT NULL;

    CREATE INDEX idx_assistant_pending_actions_expired
      ON assistant_pending_actions(expires_at)
      WHERE consumed_at IS NULL;

    CREATE INDEX idx_assistant_agent_action_audits_created
      ON assistant_agent_action_audits(created_at);

    UPDATE assistant_memories AS memory
    SET source_message_ids = (
      SELECT COALESCE(array_agg(source.id ORDER BY source.position), '{}'::uuid[])
      FROM unnest(memory.source_message_ids) WITH ORDINALITY AS source(id, position)
      WHERE source.position > GREATEST(cardinality(memory.source_message_ids) - 5, 0)
    )
    WHERE cardinality(memory.source_message_ids) > 5;

    WITH ranked AS (
      SELECT id,
             row_number() OVER (
               PARTITION BY user_id
               ORDER BY updated_at DESC, id DESC
             ) AS position
      FROM assistant_memories
      WHERE status = 'confirmed'
    )
    DELETE FROM assistant_memories AS memory
    USING ranked
    WHERE memory.id = ranked.id AND ranked.position > 200;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_assistant_agent_action_audits_created;
    DROP INDEX IF EXISTS idx_assistant_pending_actions_expired;
    DROP INDEX IF EXISTS idx_assistant_pending_actions_consumed;
    DROP INDEX IF EXISTS idx_message_attachments_context_expiry;

    ALTER TABLE message_attachments
      DROP COLUMN IF EXISTS context_purged_at,
      DROP COLUMN IF EXISTS context_expires_at;

    ALTER TABLE assistant_pending_actions
      DROP CONSTRAINT IF EXISTS assistant_pending_actions_target_agent_id_fkey,
      DROP CONSTRAINT IF EXISTS assistant_pending_actions_source_message_id_fkey,
      ADD CONSTRAINT assistant_pending_actions_target_agent_id_fkey
        FOREIGN KEY (target_agent_id) REFERENCES agents(id) ON DELETE CASCADE,
      ADD CONSTRAINT assistant_pending_actions_source_message_id_fkey
        FOREIGN KEY (source_message_id) REFERENCES agent_messages(id) ON DELETE CASCADE;
  `);
};
