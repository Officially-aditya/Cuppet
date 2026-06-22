import { parseIntent } from "./src/agents/parser.js";

const prompts = [
  "Generate a study plan for DSA",
  "dsa study agent",
  "study dsa",
  "DSA Daily Practice Agent"
];

for (const prompt of prompts) {
  console.log(`Prompt: "${prompt}"`);
  console.log(JSON.stringify(parseIntent(prompt), null, 2));
  console.log("-".repeat(40));
}

