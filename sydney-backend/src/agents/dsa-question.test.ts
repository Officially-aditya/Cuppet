import assert from "node:assert/strict";
import test from "node:test";
import { renderDsaQuestion, createDsaQuestionSection } from "./dsa-question.js";

test("dsa-question filters out topicsCovered questions", () => {
  const agentId = "test-agent-id";
  const now = new Date("2026-06-24T12:00:00Z");

  // Get the question without topics covered
  const q1 = renderDsaQuestion({ agentId, now });

  // Now run it passing the title of q1 as covered
  const q2 = renderDsaQuestion({ agentId, now, topicsCovered: [q1.title] });

  // They must be different questions!
  assert.notEqual(q1.title, q2.title);

  // Check section generation as well
  const sec1 = createDsaQuestionSection({ agentId, now });
  const sec2 = createDsaQuestionSection({ agentId, now, topicsCovered: [q1.title] });

  assert.ok(sec1.includes(q1.title));
  assert.ok(sec2.includes(q2.title));
  assert.ok(!sec2.includes(q1.title));
});

test("dsa-question fallback to list when all questions covered", () => {
  const agentId = "test-agent-id";
  const now = new Date("2026-06-24T12:00:00Z");

  // If we cover everything, it should still return a valid question rather than crashing
  const allTitles = [
    "Two Sum",
    "Valid Parentheses",
    "Merge Intervals",
    "Binary Tree Level Order Traversal",
    "Longest Substring Without Repeating Characters",
    "Top K Frequent Elements",
    "Number of Islands",
    "Search in Rotated Sorted Array",
    "Coin Change",
    "Daily Temperatures",
    "Product of Array Except Self",
    "Course Schedule"
  ];

  const q = renderDsaQuestion({ agentId, now, topicsCovered: allTitles });
  assert.ok(allTitles.includes(q.title));
});
