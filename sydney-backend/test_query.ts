import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://sydney:sydney@localhost:5432/sydney_dev"
});

async function run() {
  const agents = await pool.query("SELECT id, name, prompt, parsed_intent, status FROM agents ORDER BY created_at DESC");
  console.log("ALL AGENTS:");
  console.dir(agents.rows, { depth: null });

  for (const agent of agents.rows) {
    const messages = await pool.query(
      "SELECT id, role, content FROM agent_messages WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 2",
      [agent.id]
    );
    console.log(`\nMESSAGES FOR AGENT ${agent.name} (${agent.id}):`);
    console.dir(messages.rows, { depth: null });
  }

  await pool.end();
}

run().catch(console.error);
