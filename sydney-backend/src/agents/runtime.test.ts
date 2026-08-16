import assert from "node:assert/strict";
import test from "node:test";
import { parseIntent } from "./parser.js";
import {
  agentConfigurationView,
  compileAgentDefinition,
  definitionToParsedIntent,
  validateCompiledDefinition
} from "./runtime/compiler.js";
import { executeAgentDefinition } from "./runtime/universal-executor.js";
import {
  normalizeAndValidateOutput,
  outputStateEffects,
  scheduledOutputContractIds
} from "./runtime/output-registry.js";
import {
  normalizeRuntimeState,
  reduceAgentRuntimeState
} from "./runtime/state-store.js";
import { shouldTriggerAgentDefinition } from "../events/engine.js";

test("recipes compile to finite capabilities and compatibility is derived", () => {
  const cases = [
    ["Send me tech news every day at 7am", "news.research"],
    ["Give me one DSA problem every day", "dsa.generate"],
    ["Summarize Gmail every evening", "connector.digest"],
    ["Find content ideas for Reddit every day", "content.ideas"],
    [
      "Create a daily executive briefing from email, calendar, and Slack",
      "briefing.compose"
    ],
    ["Remind me to stretch every day", "reminder.deliver"],
    ["Track TCS and INFY every day", "portfolio.watch"]
  ] as const;

  for (const [prompt, capability] of cases) {
    const parsed = parseIntent(prompt);
    const definition = compileAgentDefinition(parsed, prompt);
    assert.equal(definition.steps.length, 1);
    assert.equal(definition.steps[0]!.capability, capability);
    const compatibility = definitionToParsedIntent(definition, {
      name: parsed.name,
      avatar: parsed.avatar,
      runtimeState: { history: { "2026-07-17": true } }
    });
    assert.equal(compatibility.intent, parsed.intent);
    assert.deepEqual(compatibility.history, { "2026-07-17": true });
  }
});

test("subreddit prompts persist the same draft platform used at runtime", () => {
  const prompt =
    "Create content drafts for r/gaming about gaming topics every morning.";
  const parsed = parseIntent(prompt);
  const definition = compileAgentDefinition(parsed, prompt);
  const compatibility = definitionToParsedIntent(definition, {
    name: parsed.name,
    avatar: parsed.avatar
  });

  assert.equal(parsed.recipe_inputs?.platform, "reddit");
  assert.equal(definition.interaction.draft_platform, "reddit");
  assert.equal(compatibility.draft_platform, "reddit");
});

test("registered capability safety cannot be raised by a definition", () => {
  const prompt = "Send me tech news every day at 7am";
  const definition = compileAgentDefinition(parseIntent(prompt), prompt);
  assert.throws(
    () =>
      validateCompiledDefinition({
        ...definition,
        policy: { ...definition.policy, safety_level: "act" }
      }),
    /cannot run at safety level/
  );
  assert.throws(
    () =>
      validateCompiledDefinition({
        ...definition,
        steps: [
          {
            ...definition.steps[0],
            capability: "invented.tool"
          }
        ]
      }),
    /Unsupported capability/
  );
});

test("static recipes reject realtime triggers and advertise schedule-only support", () => {
  const prompt = "Summarize Gmail every evening";
  const parsed = parseIntent(prompt);
  assert.throws(
    () =>
      compileAgentDefinition(
        { ...parsed, realtime_enabled: true, schedule_cron: null },
        prompt
      ),
    /Realtime triggers are not supported for email_digest/
  );

  const definition = compileAgentDefinition(parsed, prompt);
  const compatibility = definitionToParsedIntent(definition, {
    name: parsed.name,
    avatar: parsed.avatar
  });
  const view = agentConfigurationView(definition);
  assert.equal(compatibility.supports_realtime, false);
  assert.equal(view.supports_realtime, false);
  assert.deepEqual(view.supported_trigger_types, ["manual", "schedule"]);
});

test("event-backed recipes advertise realtime support", () => {
  const prompt =
    "Alert me immediately when GitHub repository openai/openai-node changes";
  const parsed = parseIntent(prompt);
  const definition = compileAgentDefinition(parsed, prompt);
  const compatibility = definitionToParsedIntent(definition, {
    name: parsed.name,
    avatar: parsed.avatar
  });
  const view = agentConfigurationView(definition);

  assert.equal(compatibility.supports_realtime, true);
  assert.equal(view.supports_realtime, true);
  assert.deepEqual(view.supported_trigger_types, [
    "manual",
    "schedule",
    "event"
  ]);
});

test("universal executor dispatches capability steps, not recipe metadata", async () => {
  const prompt = "Send me tech news every day at 7am";
  const base = compileAgentDefinition(parseIntent(prompt), prompt);
  const definition = {
    ...base,
    metadata: { recipe_id: "gratitude_prompt" as const }
  };
  const invoked: string[] = [];
  const result = await executeAgentDefinition({
    definition,
    invokeAdapter: async (capability) => {
      invoked.push(capability);
      return {
        content: {
          template: "news_brief",
          version: "1.0",
          data: {
            title: "Tech news",
            items: [{ summary: "A registered output." }]
          }
        },
        sourceRefs: [],
        tokensUsed: 0
      };
    }
  });
  assert.deepEqual(invoked, ["news.research"]);
  assert.equal((result.content as { template: string }).template, "news_brief");
});

