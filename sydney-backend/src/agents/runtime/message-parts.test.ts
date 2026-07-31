import assert from "node:assert/strict";
import test from "node:test";
import type { AgentMessageContent } from "../output.js";
import {
  mergeAgentMessageContents,
  splitAgentMessageContent
} from "./message-parts.js";

test("splits enriched news into TLDR, details, and context messages", () => {
  const content: AgentMessageContent = {
    template: "news_brief",
    version: "1.0",
    data: {
      title: "AI news",
      initialItemCount: 5,
      tldr: [
        "Model releases accelerated across the industry.",
        "Regulators published new implementation guidance.",
        "Enterprise buyers prioritised reliability and cost."
      ],
      items: Array.from({ length: 5 }, (_, index) => ({
        headline: `Story ${index + 1}`,
        summary: `${"Grounded detail ".repeat(45)}${index + 1}`,
        category: "technology",
        source: `Source ${index + 1}`,
        url: `https://example.com/story-${index + 1}`
      })),
      perspectives: [
        {
          label: "Industry",
          summary: "Builders welcomed lower serving costs.",
          source: "Industry source",
          url: "https://example.com/industry"
        }
      ],
      why_it_matters:
        "The combined changes affect cost, access, and product planning.",
      timeline: [
        { date: "2026-07-18", event: "The lead model was announced." }
      ]
    }
  };

  const parts = splitAgentMessageContent(content, "run-news");
  assert.equal(parts.length, 3);
  assert.deepEqual(
    parts.map((part) => part.presentation),
    [
      { group_id: "run-news", part_index: 0, part_count: 3 },
      { group_id: "run-news", part_index: 1, part_count: 3 },
      { group_id: "run-news", part_index: 2, part_count: 3 }
    ]
  );
  assert.equal(parts[0]!.template, "news_brief");
  assert.equal(parts[1]!.template, "news_brief");
  assert.equal(parts[2]!.template, "news_brief");
  if (
    parts[0]!.template !== "news_brief" ||
    parts[1]!.template !== "news_brief" ||
    parts[2]!.template !== "news_brief"
  ) {
    return;
  }
  assert.equal(parts[0]!.data.items.length, 0);
  assert.equal(parts[0]!.data.tldr?.length, 3);
  assert.equal(parts[0]!.data.why_it_matters, undefined);
  assert.equal(parts[1]!.data.items.length, 5);
  assert.equal(parts[1]!.data.tldr, undefined);
  assert.equal(parts[1]!.data.why_it_matters, undefined);
  assert.match(parts[1]!.data.title, /Detailed coverage$/);
  assert.equal(parts[2]!.data.items.length, 0);
  assert.equal(parts[2]!.data.why_it_matters, content.data.why_it_matters);
  assert.equal(parts[2]!.data.perspectives?.length, 1);
  assert.equal(parts[2]!.data.timeline?.length, 1);
  assert.match(parts[2]!.data.title, /Context and timeline$/);

  const merged = mergeAgentMessageContents(parts);
  assert.deepEqual(merged, content);
});

test("keeps news at two messages when no context sections exist", () => {
  const content: AgentMessageContent = {
    template: "news_brief",
    version: "1.0",
    data: {
      title: "Product news",
      tldr: ["Two launches led the day."],
      items: [
        { headline: "Launch one", summary: "The first product shipped." },
        { headline: "Launch two", summary: "The second product shipped." }
      ]
    }
  };

  const parts = splitAgentMessageContent(content, "run-news-compact");
  assert.equal(parts.length, 2);
  assert.deepEqual(
    parts.map((part) => part.presentation?.part_count),
    [2, 2]
  );
  assert.deepEqual(mergeAgentMessageContents(parts), content);
});

test("keeps compact and interactive outputs as one message", () => {
  const compact: AgentMessageContent = {
    template: "plain_text",
    version: "1.0",
    data: { body: "A short update." }
  };
  const interactive: AgentMessageContent = {
    template: "daily_task",
    version: "1.0",
    data: {
      title: "Reminder",
      task: "Review the migration",
      actions: [
        { id: "done", label: "Done" },
        { id: "snooze", label: "Snooze" },
        { id: "skip", label: "Skip" }
      ]
    }
  };

  assert.deepEqual(splitAgentMessageContent(compact, "run-short"), [compact]);
  assert.deepEqual(splitAgentMessageContent(interactive, "run-task"), [
    interactive
  ]);
});

