import assert from "node:assert/strict";
import test from "node:test";
import { responseLimitInstruction, responseStyleGuidance, maxTokensForResponseLimit } from "./parser.js";

test("verbosity helpers return distinct, non-conflicting directives", () => {
  const conciseInstr = responseLimitInstruction("concise");
  const detailedInstr = responseLimitInstruction("detailed");
  const balancedInstr = responseLimitInstruction("balanced");

  assert.match(conciseInstr, /extremely brief, concise, and focused/);
  assert.match(detailedInstr, /highly detailed, verbose, and precise/);
  assert.match(balancedInstr, /balanced summary of information/);

  const conciseStyle = responseStyleGuidance("concise");
  const detailedStyle = responseStyleGuidance("detailed");
  const balancedStyle = responseStyleGuidance("balanced");

  assert.match(conciseStyle, /extremely brief/);
  assert.match(detailedStyle, /comprehensive/);
  assert.match(balancedStyle, /balanced/);

  assert.doesNotMatch(detailedStyle, /concise/i);
  assert.doesNotMatch(detailedInstr, /extremely brief/i);
});

test("token allocations match configured verbosity constraints", () => {
  assert.equal(maxTokensForResponseLimit("concise"), 512);
  assert.equal(maxTokensForResponseLimit("balanced"), 900);
  assert.equal(maxTokensForResponseLimit("detailed"), 1200);
});