test("all fourteen scheduled output contracts validate through one registry", () => {
  const fixtures: Record<string, Record<string, unknown>> = {
    plain_text: { body: "Hello" },
    data_summary: { title: "Summary" },
    urgency_list: { title: "Urgent", items: [] },
    progress_tracker: {
      title: "Progress",
      text: "On track",
      total: 1,
      current: 0,
      steps: []
    },
    checklist: { title: "Checklist", items: [] },
    daily_task: {
      title: "Task",
      task: "Do it",
      actions: [
        { id: "done", label: "Done", style: "primary" },
        { id: "snooze", label: "Need more time", style: "secondary" },
        { id: "skip", label: "Too hard", style: "ghost" }
      ]
    },
    streak_counter: { label: "Streak", count: 0, unit: "days" },
    comparison: { title: "Compare", rows: [] },
    news_brief: { title: "News", items: [] },
    study_guide: {
      topic: "Topic",
      definition: "Definition",
      references: [],
      completed: false,
      actions: [],
      initiallyCollapsed: true
    },
    dsa_question: {
      title: "Question",
      difficulty: "Easy",
      problem: "Solve it",
      examples: [],
      references: [],
      completed: false,
      actions: []
    },
    content_extractor: { ideas: [] },
    portfolio_watch: {
      title: "Portfolio",
      text: "No changes",
      stocks: [],
      footer: "Close"
    },
    briefing_card: {
      eyebrow: "Today",
      title: "Briefing",
      summary: "All clear",
      sections: []
    },
    all_clear: {
      message: "Nothing in your inbox needs your attention right now."
    }
  };
  assert.equal(scheduledOutputContractIds.length, 15);
  for (const contract of scheduledOutputContractIds) {
    const content = normalizeAndValidateOutput({
      template: contract,
      version: "1.0",
      data: fixtures[contract]
    });
    assert.equal(content.template, contract);
  }
  const study = normalizeAndValidateOutput({
    template: "study_guide",
    version: "1.0",
    data: fixtures.study_guide
  });
  assert.equal((study.data as any).initially_collapsed, true);
  assert.equal("initiallyCollapsed" in (study.data as any), false);
});

test("optional 1.0 output extensions validate without changing old payloads", () => {
  const extended = {
    news_brief: {
      title: "News",
      tldr: ["One", "Two", "Three"],
      items: [{ headline: "Lead", summary: "Grounded summary." }],
      perspectives: [{ label: "View", summary: "Supported position." }],
      why_it_matters: "Material context.",
      timeline: [{ date: "Today", event: "Lead event" }]
    },
    data_summary: {
      title: "Inbox",
      action_items: [
        "Reply to Ada",
        { label: "Review invoice", priority: "high" }
      ]
    },
    content_extractor: {
      ideas: [
        {
          title: "Idea",
          hook: "Hook",
          angle: "Angle",
          audience_value: "Useful",
          evidence_summary: "Supported by a current source."
        }
      ]
    },
    briefing_card: {
      eyebrow: "Today",
      title: "Briefing",
      summary: "Summary",
      sections: [],
      priorities: [{ title: "Reply", source: "Gmail" }],
      cross_source_insights: ["The meeting and email concern the same launch."],
      conflicts: [{ topic: "Deadline", detail: "Two dates are present." }]
    },
    portfolio_watch: {
      title: "Portfolio",
      text: "Prices checked.",
      stocks: [],
      footer: "Source",
      material_events: [
        {
          ticker: "TCS",
          category: "earnings",
          headline: "Results published"
        }
      ],
      drivers: ["Earnings evidence"],
      as_of: "2026-07-17T12:00:00.000Z",
      data_quality: { status: "partial", detail: "One symbol unavailable." }
    }
  } as const;
  for (const [template, data] of Object.entries(extended)) {
    assert.equal(
      normalizeAndValidateOutput({
        template,
        version: "1.0",
        data
      }).template,
      template
    );
  }
});

test("trusted output actions produce bounded runtime state events", () => {
  const content = {
    template: "study_guide",
    data: {
      topic: "Graphs",
      definition: "Definition",
      references: [],
      completed: false,
      actions: []
    }
  };
  const events = outputStateEffects({
    content,
    action: "skip",
    date: "2026-07-17"
  });
  const next = reduceAgentRuntimeState(
    {
      history: {},
      topics_covered: ["Arrays", "Graphs"],
      current_chunk: 2
    },
    events as any
  );
  assert.deepEqual(next, {
    history: { "2026-07-17": false },
    topics_covered: ["Arrays"],
    current_chunk: 2
  });
  assert.deepEqual(normalizeRuntimeState({}), {
    history: {},
    topics_covered: [],
    current_chunk: 0
  });
});

test("event definitions use trigger source and capability matcher", () => {
  const prompt =
    "Alert me immediately when GitHub repository openai/openai-node changes";
  const definition = compileAgentDefinition(parseIntent(prompt), prompt);
  assert.equal(definition.trigger.type, "event");
  assert.equal(
    shouldTriggerAgentDefinition(definition, {
      source: "github",
      eventType: "github.push",
      payload: { repository: "openai/openai-node" }
    }),
    true
  );
  assert.equal(
    shouldTriggerAgentDefinition(definition, {
      source: "github",
      eventType: "github.push",
      payload: { repository: "other/repo" }
    }),
    false
  );
});