test("splits connector digests without duplicating actions or changing order", () => {
  const content: AgentMessageContent = {
    template: "data_summary",
    version: "1.0",
    data: {
      title: "Mailbox priorities",
      kind: "gmail_digest",
      summary: "Two replies and a payment deadline need attention.",
      metrics: [{ label: "REVIEWED", value: "12" }],
      messages: Array.from({ length: 9 }, (_, index) => ({
        id: `message-${index + 1}`,
        subject: `Subject ${index + 1}`,
        sender: `sender-${index + 1}@example.com`,
        category: index < 2 ? "reply" : "update",
        preview: "Relevant message context ".repeat(18)
      })),
      action_items: [
        { label: "Reply to the finance team", priority: "urgent" }
      ],
      footer: "Generated from the connected mailbox."
    }
  };

  const parts = splitAgentMessageContent(content, "run-mail");
  assert.equal(parts.length, 3);
  const actionCopies = parts.filter(
    (part) =>
      part.template === "data_summary" &&
      (part.data.action_items?.length ?? 0) > 0
  );
  assert.equal(actionCopies.length, 1);
  assert.deepEqual(mergeAgentMessageContents(parts), content);
});

test("preserves content idea numbering offsets across two parts", () => {
  const content: AgentMessageContent = {
    template: "content_extractor",
    version: "1.0",
    data: {
      ideas: Array.from({ length: 3 }, (_, index) => ({
        title: `Idea ${index + 1}`,
        hook: "A useful hook ".repeat(45),
        angle: "A distinct, evidence-backed angle.",
        audience_value: "A practical takeaway for the target audience.",
        evidence_summary: "Recent sources support the proposed framing."
      }))
    }
  };

  const parts = splitAgentMessageContent(content, "run-content");
  assert.equal(parts.length, 2);
  assert.equal(parts[0]!.presentation?.item_offset, 0);
  assert.equal(parts[1]!.presentation?.item_offset, 2);
  assert.deepEqual(mergeAgentMessageContents(parts), content);
});

test("caps long plain text at three parts and reconstructs its meaning", () => {
  const paragraphs = Array.from(
    { length: 12 },
    (_, index) =>
      `Section ${index + 1}. ${"This is a complete sentence with useful report detail. ".repeat(12).trim()}`
  );
  const content: AgentMessageContent = {
    template: "plain_text",
    version: "1.0",
    data: { headline: "Research report", body: paragraphs.join("\n\n") }
  };

  const parts = splitAgentMessageContent(content, "run-report");
  assert.equal(parts.length, 3);
  assert.equal(parts.every((part) => part.presentation?.part_count === 3), true);
  assert.deepEqual(mergeAgentMessageContents(parts), content);
});

test("splits structureless custom-report text without requiring domain fields", () => {
  const content: AgentMessageContent = {
    template: "plain_text",
    version: "1.0",
    data: {
      body: Array.from(
        { length: 1_100 },
        (_, index) => `custom-value-${index + 1}`
      ).join(" ")
    }
  };

  const parts = splitAgentMessageContent(content, "run-custom");
  assert.equal(parts.length, 3);
  assert.equal(
    parts.every(
      (part) =>
        part.template === "plain_text" &&
        part.data.body.length > 0 &&
        part.presentation?.group_id === "run-custom"
    ),
    true
  );

  const merged = mergeAgentMessageContents(parts);
  assert.equal(merged?.template, "plain_text");
  if (merged?.template !== "plain_text") return;
  assert.equal(
    merged.data.body.replace(/\s+/g, " ").trim(),
    content.data.body
  );
});

test("splits briefing sections and reconstructs cross-source synthesis", () => {
  const content: AgentMessageContent = {
    template: "briefing_card",
    version: "1.0",
    data: {
      eyebrow: "MORNING BRIEFING",
      title: "What needs attention",
      summary: "Several connected sources contain related deadlines.",
      priorities: ["Reply to finance", "Review the release blocker"],
      sections: Array.from({ length: 3 }, (_, sectionIndex) => ({
        id: `source-${sectionIndex + 1}`,
        title: `Source ${sectionIndex + 1}`,
        source: `Connector ${sectionIndex + 1}`,
        items: Array.from({ length: 4 }, (_, itemIndex) => ({
          title: `Item ${sectionIndex + 1}.${itemIndex + 1}`,
          detail: "Detailed source context ".repeat(24)
        }))
      })),
      cross_source_insights: ["The finance and release deadlines overlap."],
      conflicts: [
        {
          topic: "Release date",
          detail: "Calendar and repository dates disagree."
        }
      ]
    }
  };

  const parts = splitAgentMessageContent(content, "run-briefing");
  assert.equal(parts.length, 3);
  assert.deepEqual(mergeAgentMessageContents(parts), content);
});

test("keeps GitHub activity with up to 5 repository updates in a single unsplit message card", () => {
  const content: AgentMessageContent = {
    template: "data_summary",
    version: "1.0",
    data: {
      title: "GitHub activity",
      kind: "github_activity",
      summary: "Detailed synthesis narrative ".repeat(100),
      metrics: [
        { label: "Repositories", value: "5" },
        { label: "Open issues", value: "0" }
      ],
      timeline: Array.from({ length: 5 }, (_, index) => ({
        title: `Commit pushed ${index + 1}`,
        repository: `user/repo-${index + 1}`,
        timestamp: "2026-07-31T10:00:00Z"
      }))
    }
  };

  const parts = splitAgentMessageContent(content, "run-github");
  assert.equal(parts.length, 1);
});
