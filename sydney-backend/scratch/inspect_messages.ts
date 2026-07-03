import dotenv from "dotenv";
dotenv.config();
import pg from "pg";

async function run() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  const { rows } = await pool.query("SELECT id, agent_id, role, content, created_at FROM agent_messages ORDER BY created_at DESC LIMIT 20");
  console.log(`Total messages listed: ${rows.length}`);
  for (const row of rows) {
    const content = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
    console.log("-----------------------------------------");
    console.log("ID:", row.id);
    console.log("Agent ID:", row.agent_id);
    console.log("Role:", row.role);
    console.log("Template:", content.template);
    console.log("Content Data:", JSON.stringify(content.data, null, 2));
    console.log("Created At:", row.created_at);
  }
  await pool.end();
}

run().catch(console.error);
