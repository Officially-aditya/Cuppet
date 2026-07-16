const OLD_PROMPT = '"deliver me tech news at 7am daily"';
const NEW_PROMPT = '"Create an agent that delivers tech news every day at 7am."';

exports.up = (pgm) => {
  pgm.sql(`
    UPDATE agent_messages AS message
    SET content = jsonb_set(
      message.content,
      '{data,items,0,summary}',
      to_jsonb('${NEW_PROMPT}'::text)
    )
    FROM agents AS agent
    WHERE message.agent_id = agent.id
      AND agent.is_assistant = TRUE
      AND message.role = 'agent'
      AND message.content #>> '{data,items,0,title}' = 'Try this'
      AND message.content #>> '{data,items,0,summary}' = '${OLD_PROMPT}';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    UPDATE agent_messages AS message
    SET content = jsonb_set(
      message.content,
      '{data,items,0,summary}',
      to_jsonb('${OLD_PROMPT}'::text)
    )
    FROM agents AS agent
    WHERE message.agent_id = agent.id
      AND agent.is_assistant = TRUE
      AND message.role = 'agent'
      AND message.content #>> '{data,items,0,title}' = 'Try this'
      AND message.content #>> '{data,items,0,summary}' = '${NEW_PROMPT}';
  `);
};
