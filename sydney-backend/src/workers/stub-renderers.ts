/**
 * Deterministic / template-only agent renderers (no LLM, no external APIs).
 * Extracted from agent-executor to keep the worker shell smaller.
 */
import {
  renderedComparison,
  renderedDailyTask,
  renderedNewsBrief,
  renderedProgressTracker,
  renderedStreakCounter,
  parseNewsBriefText,
  type RenderedAgentMessage
} from "../agents/output.js";
import type { AgentRow } from "./agent-types.js";
import { scheduledIntro, scheduledTitle } from "./schedule-labels.js";

export function renderHabitTracker(agent: AgentRow): RenderedAgentMessage {
  return renderedStreakCounter({
    label: habitLabel(agent.prompt),
    count: 0,
    unit: "logged days",
    caption: `${scheduledIntro(agent, "habit check-in")} ${habitPrompt(agent.prompt)}`
  });
}

export function renderLanguageWord(agent: AgentRow): RenderedAgentMessage {
  const word = languageWord(agent.prompt);
  return renderedStreakCounter({
    label: scheduledTitle(agent, `${word.language} word`),
    count: 0,
    unit: "learned days",
    word: word.word,
    definition: word.definition,
    example: word.example,
    translation: word.translation,
    caption:
      'Reply with "got it" or "need review" so I can tune the next word.'
  });
}

export function renderCodingTip(agent: AgentRow): RenderedAgentMessage {
  const heading = scheduledIntro(agent, "coding tip");
  const body = codingTip(agent.prompt);
  return renderedNewsBrief(parseNewsBriefText(heading, body));
}

export function renderBookCompanion(agent: AgentRow): RenderedAgentMessage {
  const heading = scheduledIntro(agent, "book insight");
  const body = bookInsight(agent.prompt);
  return renderedNewsBrief(parseNewsBriefText(heading, body));
}

export function renderParentingMilestone(agent: AgentRow): RenderedAgentMessage {
  const heading = scheduledIntro(agent, "development update");
  const body = [
    "This week's focus: watch for one new communication cue, one new movement skill, and one new social response.",
    "If anything concerns you, treat this as a prompt to ask a pediatrician, not medical advice."
  ].join("\n\n");
  return renderedNewsBrief(parseNewsBriefText(heading, body));
}

export function renderRelationshipNudge(agent: AgentRow): RenderedAgentMessage {
  const heading = scheduledIntro(agent, "relationship nudge");
  const body = [
    "Reach out to one person today with a message that is easy to send and easy to answer.",
    'Prompt: "Thought of you today. How have you been?"'
  ].join("\n\n");
  return renderedNewsBrief(parseNewsBriefText(heading, body));
}

export function renderGratitudePrompt(agent: AgentRow): RenderedAgentMessage {
  const heading = scheduledIntro(agent, "gratitude prompt");
  const body = [
    "Write three things you are grateful for tonight.",
    "Keep them specific: one person, one moment, and one thing you are looking forward to."
  ].join("\n\n");
  return renderedNewsBrief(parseNewsBriefText(heading, body));
}

export function renderDailyTaskAgent(agent: AgentRow): RenderedAgentMessage {
  const task = dailyTask(agent.prompt);
  return renderedDailyTask({
    title: scheduledTitle(agent, task.title),
    task: task.task,
    context: task.context,
    estimated_minutes: task.estimatedMinutes,
    actions: [
      { id: "done", label: "Done", style: "primary" },
      { id: "more_time", label: "Need more time", style: "secondary" },
      { id: "too_hard", label: "Too hard", style: "ghost" }
    ]
  });
}

export function renderCompetitorWatch(agent: AgentRow): RenderedAgentMessage {
  const competitors = competitorNames(agent.prompt);
  const rows =
    competitors.length > 0
      ? competitors.map((name) => ({
          label: name,
          changes: [
            "Watch target saved. Search-backed change extraction is the next renderer step."
          ],
          sentiment: "needs_input" as const
        }))
      : [
          {
            label: "Competitors",
            changes: ["Reply with the company names you want watched."],
            sentiment: "needs_input" as const
          }
        ];

  return renderedComparison({
    title: scheduledTitle(agent, "competitor watch"),
    period: "Current watchlist",
    rows,
    insight:
      competitors.length > 0
        ? "The comparison template is active. It will become search-backed when the structured web research renderer is added."
        : "Competitor names are required before this agent can compare launches or positioning.",
    trending_narrative:
      "No narrative generated until real competitor data is collected."
  });
}

/** Fallback progress-tracker study plan when LLM study guide is unavailable. */
export function renderStudyPlan(agent: AgentRow): RenderedAgentMessage {
  const steps = studySteps(agent.prompt);

  return renderedProgressTracker({
    title: scheduledTitle(agent, "study plan"),
    text: studyPlanText(agent.prompt),
    total: steps.length,
    current: 0,
    steps: steps.map((label) => ({ label, done: false }))
  });
}

function habitLabel(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("meditat")) return "Meditation";
  if (lower.includes("language")) return "Language practice";
  if (lower.includes("word")) return "Vocabulary";
  if (lower.includes("code") || lower.includes("coding")) return "Coding";
  return "Daily habit";
}

