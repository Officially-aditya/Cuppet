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
  const prompts = habitPrompts(agent.prompt);
  return renderedStreakCounter({
    label: habitLabel(agent.prompt),
    count: 0,
    unit: "logged days",
    caption: `${scheduledIntro(agent, "habit check-in")} ${pick(agent, prompts)}`
  });
}

export function renderLanguageWord(agent: AgentRow): RenderedAgentMessage {
  const word = languageWord(agent.prompt, historyIndex(agent));
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
  const body = codingTip(agent.prompt, historyIndex(agent));
  return renderedNewsBrief(parseNewsBriefText(heading, body));
}

export function renderBookCompanion(agent: AgentRow): RenderedAgentMessage {
  const heading = scheduledIntro(agent, "book insight");
  const body = bookInsight(agent.prompt, historyIndex(agent));
  return renderedNewsBrief(parseNewsBriefText(heading, body));
}

export function renderParentingMilestone(agent: AgentRow): RenderedAgentMessage {
  const heading = scheduledIntro(agent, "development update");
  const body = pick(agent, [
    "This week's focus: watch for one new communication cue, one new movement skill, and one new social response.\n\nIf anything concerns you, ask a pediatrician; this is not medical advice.",
    "Try ten minutes of child-led play and notice what holds their attention.\n\nThis is a reflection prompt, not a developmental assessment.",
    "Read one familiar story and pause for a point, sound, gesture, or repeated phrase.\n\nAdapt the activity to the child's age and comfort.",
    "Notice one routine the child can join with a little less help this week.\n\nAsk a pediatrician about any concern."
  ]);
  return renderedNewsBrief(parseNewsBriefText(heading, body));
}

export function renderRelationshipNudge(agent: AgentRow): RenderedAgentMessage {
  const heading = scheduledIntro(agent, "relationship nudge");
  const body = pick(agent, [
    'Reach out to one person today with a message that is easy to answer.\n\nPrompt: "Thought of you today. How have you been?"',
    'Send a specific memory instead of a generic hello.\n\nPrompt: "I remembered our conversation about ___. How is that going?"',
    'Offer one low-pressure plan.\n\nPrompt: "Want to catch up for 15 minutes sometime this week?"',
    'Thank someone for a small thing.\n\nPrompt: "I appreciated ___. It made a difference."'
  ]);
  return renderedNewsBrief(parseNewsBriefText(heading, body));
}

