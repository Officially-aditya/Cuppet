import dotenv from "dotenv";
dotenv.config();
import { parseIntentHybrid } from "../src/agents/llm-intent.js";

async function run() {
  const p1 = "financial market monitor";
  const p2 = "Create an agent that watches major updates for stocks like RIL, TCS, MRF every weekday at 4 PM and gives me a clear explanation when something important happens.";
  console.log("p1 hybrid:", await parseIntentHybrid(p1));
  console.log("p2 hybrid:", await parseIntentHybrid(p2));
}
run().catch(console.error);