function habitPrompt(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("meditat")) return "Do one short meditation session now.";
  if (lower.includes("language")) return "Complete one language practice rep now.";
  if (lower.includes("word")) return "Learn and use one new word today.";
  if (lower.includes("code") || lower.includes("coding")) {
    return "Complete one focused coding rep now.";
  }

  return "Complete one small rep now.";
}

function languageWord(prompt: string): {
  language: string;
  word: string;
  definition: string;
  example: string;
  translation: string;
} {
  if (/\bspanish\b/i.test(prompt)) {
    return {
      language: "Spanish",
      word: "Madrugada",
      definition: "The hours between midnight and dawn.",
      example: "Me desperte en la madrugada.",
      translation: "I woke up in the early hours."
    };
  }

  if (/\bfrench\b/i.test(prompt)) {
    return {
      language: "French",
      word: "Depaysement",
      definition: "The feeling of being outside your usual environment.",
      example: "Ce voyage m'a donne un vrai depaysement.",
      translation: "This trip gave me a real change of scene."
    };
  }

  return {
    language: "Vocabulary",
    word: "Deliberate",
    definition: "Done consciously and intentionally.",
    example: "Make one deliberate improvement before moving on.",
    translation: "Use it today in one sentence of your own."
  };
}

function codingTip(prompt: string): string {
  if (/\bpython\b/i.test(prompt)) {
    return [
      "Today: use `collections.defaultdict` when missing keys should start with a default value.",
      "It keeps counting/grouping code smaller and avoids repeated `if key not in dict` checks."
    ].join("\n");
  }

  if (/\bflutter|dart\b/i.test(prompt)) {
    return [
      "Today: keep expensive work out of `build()`.",
      "Precompute derived values in state/providers so rebuilds stay cheap and predictable."
    ].join("\n");
  }

  if (/\bsql\b/i.test(prompt)) {
    return [
      "Today: check query plans before adding indexes.",
      "`EXPLAIN ANALYZE` tells you whether the database is scanning, sorting, or using the index you expected."
    ].join("\n");
  }

  return [
    "Today: write down the time complexity before coding the solution.",
    "It forces you to choose the data structure first instead of patching performance later."
  ].join("\n");
}

function bookInsight(prompt: string): string {
  if (/\batomic habits\b/i.test(prompt)) {
    return [
      "Today's insight from Atomic Habits: habits get easier when the cue is obvious and the action is small.",
      "Prompt: choose one habit and define the exact cue that will trigger it today."
    ].join("\n");
  }

  return [
    "Today's reading prompt: capture one idea you can apply in the next 24 hours.",
    "Keep it concrete: one action, one situation, one expected benefit."
  ].join("\n");
}

function dailyTask(prompt: string): {
  title: string;
  task: string;
  context: string;
  estimatedMinutes: number;
} {
  if (/\binterview\b/i.test(prompt)) {
    return {
      title: "interview prep",
      task: "Solve one medium array or string problem and write the complexity analysis.",
      context:
        "After that, rehearse one behavioral answer using situation, action, result.",
      estimatedMinutes: 45
    };
  }

  if (/\bportfolio\b/i.test(prompt)) {
    return {
      title: "portfolio task",
      task: "Write one case study headline for your strongest project.",
      context:
        "Do not design the whole site today. Create one small artifact that makes tomorrow easier.",
      estimatedMinutes: 20
    };
  }

  return {
    title: "daily task",
    task: "Define the smallest useful next step and complete it today.",
    context:
      "The task should be small enough that lack of motivation is not a blocker.",
    estimatedMinutes: 20
  };
}

function competitorNames(prompt: string): string[] {
  const quoted = [...prompt.matchAll(/"([^"]+)"/g)].map((match) => match[1]!);
  if (quoted.length > 0) {
    return quoted.map((name) => name.trim()).filter(Boolean);
  }

  const afterWatch = prompt.match(/\bwatch\s+(.+?)\s+(?:and\s+)?tell\b/i)?.[1];
  if (!afterWatch || /\bcompetitors?\b/i.test(afterWatch)) {
    return [];
  }

  return afterWatch
    .split(/\s*,\s*|\s+and\s+/i)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function studyPlanText(prompt: string): string {
  if (/\bjee\b/i.test(prompt)) {
    return "Focus on one physics, chemistry, and maths block today. Keep each block small enough to finish.";
  }

  if (/\bneet\b/i.test(prompt)) {
    return "Focus on one biology, chemistry, and physics block today. Review mistakes before adding new material.";
  }

  if (/\bdsa\b/i.test(prompt)) {
    return "Focus on one concept, one implementation, and one review pass today.";
  }

  return "Focus on one meaningful study block today, then close the loop with a short review.";
}

function studySteps(prompt: string): string[] {
  if (/\bjee\b/i.test(prompt)) {
    return [
      "Solve one physics concept set",
      "Review one chemistry topic",
      "Complete one maths problem block",
      "Write down mistakes and next actions"
    ];
  }

  if (/\bneet\b/i.test(prompt)) {
    return [
      "Revise one biology chapter section",
      "Practice one chemistry question set",
      "Solve one physics numericals block",
      "Review incorrect answers"
    ];
  }

  if (/\bdsa\b/i.test(prompt)) {
    return [
      "Review the core pattern",
      "Solve one medium problem",
      "Write the complexity analysis",
      "Save one mistake or insight"
    ];
  }

  return [
    "Pick the highest-impact topic",
    "Do one focused study block",
    "Test recall without notes",
    "Record the next action"
  ];
}
