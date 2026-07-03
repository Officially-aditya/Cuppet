import dotenv from "dotenv";
dotenv.config();
import pg from "pg";

async function run() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  const { rows } = await pool.query("SELECT id, name, prompt, parsed_intent, status FROM agents");
  console.log(`Total agents: ${rows.length}`);
  for (const row of rows) {
    console.log("-----------------------------------------");
    console.log("ID:", row.id);
    console.log("Name:", row.name);
    console.log("Status:", row.status);
    console.log("Prompt:", row.prompt);
    console.log("Parsed Intent:", typeof row.parsed_intent === "string" ? row.parsed_intent : JSON.stringify(row.parsed_intent));
  }
  await pool.end();
}

run().catch(console.error);