export function renderGratitudePrompt(agent: AgentRow): RenderedAgentMessage {
  const heading = scheduledIntro(agent, "gratitude prompt");
  const body = pick(agent, [
    "Write three specific things you are grateful for: one person, one moment, and one thing you anticipate.",
    "Name one ordinary convenience you noticed today and why it helped.",
    "Recall one moment when someone made your day easier. Write the exact detail.",
    "Write about one challenge that taught you something useful without pretending the challenge was good."
  ]);
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
      { id: "snooze", label: "Need more time", style: "secondary" },
      { id: "skip", label: "Too hard", style: "ghost" }
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

function habitPrompts(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  if (lower.includes("meditat")) {
    return [
      "Do one short meditation session now.",
      "Count ten slow breaths.",
      "Notice sound, breath, and body sensation for three minutes.",
      "Attach a short meditation to the next routine transition."
    ];
  }
  if (lower.includes("language") || lower.includes("word")) {
    return [
      "Complete one language practice rep now.",
      "Use yesterday's word in a new sentence.",
      "Listen to one short phrase and repeat it.",
      "Review five cards, then stop."
    ];
  }
  if (lower.includes("code") || lower.includes("coding")) {
    return [
      "Complete one focused coding rep now.",
      "Open the project and fix one small warning.",
      "Write one failing test for the next behavior.",
      "Read one function and improve one name."
    ];
  }

  return [
    "Complete one small rep now.",
    "Prepare the first tool for the habit.",
    "Do the two-minute version today.",
    "Attach one small rep to a routine you already do."
  ];
}

function languageWord(prompt: string, index: number): {
  language: string;
  word: string;
  definition: string;
  example: string;
  translation: string;
} {
  type Word = {
    language: string;
    word: string;
    definition: string;
    example: string;
    translation: string;
  };
  let words: Word[];
  if (/\bspanish\b/i.test(prompt)) {
    words = [
      {
        language: "Spanish",
        word: "Madrugada",
        definition: "The hours between midnight and dawn.",
        example: "Me desperte en la madrugada.",
        translation: "I woke up in the early hours."
      },
      {
        language: "Spanish",
        word: "Aprovechar",
        definition: "To make good use of an opportunity or resource.",
        example: "Voy a aprovechar la manana para estudiar.",
        translation: "I will make use of the morning to study."
      },
      {
        language: "Spanish",
        word: "Sobremesa",
        definition: "Time spent talking at the table after a meal.",
        example: "La sobremesa duro una hora.",
        translation: "The after-meal conversation lasted an hour."
      }
    ];
  } else if (/\bfrench\b/i.test(prompt)) {
    words = [
      {
        language: "French",
        word: "Depaysement",
        definition: "The feeling of being outside your usual environment.",
        example: "Ce voyage m'a donne un vrai depaysement.",
        translation: "This trip gave me a real change of scene."
      },
      {
        language: "French",
        word: "Retrouvailles",
        definition: "The happiness of meeting again after time apart.",
        example: "Leurs retrouvailles etaient chaleureuses.",
        translation: "Their reunion was warm."
      },
      {
        language: "French",
        word: "Flaner",
        definition: "To stroll without hurry or a fixed destination.",
        example: "Nous aimons flaner dans le quartier.",
        translation: "We like to stroll around the neighborhood."
      }
    ];
  } else {
    words = [
      {
        language: "Vocabulary",
        word: "Deliberate",
        definition: "Done consciously and intentionally.",
        example: "Make one deliberate improvement before moving on.",
        translation: "Use it today in one sentence of your own."
      },
      {
        language: "Vocabulary",
        word: "Nuance",
        definition: "A subtle difference in meaning or expression.",
        example: "The summary preserved the nuance of both viewpoints.",
        translation: "Use it to describe a subtle distinction."
      },
      {
        language: "Vocabulary",
        word: "Pragmatic",
        definition: "Focused on practical results and real conditions.",
        example: "They chose a pragmatic first step.",
        translation: "Use it when discussing a workable choice."
      }
    ];
  }
  return words[index % words.length]!;
}

function codingTip(prompt: string, index: number): string {
  let tips: string[];
  if (/\bpython\b/i.test(prompt)) {
    tips = [
      "Use `collections.defaultdict` when missing keys should start with a default value. It avoids repeated key checks.",
      "Use a context manager for files and locks so cleanup is deterministic after exceptions.",
      "Prefer `enumerate()` when you need both an item and its index.",
      "Use immutable tuples or frozen dataclasses for values that should not change."
    ];
  } else if (/\bflutter|dart\b/i.test(prompt)) {
    tips = [
      "Keep expensive work out of `build()`. Precompute derived values so rebuilds stay cheap.",
      "Give list children stable keys when identity matters.",
      "Cancel subscriptions and controllers in `dispose()`.",
      "Use `const` widgets for stable immutable subtrees."
    ];
  } else if (/\bsql\b/i.test(prompt)) {
    tips = [
      "Check query plans before adding indexes. `EXPLAIN ANALYZE` shows where time is spent.",
      "Index for the query's filter and sort pattern, not each column in isolation.",
      "Use explicit, short transactions for multi-step state changes.",
      "Test nullable predicates carefully because `NULL` uses three-valued logic."
    ];
  } else {
    tips = [
      "Write down the time complexity before coding the solution.",
      "Write one boundary-case test before the happy path.",
      "Make invalid states unrepresentable when the type system allows it.",
      "Log identifiers and outcomes, not secrets or whole payloads."
    ];
  }
  return `Today: ${tips[index % tips.length]!}`;
}

function bookInsight(prompt: string, index: number): string {
  let insights: string[];
  if (/\batomic habits\b/i.test(prompt)) {
    insights = [
      "Habits get easier when the cue is obvious and the action is small.\nPrompt: define the exact cue for one habit today.",
      "Identity-based habits focus on the person each repetition supports.\nPrompt: finish “I am becoming someone who…”",
      "Environment often beats willpower.\nPrompt: move one useful cue into sight.",
      "Avoid turning one missed day into two.\nPrompt: define the smallest recovery action."
    ];
  } else {
    insights = [
      "Capture one idea you can apply in the next 24 hours: one action, situation, and expected benefit.",
      "Choose one claim from your reading and write what evidence would change your mind.",
      "Explain one chapter idea in three sentences without looking at the book.",
      "Connect one idea from the book to a decision you made this week."
    ];
  }
  return `Today's reading prompt: ${insights[index % insights.length]!}`;
}

function historyIndex(agent: AgentRow): number {
  const parsed = agent.parsed_intent ?? {};
  const history =
    parsed.history && typeof parsed.history === "object"
      ? Object.keys(parsed.history as Record<string, unknown>).length
      : 0;
  const covered = Array.isArray(parsed.topics_covered)
    ? parsed.topics_covered.length
    : 0;
  return history + covered;
}

function pick<T>(agent: AgentRow, values: readonly T[]): T {
  return values[historyIndex(agent) % values.length]!;
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
