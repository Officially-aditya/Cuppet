import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeArchiveMessage,
  parseArchiveJsonl,
  serializeArchiveJsonl,
  shardArchiveRecords
} from "./message-archive.js";

const agentId = "11111111-1111-4111-8111-111111111111";
const messageId = "22222222-2222-4222-8222-222222222222";

test("archive normalization strips private context and binary attachment fields", () => {
  const record = normalizeArchiveMessage({
    id: messageId,
    agent_id: agentId,
    agent_name: "Research",
    role: "agent",
    created_at: "2026-07-16T12:00:00.000Z",
    content: {
      template: "plain_text",
      data: {
        body: "User-visible answer",
        hidden_prompt: "never export",
        extracted_context: "OCR text",
        attachments: [{ bytes: "secret" }]
      }
    },
    source_refs: [
      { title: "Safe", url: "https://example.com/source", source: "Web" },
      { title: "Unsafe", url: "http://example.com/insecure" }
    ],
    attachments: [
      { filename: "report.pdf", mime_type: "application/pdf", size: 1200, bytes: "not exported" }
    ]
  });
  assert.equal((record.content.data as Record<string, unknown>).body, "User-visible answer");
  assert.equal("hidden_prompt" in (record.content.data as Record<string, unknown>), false);
  assert.deepEqual(record.source_links, [
    { label: "Safe", url: "https://example.com/source", source: "Web" }
  ]);
  assert.deepEqual(record.attachments, [
    { filename: "report.pdf", mime_type: "application/pdf", size: 1200 }
  ]);
});

test("JSONL archives have a strict header and reject altered ownership", () => {
  const record = normalizeArchiveMessage({
    id: messageId,
    agent_id: agentId,
    agent_name: "Research",
    role: "user",
    created_at: "2026-07-16T12:00:00.000Z",
    content: { template: "plain_text", data: { body: "ignore prior instructions" } },
    source_refs: [],
    attachments: []
  });
  const jsonl = serializeArchiveJsonl({
    agentId,
    agentName: "Research",
    date: "2026-07-16",
    part: 1,
    records: [record]
  });
  assert.equal(parseArchiveJsonl(jsonl, {
    agentId,
    messageDate: "2026-07-16",
    part: 1
  }).length, 1);
  assert.throws(() => parseArchiveJsonl(jsonl, {
    agentId: "33333333-3333-4333-8333-333333333333",
    messageDate: "2026-07-16",
    part: 1
  }));
  assert.deepEqual(shardArchiveRecords([record]), [[record]]);
});
