import { pool } from "../db/index.js";

const ASSISTANT_CONTENT = {
  template: "plain_text",
  version: "1.0",
  data: {
    headline: "Hey! I'm Sydney.",
    body:
      "I can chat with you like Claude or ChatGPT. The real magic is agents: tell me what you want, and I can create a contact that messages you on schedule.",
    items: [
      {
        title: "Try this",
        summary: "\"deliver me tech news at 7am daily\""
      }
    ],
    footer: "What would you like to do?"
  }
};

export async function ensureAssistantContact(userId: string): Promise<string> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query<{ id: string }>(
      "SELECT id FROM agents WHERE user_id = $1 AND is_assistant = TRUE",
      [userId]
    );

    if (existing.rows[0]) {
      await client.query("COMMIT");
      return existing.rows[0].id;
    }

    const created = await client.query<{ id: string }>(
      `
        INSERT INTO agents
          (user_id, name, avatar, prompt, parsed_intent, connector_ids,
           schedule_cron, is_assistant, status, safety_level, last_message_at)
        VALUES
          ($1, 'Assistant', 'bot', 'Pre-installed Assistant contact',
           $2, '{}', NULL, TRUE, 'active', 'read', NOW())
        RETURNING id
      `,
      [
        userId,
        JSON.stringify({
          intent: "assistant",
          output_template: "plain_text"
        })
      ]
    );

    const assistantId = created.rows[0]!.id;

    await client.query(
      `
        INSERT INTO agent_messages
          (agent_id, user_id, role, content, source_refs)
        VALUES ($1, $2, 'agent', $3, '[]'::jsonb)
      `,
      [assistantId, userId, JSON.stringify(ASSISTANT_CONTENT)]
    );

    await client.query("COMMIT");
    return assistantId;
  } catch (error) {
    await client.query("ROLLBACK");

    const recovered = await pool.query<{ id: string }>(
      "SELECT id FROM agents WHERE user_id = $1 AND is_assistant = TRUE",
      [userId]
    );

    if (recovered.rows[0]) return recovered.rows[0].id;
    throw error;
  } finally {
    client.release();
  }
}
