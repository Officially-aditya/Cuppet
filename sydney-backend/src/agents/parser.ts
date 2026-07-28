import {
  isDraftOutputPlatformName,
  looksLikeContentDraftPrompt,
  UNSUPPORTED_CONNECTORS
} from "./unsupported-connectors.js";
import { extractGitHubRepository } from "./github-scope.js";
import { listTrustedMcpProviders } from "../access/provider-directory.js";
import {
  getAgentRecipeProfile,
  hasAgentRecipeProfile,
  validateRecipeInputs
} from "./runtime/recipe-registry.js";
import type { AccessRequirement } from "../access/types.js";

export {
  isDraftOutputPlatformName,
  looksLikeContentDraftPrompt
} from "./unsupported-connectors.js";

export interface ParsedIntent {
  name: string;
  avatar: string;
  intent: string;
  connector: string | null;
  connector_ids: string[];
  unsupported_connector: string | null;
  action: string;
  schedule_cron: string | null;
  output_template: string;
  template_config: Record<string, boolean>;
  safety_level: "read" | "suggest" | "act";
  risk_level: "low" | "medium" | "high";
  permissions_needed: string[];
  realtime_enabled?: boolean;
  github_repository?: string;
  response_limit?: "concise" | "balanced" | "detailed";
  active_until?: string;
  recipe_version?: number;
  prompt_profile_version?: number;
  recipe_inputs?: Record<string, unknown>;
  required_access?: AccessRequirement[];
  draft_platform?: "twitter" | "linkedin" | "reddit" | "generic";
}

type CapabilityDefinition = {
  name: string;
  avatar: string;
  intent: string;
  connector: string | null;
  connectorIds?: string[];
  action: string | ((prompt: string) => string);
  defaultSchedule?: string | null;
  outputTemplate: string;
  permissionsNeeded: string[];
  priority?: number;
  match: {
    all?: RegExp[];
    any?: RegExp[];
    allAny?: RegExp[][];
    not?: RegExp[];
  };
};

const CAPABILITIES: CapabilityDefinition[] = [
  {
    name: "Daily Executive Briefing",
    avatar: "layout-dashboard",
    intent: "daily_executive_briefing",
    connector: "gmail",
    connectorIds: ["gmail", "calendar", "slack"],
    action: "Combines today's calendar, important email, and Slack activity into one prioritized briefing.",
    defaultSchedule: "0 7 * * *",
    outputTemplate: "briefing_card",
    permissionsNeeded: ["Gmail read access", "Google Calendar event read access", "Slack message history access"],
    priority: 80,
    match: { any: [/\bexecutive briefing\b/, /\bmorning briefing\b.*\b(?:email|calendar|slack)\b/, /\bdaily briefing\b.*\b(?:email|calendar|slack)\b/] }
  },
  {
    name: "Project Pulse",
    avatar: "activity",
    intent: "project_pulse",
    connector: "github",
    connectorIds: ["github", "slack", "notion", "drive"],
    action: "Combines development, team, documentation, and file activity into a project pulse.",
    defaultSchedule: "0 9 * * 1-5",
    outputTemplate: "briefing_card",
    permissionsNeeded: ["GitHub repository read access", "Slack message history access", "Read selected Notion pages", "Google Drive read access"],
    priority: 79,
    match: { any: [/\bproject pulse\b/, /\bproject health (?:brief|report|update)\b/] }
  },
  {
    name: "Meeting Intelligence",
    avatar: "presentation",
    intent: "meeting_intelligence",
    connector: "calendar",
    connectorIds: ["calendar", "gmail", "drive", "notion"],
    action: "Builds meeting context from the calendar, email, meeting notes, and Notion.",
    defaultSchedule: "0 7 * * 1-5",
    outputTemplate: "briefing_card",
    permissionsNeeded: ["Google Calendar event read access", "Gmail read access", "Google Drive read access", "Read selected Notion pages"],
    priority: 78,
    match: { any: [/\bmeeting intelligence\b/, /\bpre[- ]meeting brief(?:ing)?\b/, /\bmeeting context brief(?:ing)?\b/] }
  },
  {
    name: "Weekly Accomplishment Report",
    avatar: "award",
    intent: "weekly_accomplishment_report",
    connector: "slack",
    connectorIds: ["slack", "github", "drive", "notion"],
    action: "Builds an evidence-based weekly accomplishment report across connected work tools.",
    defaultSchedule: "0 17 * * 5",
    outputTemplate: "briefing_card",
    permissionsNeeded: ["Slack message history access", "GitHub repository read access", "Google Drive read access", "Read selected Notion pages"],
    priority: 77,
    match: { any: [/\bweekly accomplishments?\b/, /\bweekly achievement report\b/, /\bmy week in (?:review|evidence)\b/] }
  },
  {
    name: "GitHub Activity",
    avatar: "github",
    intent: "github_activity_digest",
    connector: "github",
    connectorIds: ["github"],
    action: "Summarizes recently updated repositories, open issues, and pull requests.",
    defaultSchedule: "0 9 * * *",
    outputTemplate: "data_summary",
    permissionsNeeded: ["GitHub profile and repository read access"],
    priority: 65,
    match: {
      any: [
        /\bgithub\b/,
        /\brepos?\b/,
        /\bpull requests?\b/,
        /\brepositor(?:y|ies)\b/,
        /\bprs?\b.*\b(?:review|open|merged|activity|digest)\b/
      ]
    }
  },
  {
    name: "Calendar Agenda",
    avatar: "calendar",
    intent: "calendar_agenda",
    connector: "calendar",
    connectorIds: ["calendar"],
    action: "Reads upcoming Google Calendar events and prepares a concise agenda.",
    defaultSchedule: "0 7 * * *",
    outputTemplate: "data_summary",
    permissionsNeeded: ["Google Calendar event read access"],
    priority: 64,
    match: {
      any: [
        /\bcalendar\b/,
        /\b(?:daily|weekly|today'?s|tomorrow'?s) agenda\b/,
        /\bupcoming (?:meetings|appointments|events)\b/
      ],
      not: [/\b(?:e-?mail|gmail|inbox|mailbox)\b/]
    }
  },
  {
    name: "Notion Workspace Digest",
    avatar: "book-open",
    intent: "notion_workspace_digest",
    connector: "notion",
    connectorIds: ["notion"],
    action:
      "Reads selected Notion pages and summarizes recent workspace changes and relevant notes.",
    defaultSchedule: "0 9 * * *",
    outputTemplate: "data_summary",
    permissionsNeeded: ["Read selected Notion pages"],
    priority: 63,
    match: {
      any: [/\bnotion\b/]
    }
  },
  {
    name: "Competitor Watch",
    avatar: "binoculars",
    intent: "competitor_watch",
    connector: "web_search",
    action:
      "Watches competitors and compares notable product or messaging changes.",
    defaultSchedule: "0 9 * * 1",
    outputTemplate: "comparison",
    permissionsNeeded: ["Web search (no login needed)"],
    priority: 50,
    match: { any: [/\bcompetitors?\b/, /\bcompetitive\s+(?:watch|analysis)\b/] }
  },
  {
    name: "Portfolio Watch",
    avatar: "line-chart",
    intent: "portfolio_watch",
    connector: "web_search",
    action:
      "Summarizes portfolio or market movement when reliable symbols are provided.",
    defaultSchedule: "0 16 * * *",
    outputTemplate: "portfolio_watch",
    permissionsNeeded: ["Web search or market data"],
    priority: 46,
    match: {
      any: [
        /\bstocks?\b/,
        /\bportfolio\b/,
        /\bmarket close\b/,
        /\bholdings?\b/,
        /\bmarket\s+(?:monitor|tracker|watch|movement)\b/,
        /\bfinancial\s+market\b/,
        /\bstock\s+(?:monitor|tracker|watch)\b/
      ]
    }
  },
  {
    name: "Job Market Radar",
    avatar: "briefcase",
    intent: "job_market_radar",
    connector: "web_search",
    action: "Searches for relevant job-market updates or openings.",
    defaultSchedule: "0 8 * * 1",
    outputTemplate: "plain_text",
    permissionsNeeded: ["Web search (no login needed)"],
    priority: 44,
    match: { any: [/\bjob market\b/, /\bjobs?\b/, /\broles?\b/, /\bopenings?\b/] }
  },
  {
    name: "Tech News",
    avatar: "newspaper",
    intent: "tech_news_brief",
    connector: "web_search",
    action: "Searches and summarizes technology news.",
    defaultSchedule: "0 7 * * *",
    outputTemplate: "plain_text",
    permissionsNeeded: ["Web search (no login needed)"],
    priority: 60,
    match: {
      allAny: [[/\btech(?:nology)?\b/], [/\bnews\b/, /\bheadlines?\b/, /\bbrief\b/]]
    }
  },
  {
    name: "News Brief",
    avatar: "newspaper",
    intent: "news_brief",
    connector: "web_search",
    action: "Searches and summarizes current news.",
    defaultSchedule: "0 7 * * *",
    outputTemplate: "plain_text",
    permissionsNeeded: ["Web search (no login needed)"],
    priority: 24,
    match: {
      any: [
        /\bnews\b/,
        /\bheadlines?\b/,
        /\b(?:updates?|brief|digest)\s+(?:about|on)\b/,
        /\bstartup funding\b/
      ]
    }
  },
  {
    name: "Web Search",
    avatar: "search",
    intent: "web_search_agent",
    connector: "web_search",
    action: "Searches the web and summarizes relevant results.",
    defaultSchedule: null,
    outputTemplate: "plain_text",
    permissionsNeeded: ["Web search (no login needed)"],
    priority: 22,
    match: { any: [/\bsearch(?:es|ing)?\b/, /\blook\s+up\b/, /\bresearch\b/, /\bpaper[s]?\b/, /\barxiv\b/] }
  },
  {
    name: "Weekly Progress",
    avatar: "file-check",
    intent: "weekly_progress_report",
    connector: "slack",
    connectorIds: ["slack", "drive"],
    action:
      "Combines Slack activity and Drive changes into a weekly progress report.",
    defaultSchedule: "0 17 * * 5",
    outputTemplate: "plain_text",
    permissionsNeeded: ["Slack message history access", "Google Drive read access"],
    priority: 58,
    match: { any: [/\bweekly progress\b/, /\baccomplished this week\b/] }
  },
  {
    name: "Deadline Watcher",
    avatar: "check-square",
    intent: "project_deadline_watcher",
    connector: "drive",
    connectorIds: ["drive", "gmail"],
    action: "Finds project deadlines and turns them into a weekly checklist.",
    defaultSchedule: "0 8 * * 1",
    outputTemplate: "checklist",
    permissionsNeeded: ["Google Drive read access", "Gmail read access"],
    priority: 57,
    match: { any: [/\bdeadlines?\b/, /\bdue dates?\b/, /\bmilestones?\b/] }
  },
  {
    name: "Travel Sentinel",
    avatar: "map",
    intent: "travel_sentinel",
    connector: "gmail",
    connectorIds: ["gmail"],
    action:
      "Watches travel booking emails and surfaces upcoming travel actions.",
    outputTemplate: "checklist",
    permissionsNeeded: ["Gmail read access"],
    priority: 54,
    match: { any: [/\btravel\b/, /\btrip\b/, /\bflight\b/, /\bhotel\b/, /\bbooking\b/] }
  },
  {
    name: "Invoice Tracker",
    avatar: "receipt",
    intent: "invoice_tracker",
    connector: "gmail",
    connectorIds: ["gmail"],
    action: "Tracks unpaid invoices and flags follow-ups.",
    defaultSchedule: "0 9 * * 1",
    outputTemplate: "urgency_list",
    permissionsNeeded: ["Gmail read access"],
    priority: 56,
    match: { any: [/\binvoices?\b/, /\bunpaid\b/, /\bpayment due\b/] }
  },
  {
    name: "Subscription Auditor",
    avatar: "credit-card",
    intent: "subscription_auditor",
    connector: "gmail",
    connectorIds: ["gmail"],
    action: "Audits subscription receipts and recurring charges.",
    defaultSchedule: "0 9 1 * *",
    outputTemplate: "data_summary",
    permissionsNeeded: ["Gmail read access"],
    priority: 55,
    match: { any: [/\bsubscriptions?\b/, /\brecurring charges?\b/, /\brenewals?\b/] }
  },
  {
    name: "Follow-up Watcher",
    avatar: "mail-warning",
    intent: "email_followup_watcher",
    connector: "gmail",
    connectorIds: ["gmail"],
    action: "Finds outgoing emails that have not received replies.",
    defaultSchedule: "0 10 * * *",
    outputTemplate: "urgency_list",
    permissionsNeeded: ["Gmail read access"],
    priority: 55,
    match: {
      any: [
        /\bfollow[- ]?ups?\b/,
        /\bhas(?:n't| not) replied\b/,
        /\bhave(?:n't| not) replied\b/
      ]
    }
  },
  {
    name: "Lead Monitor",
    avatar: "radar",
    intent: "lead_response_monitor",
    connector: "gmail",
    connectorIds: ["gmail"],
    action: "Watches Gmail for new lead messages.",
    outputTemplate: "urgency_list",
    permissionsNeeded: ["Gmail read access"],
    priority: 53,
    match: { any: [/\bleads?\b/, /\binquir(?:y|ies)\b/, /\bdemo requests?\b/] }
  },
  {
    name: "Email Digest",
    avatar: "mail",
    intent: "email_digest",
    connector: "gmail",
    connectorIds: ["gmail"],
    action: "Reads Gmail and summarizes messages that need attention.",
    defaultSchedule: "0 18 * * *",
    outputTemplate: "data_summary",
    permissionsNeeded: ["Gmail read access"],
    priority: 35,
    match: {
      allAny: [[/\be-?mail\b/, /\bgmail\b/, /\bmail\b/, /\binbox\b/, /\bmailbox\b/]],
      any: [/\bsummary\b/, /\bsummar(?:y|ize|ise|ization|isation)\b/, /\bdigest\b/, /\brecap\b/, /\bbrief\b/]
    }
  },
  {
    name: "EOD Task Report",
    avatar: "clipboard-list",
    intent: "eod_task_report",
    connector: "slack",
    connectorIds: ["slack"],
    action:
      "Summarizes the user's Slack activity into an end-of-day task report.",
    defaultSchedule: "30 17 * * *",
    outputTemplate: "plain_text",
    permissionsNeeded: ["Slack channel and message history access"],
    priority: 58,
    match: {
      allAny: [[/\bslack\b/], [/\beod\b/, /\bend of day\b/, /\bwhat i did\b/]]
    }
  },
  {
    name: "Slack Watcher",
    avatar: "chat",
    intent: "slack_urgent_watcher",
    connector: "slack",
    connectorIds: ["slack"],
    action: "Watches Slack for urgent messages and mentions.",
    defaultSchedule: null,
    outputTemplate: "urgency_list",
    permissionsNeeded: ["Slack channel and message history access"],
    priority: 57,
    match: { allAny: [[/\bslack\b/], [/\burgent\b/, /\balert\b/]] }
  },
  {
    name: "Slack Digest",
    avatar: "chat",
    intent: "slack_digest",
    connector: "slack",
    connectorIds: ["slack"],
    action: "Reads Slack and summarizes important activity.",
    defaultSchedule: "0 17 * * *",
    outputTemplate: "data_summary",
    permissionsNeeded: ["Slack channel and message history access"],
    priority: 34,
    match: { any: [/\bslack\b/] }
  },
  {
    name: "Meeting Recap",
    avatar: "file-text",
    intent: "meeting_recap",
    connector: "drive",
    connectorIds: ["drive"],
    action:
      "Reads Docs meeting notes and extracts decisions, actions, and key points.",
    defaultSchedule: "0 19 * * *",
    outputTemplate: "plain_text",
    permissionsNeeded: ["Google Drive read access"],
    priority: 50,
    match: { any: [/\bmeeting notes?\b/, /\bdocs?\b/, /\bgoogle docs?\b/] }
  },
  {
    name: "PDF Summary",
    avatar: "file-text",
    intent: "pdf_summary",
    connector: "drive",
    connectorIds: ["drive"],
    action: "Reads Google Drive files and summarizes relevant changes or documents.",
    outputTemplate: "plain_text",
    permissionsNeeded: ["Google Drive read access"],
    priority: 52,
    match: { any: [/\bpdfs?\b/] }
  },
  {
    name: "Drive Summary",
    avatar: "file-text",
    intent: "drive_summary",
    connector: "drive",
    connectorIds: ["drive"],
    action: "Reads Google Drive files and summarizes relevant changes or documents.",
    outputTemplate: "data_summary",
    permissionsNeeded: ["Google Drive read access"],
    priority: 38,
    match: { any: [/\bdrive\b/, /\bgoogle drive\b/] }
  },
  {
    name: "Interview Prep",
    avatar: "target",
    intent: "interview_prep",
    connector: null,
    action: "Creates one interview-prep task per day and tracks completion.",
    defaultSchedule: "0 9 * * *",
    outputTemplate: "daily_task",
    permissionsNeeded: [],
    priority: 44,
    match: { any: [/\binterview prep\b/, /\binterview\b/] }
  },
  {
    name: "Procrastination Breaker",
    avatar: "hammer",
    intent: "procrastination_breaker",
    connector: null,
    action: "Breaks an avoided project into small daily tasks.",
    defaultSchedule: "0 9 * * *",
    outputTemplate: "daily_task",
    permissionsNeeded: [],
    priority: 43,
    match: {
      any: [/\bprocrastinat/, /\bhelp me actually do it\b/, /\bportfolio website\b/, /\bside project\b/, /\bthesis\b/]
    }
  },
  {
    name: "Daily Word",
    avatar: "languages",
    intent: "language_word",
    connector: null,
    action: "Delivers one word per day and tracks the learning habit.",
    defaultSchedule: "0 8 * * *",
    outputTemplate: "streak_counter",
    permissionsNeeded: [],
    priority: 42,
    match: {
      allAny: [[/\bspanish\b/, /\bfrench\b/, /\blanguage\b/, /\bvocabulary\b/, /\bword\b/], [/\bteach\b/, /\bsend\b/, /\blearn\b/, /\bword\b/]]
    }
  },
  {
    name: "Coding Tip",
    avatar: "code",
    intent: "coding_tip",
    connector: null,
    action: "Sends one concrete coding tip on schedule.",
    defaultSchedule: "0 8 * * *",
    outputTemplate: "plain_text",
    permissionsNeeded: [],
    priority: 40,
    match: { any: [/\bcoding tip\b/, /\badvanced .* tip\b/, /\bpython tip\b/, /\bdart tip\b/, /\bsql tip\b/] }
  },
  {
    name: "Book Companion",
    avatar: "book-open",
    intent: "book_companion",
    connector: null,
    action: "Sends one book insight with an application prompt.",
    defaultSchedule: "0 9 * * *",
    outputTemplate: "plain_text",
    permissionsNeeded: [],
    priority: 36,
    match: { any: [/\bbook\b/, /\breading\b/, /\batomic habits\b/] }
  },
  {
    name: "Parenting Milestones",
    avatar: "heart",
    intent: "parenting_milestones",
    connector: null,
    action: "Sends age-appropriate child development prompts.",
    defaultSchedule: "0 9 * * 1",
    outputTemplate: "plain_text",
    permissionsNeeded: [],
    priority: 38,
    match: { any: [/\bbaby\b/, /\bparenting\b/, /\bmilestone\b/, /\bdevelopment\b/] }
  },
  {
    name: "Relationship Nudge",
    avatar: "users",
    intent: "relationship_nudge",
    connector: null,
    action: "Suggests one person to check in with on schedule.",
    defaultSchedule: "0 9 * * 1",
    outputTemplate: "plain_text",
    permissionsNeeded: [],
    priority: 38,
    match: { any: [/\bfriends?\b/, /\brelationship\b/, /\bcheck in\b/, /\blose touch\b/] }
  },
  {
    name: "Gratitude Prompt",
    avatar: "sparkles",
    intent: "gratitude_prompt",
    connector: null,
    action: "Prompts the user to write three specific things they are grateful for.",
    defaultSchedule: "0 21 * * *",
    outputTemplate: "plain_text",
    permissionsNeeded: [],
    priority: 38,
    match: { any: [/\bgratitude\b/, /\bgrateful\b/, /\bjournal\b/] }
  },
  {
    name: "Daily Habit",
    avatar: "flame",
    intent: "habit_tracker",
    connector: null,
    action: "Sends a daily prompt and tracks streak progress.",
    defaultSchedule: "0 8 * * *",
    outputTemplate: "streak_counter",
    permissionsNeeded: [],
    priority: 34,
    match: { any: [/\bhabit\b/, /\bstreak\b/, /\bmeditate\b/] }
  },
  {
    name: "Study Plan",
    avatar: "book-open",
    intent: "study_plan",
    connector: null,
    action: "Creates a study plan and sends daily progress updates.",
    defaultSchedule: "0 8 * * *",
    outputTemplate: "study_guide",
    permissionsNeeded: [],
    priority: 34,
    match: { any: [/\bstudy\b/, /\bjee\b/, /\bneet\b/, /\bexam\b/] }
  },
  {
    name: "DSA Practice",
    avatar: "code",
    intent: "dsa_question",
    connector: null,
    action: "Sends a daily DSA problem with examples, constraints, and hints.",
    defaultSchedule: "0 21 * * *",
    outputTemplate: "dsa_question",
    permissionsNeeded: [],
    priority: 36,
    match: { any: [/\bdsa\b/, /\bdata structures?\s*(?:and|&)\s*algorithms?\b/i, /\bleetcode\b/] }
  },
  {
    name: "Content Extractor",
    avatar: "file-text",
    intent: "content_extractor",
    connector: null,
    action: "Finds latest relevant topics for content creation and generates post drafts.",
    defaultSchedule: "0 9 * * *",
    outputTemplate: "content_extractor",
    permissionsNeeded: [],
    priority: 38,
    match: { any: [/\bcontent\b/, /\bextractor\b/, /\bpost\b/, /\btwitter\b/, /\blinkedin\b/, /\breddit\b/] }
  },
  {
    name: "Reminder",
    avatar: "bell",
    intent: "scheduled_reminder",
    connector: null,
    action: reminderAction,
    defaultSchedule: "0 9 * * *",
    outputTemplate: "plain_text",
    permissionsNeeded: [],
    priority: 32,
    match: { any: [/\bremind\b/, /\breminder\b/, /\bping me\b/] }
  }
];

export function parseIntent(prompt: string): ParsedIntent {
  const parsed = parseIntentLegacy(prompt);
  if (
    parsed.intent === "unsupported_connector" ||
    !hasAgentRecipeProfile(parsed.intent)
  ) {
    return parsed;
  }
  const profile = getAgentRecipeProfile(parsed.intent);
  const defaults = validateRecipeInputs(profile, {});
  const recipeInputs: Record<string, unknown> = {
    ...defaults,
    ...(parsed.schedule_cron && profile.fields.some((field) => field.id === "schedule")
      ? { schedule: parsed.schedule_cron }
      : {})
  };
  if (profile.id === "portfolio_watch") {
    const symbols = stockSymbols(prompt);
    if (symbols.length > 0) recipeInputs.symbols = symbols;
  }
  if (profile.id === "github_activity_digest" && parsed.github_repository) {
    recipeInputs.repository_filters = [parsed.github_repository];
  }
  if (profile.id === "scheduled_reminder") {
    const task = parsed.action
      .replace(/^Reminder:\s*/i, "")
      .replace(/\.$/, "")
      .trim();
    if (task && !/^Sends the requested reminder$/i.test(task)) {
      recipeInputs.task = task;
    }
  }
  if (profile.id === "content_extractor") {
    recipeInputs.platform = /\b(?:twitter|tweet|x post)\b/i.test(prompt)
      ? "twitter"
      : /\blinkedin\b/i.test(prompt)
        ? "linkedin"
        : /\b(?:reddit|subreddit|r\/[a-z0-9_]+)\b/i.test(prompt)
          ? "reddit"
          : recipeInputs.platform;
  }
  return {
    ...parsed,
    // Preserve prompt-only agent naming for old APK compatibility. Selected
    // recipes use the registry display name directly.
    name: parsed.name,
    avatar: profile.display.icon,
    connector: profile.required_connectors[0] ?? null,
    connector_ids: [...profile.required_connectors],
    action: profile.action,
    output_template: profile.output_contract,
    template_config: templateConfig(profile.output_contract),
    safety_level: profile.safety_level,
    risk_level: "low",
    permissions_needed: recipePermissions(profile.required_connectors),
    response_limit: profile.response_limit,
    recipe_version: profile.version,
    prompt_profile_version: profile.prompt_profile_version,
    recipe_inputs: recipeInputs,
    ...(parsed.required_access
      ? { required_access: parsed.required_access }
      : {})
  };
}

function parseIntentLegacy(prompt: string): ParsedIntent {
  const lower = prompt.toLowerCase();
  // Drafting agents name Twitter/LinkedIn as output formats, not OAuth connectors.
  const skipUnsupportedCheck = looksLikeContentDraftPrompt(prompt);
  const unsupported = skipUnsupportedCheck
    ? undefined
    : (UNSUPPORTED_CONNECTORS.find((connector) => lower.includes(connector)) ??
       (/\bx\b/.test(lower) && !/\bx\s*\(twitter\)/.test(lower)
          ? "x"
          : undefined));

  const trustedProvider = trustedProviderForPrompt(lower);
  const capability = classifyCapability(prompt, lower);
  if (trustedProvider && unsupported) {
    return genericProviderIntent(prompt, lower, trustedProvider);
  }

  if (unsupported) {
    return baseIntent(prompt, {
      name: "Unsupported Agent",
      avatar: "alert",
      intent: "unsupported_connector",
      connector: null,
      unsupported_connector: unsupported.trim(),
      action: `Cannot create agent because ${unsupported.trim()} is not supported yet.`,
      schedule_cron: parseSchedule(lower),
      output_template: "system",
      permissions_needed: []
    });
  }

  if (capability) {
    return capability;
  }
  if (trustedProvider) {
    return genericProviderIntent(prompt, lower, trustedProvider);
  }

  if (/\bcompetitors?\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Competitor Watch",
      avatar: "binoculars",
      intent: "competitor_watch",
      connector: "web_search",
      action: "Watches competitors and compares notable product or messaging changes.",
      schedule_cron: parseSchedule(lower) ?? "0 9 * * 1",
      output_template: "comparison",
      permissions_needed: ["Web search (no login needed)"]
    });
  }

  if (
    stockSymbols(prompt).length > 0 ||
    /\b(?:stock|stocks|portfolio|market close|holdings?|market\s+(?:monitor|tracker|watch|movement)|financial\s+market|stock\s+(?:monitor|tracker|watch))\b/.test(lower)
  ) {
    return baseIntent(prompt, {
      name: "Portfolio Watch",
      avatar: "line-chart",
      intent: "portfolio_watch",
      connector: "web_search",
      action: "Summarizes portfolio or market movement when reliable symbols are provided.",
      schedule_cron: parseSchedule(lower) ?? "0 16 * * *",
      output_template: "data_summary",
      permissions_needed: ["Web search or market data"]
    });
  }

  if (/\b(?:job market|jobs?|roles?|openings?)\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Job Market Radar",
      avatar: "briefcase",
      intent: "job_market_radar",
      connector: "web_search",
      action: "Searches for relevant job-market updates or openings.",
      schedule_cron: parseSchedule(lower) ?? "0 8 * * 1",
      output_template: "plain_text",
      permissions_needed: ["Web search (no login needed)"]
    });
  }

  if (lower.includes("tech news") || lower.includes("technology news")) {
    return baseIntent(prompt, {
      name: "Tech News",
      avatar: "newspaper",
      intent: "tech_news_brief",
      connector: "web_search",
      action: "Searches and summarizes technology news.",
      schedule_cron: parseSchedule(lower) ?? "0 7 * * *",
      output_template: "plain_text",
      permissions_needed: ["Web search (no login needed)"]
    });
  }

  if (
    /\b(?:news|headlines?)\b/.test(lower) ||
    /\b(?:updates?|brief|digest)\s+(?:about|on)\b/.test(lower) ||
    /\bstartup funding\b/.test(lower)
  ) {
    return baseIntent(prompt, {
      name: "News Brief",
      avatar: "newspaper",
      intent: "news_brief",
      connector: "web_search",
      action: "Searches and summarizes current news.",
      schedule_cron: parseSchedule(lower) ?? "0 7 * * *",
      output_template: "plain_text",
      permissions_needed: ["Web search (no login needed)"]
    });
  }

  if (/\bsearch(?:es|ing)?\b/.test(lower) || /\blook\s+up\b/.test(lower) || /\bresearch\b/.test(lower) || /\bpaper[s]?\b/.test(lower) || /\barxiv\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Web Search",
      avatar: "search",
      intent: "web_search_agent",
      connector: "web_search",
      action: "Searches the web and summarizes relevant results.",
      schedule_cron: parseSchedule(lower),
      output_template: "plain_text",
      permissions_needed: ["Web search (no login needed)"]
    });
  }

  if (
    !/\b(?:e-?mail|gmail|inbox|mailbox)\b/.test(lower) &&
    (
      lower.includes("calendar") ||
      /\b(?:daily|weekly|today'?s|tomorrow'?s) agenda\b/.test(lower) ||
      /\bupcoming (?:meetings|appointments|events)\b/.test(lower)
    )
  ) {
    return baseIntent(prompt, {
      name: "Calendar Agenda",
      avatar: "calendar",
      intent: "calendar_agenda",
      connector: "calendar",
      connector_ids: ["calendar"],
      action: "Reads upcoming Google Calendar events and prepares a concise agenda.",
      schedule_cron: parseSchedule(lower) ?? "0 7 * * *",
      output_template: "data_summary",
      permissions_needed: ["Google Calendar event read access"]
    });
  }

  if (/\bweekly progress\b/.test(lower) || /\baccomplished this week\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Weekly Progress",
      avatar: "file-check",
      intent: "weekly_progress_report",
      connector: "slack",
      connector_ids: ["slack", "drive"],
      action: "Combines Slack activity and Drive changes into a weekly progress report.",
      schedule_cron: parseSchedule(lower) ?? "0 17 * * 5",
      output_template: "plain_text",
      permissions_needed: ["Slack message history access", "Google Drive read access"]
    });
  }

  if (/\bdeadlines?\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Deadline Watcher",
      avatar: "check-square",
      intent: "project_deadline_watcher",
      connector: "drive",
      connector_ids: ["drive", "gmail"],
      action: "Finds project deadlines and turns them into a weekly checklist.",
      schedule_cron: parseSchedule(lower) ?? "0 8 * * 1",
      output_template: "checklist",
      permissions_needed: ["Google Drive read access", "Gmail read access"]
    });
  }

  if (/\b(?:travel|trip|flight|hotel|booking)\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Travel Sentinel",
      avatar: "map",
      intent: "travel_sentinel",
      connector: "gmail",
      connector_ids: ["gmail"],
      action: "Watches travel booking emails and surfaces upcoming travel actions.",
      schedule_cron: parseSchedule(lower),
      output_template: "checklist",
      permissions_needed: ["Gmail read access"]
    });
  }

  if (/\b(?:invoice|invoices|unpaid)\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Invoice Tracker",
      avatar: "receipt",
      intent: "invoice_tracker",
      connector: "gmail",
      connector_ids: ["gmail"],
      action: "Tracks unpaid invoices and flags follow-ups.",
      schedule_cron: parseSchedule(lower) ?? "0 9 * * 1",
      output_template: "urgency_list",
      permissions_needed: ["Gmail read access"]
    });
  }

  if (/\bsubscriptions?\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Subscription Auditor",
      avatar: "credit-card",
      intent: "subscription_auditor",
      connector: "gmail",
      connector_ids: ["gmail"],
      action: "Audits subscription receipts and recurring charges.",
      schedule_cron: parseSchedule(lower) ?? "0 9 1 * *",
      output_template: "data_summary",
      permissions_needed: ["Gmail read access"]
    });
  }

  if (/\b(?:follow[- ]?up|hasn't replied|has not replied|haven't replied|have not replied)\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Follow-up Watcher",
      avatar: "mail-warning",
      intent: "email_followup_watcher",
      connector: "gmail",
      connector_ids: ["gmail"],
      action: "Finds outgoing emails that have not received replies.",
      schedule_cron: parseSchedule(lower) ?? "0 10 * * *",
      output_template: "urgency_list",
      permissions_needed: ["Gmail read access"]
    });
  }

  if (/\bleads?\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Lead Monitor",
      avatar: "radar",
      intent: "lead_response_monitor",
      connector: "gmail",
      connector_ids: ["gmail"],
      action: "Watches Gmail for new lead messages.",
      schedule_cron: parseSchedule(lower),
      output_template: "urgency_list",
      permissions_needed: ["Gmail read access"]
    });
  }

  if (lower.includes("email") || lower.includes("gmail")) {
    return baseIntent(prompt, {
      name: "Email Digest",
      avatar: "mail",
      intent: "email_digest",
      connector: "gmail",
      connector_ids: ["gmail"],
      action: "Reads Gmail and summarizes messages that need attention.",
      schedule_cron: parseSchedule(lower) ?? "0 18 * * *",
      output_template: "data_summary",
      permissions_needed: ["Gmail read access"]
    });
  }

  if (lower.includes("slack")) {
    const urgent = lower.includes("urgent") || lower.includes("alert");

    if (/\b(?:eod|end of day|what i did)\b/.test(lower)) {
      return baseIntent(prompt, {
        name: "EOD Task Report",
        avatar: "clipboard-list",
        intent: "eod_task_report",
        connector: "slack",
        connector_ids: ["slack"],
        action: "Summarizes the user's Slack activity into an end-of-day task report.",
        schedule_cron: parseSchedule(lower) ?? "30 17 * * *",
        output_template: "plain_text",
        permissions_needed: ["Slack channel and message history access"]
      });
    }

    return baseIntent(prompt, {
      name: urgent ? "Slack Watcher" : "Slack Digest",
      avatar: "chat",
      intent: urgent ? "slack_urgent_watcher" : "slack_digest",
      connector: "slack",
      connector_ids: ["slack"],
      action: urgent
        ? "Watches Slack for urgent messages and mentions."
        : "Reads Slack and summarizes important activity.",
      schedule_cron: urgent ? null : parseSchedule(lower) ?? "0 17 * * *",
      output_template: urgent ? "urgency_list" : "data_summary",
      permissions_needed: ["Slack channel and message history access"]
    });
  }

  if (/\bmeeting notes?\b/.test(lower) || /\bdocs?\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Meeting Recap",
      avatar: "file-text",
      intent: "meeting_recap",
      connector: "drive",
      connector_ids: ["drive"],
      action: "Reads Docs meeting notes and extracts decisions, actions, and key points.",
      schedule_cron: parseSchedule(lower) ?? "0 19 * * *",
      output_template: "plain_text",
      permissions_needed: ["Google Drive read access"]
    });
  }

  if (lower.includes("pdf") || lower.includes("drive")) {
    return baseIntent(prompt, {
      name: lower.includes("pdf") ? "PDF Summary" : "Drive Summary",
      avatar: "file-text",
      intent: lower.includes("pdf") ? "pdf_summary" : "drive_summary",
      connector: "drive",
      connector_ids: ["drive"],
      action: "Reads Google Drive files and summarizes relevant changes or documents.",
      schedule_cron: parseSchedule(lower),
      output_template: lower.includes("pdf") ? "plain_text" : "data_summary",
      permissions_needed: ["Google Drive read access"]
    });
  }

  if (/\b(?:interview prep|interview)\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Interview Prep",
      avatar: "target",
      intent: "interview_prep",
      connector: null,
      action: "Creates one interview-prep task per day and tracks completion.",
      schedule_cron: parseSchedule(lower) ?? "0 9 * * *",
      output_template: "daily_task",
      permissions_needed: []
    });
  }

  if (/\b(?:procrastinat|help me actually do it|portfolio website|side project|thesis)\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Procrastination Breaker",
      avatar: "hammer",
      intent: "procrastination_breaker",
      connector: null,
      action: "Breaks an avoided project into small daily tasks.",
      schedule_cron: parseSchedule(lower) ?? "0 9 * * *",
      output_template: "daily_task",
      permissions_needed: []
    });
  }

  if (
    /\b(?:spanish|french|language|vocabulary|word)\b/.test(lower) &&
    /\b(?:teach|send|learn|word)\b/.test(lower)
  ) {
    return baseIntent(prompt, {
      name: "Daily Word",
      avatar: "languages",
      intent: "language_word",
      connector: null,
      action: "Delivers one word per day and tracks the learning habit.",
      schedule_cron: parseSchedule(lower) ?? "0 8 * * *",
      output_template: "streak_counter",
      permissions_needed: []
    });
  }

  if (/\bcoding tip\b|\badvanced .* tip\b|\bpython tip\b|\bdart tip\b|\bsql tip\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Coding Tip",
      avatar: "code",
      intent: "coding_tip",
      connector: null,
      action: "Sends one concrete coding tip on schedule.",
      schedule_cron: parseSchedule(lower) ?? "0 8 * * *",
      output_template: "plain_text",
      permissions_needed: []
    });
  }

  if (/\b(?:book|reading|atomic habits)\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Book Companion",
      avatar: "book-open",
      intent: "book_companion",
      connector: null,
      action: "Sends one book insight with an application prompt.",
      schedule_cron: parseSchedule(lower) ?? "0 9 * * *",
      output_template: "plain_text",
      permissions_needed: []
    });
  }

  if (/\b(?:baby|parenting|milestone|development)\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Parenting Milestones",
      avatar: "heart",
      intent: "parenting_milestones",
      connector: null,
      action: "Sends age-appropriate child development prompts.",
      schedule_cron: parseSchedule(lower) ?? "0 9 * * 1",
      output_template: "plain_text",
      permissions_needed: []
    });
  }

  if (/\b(?:friends?|relationship|check in|lose touch)\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Relationship Nudge",
      avatar: "users",
      intent: "relationship_nudge",
      connector: null,
      action: "Suggests one person to check in with on schedule.",
      schedule_cron: parseSchedule(lower) ?? "0 9 * * 1",
      output_template: "plain_text",
      permissions_needed: []
    });
  }

  if (/\b(?:gratitude|grateful|journal)\b/.test(lower)) {
    return baseIntent(prompt, {
      name: "Gratitude Prompt",
      avatar: "sparkles",
      intent: "gratitude_prompt",
      connector: null,
      action: "Prompts the user to write three specific things they are grateful for.",
      schedule_cron: parseSchedule(lower) ?? "0 21 * * *",
      output_template: "plain_text",
      permissions_needed: []
    });
  }

  if (
    lower.includes("habit") ||
    lower.includes("streak") ||
    lower.includes("meditate")
  ) {
    return baseIntent(prompt, {
      name: "Daily Habit",
      avatar: "flame",
      intent: "habit_tracker",
      connector: null,
      action: "Sends a daily prompt and tracks streak progress.",
      schedule_cron: parseSchedule(lower) ?? "0 8 * * *",
      output_template: "streak_counter",
      permissions_needed: []
    });
  }

  if (
    lower.includes("content extractor") ||
    (lower.includes("content") && lower.includes("extractor"))
  ) {
    return baseIntent(prompt, {
      name: "Content Extractor",
      avatar: "file-text",
      intent: "content_extractor",
      connector: null,
      action: "Finds latest relevant topics for content creation and generates post drafts.",
      schedule_cron: parseSchedule(lower) ?? "0 9 * * *",
      output_template: "content_extractor",
      permissions_needed: []
    });
  }

  if (
    lower.includes("dsa") ||
    lower.includes("leetcode") ||
    /data structures?\s*(?:and|&)\s*algorithms?/i.test(lower)
  ) {
    return baseIntent(prompt, {
      name: "DSA Practice",
      avatar: "code",
      intent: "dsa_question",
      connector: null,
      action: "Sends a daily DSA problem with examples, constraints, and hints.",
      schedule_cron: parseSchedule(lower) ?? "0 21 * * *",
      output_template: "dsa_question",
      permissions_needed: []
    });
  }

  if (
    lower.includes("study") ||
    lower.includes("jee") ||
    lower.includes("neet") ||
    lower.includes("exam")
  ) {
    return baseIntent(prompt, {
      name: "Study Plan",
      avatar: "book-open",
      intent: "study_plan",
      connector: null,
      action: "Creates a study plan and sends daily progress updates.",
      schedule_cron: parseSchedule(lower) ?? "0 8 * * *",
      output_template: "study_guide",
      permissions_needed: []
    });
  }

  if (
    lower.includes("remind") ||
    lower.includes("reminder") ||
    lower.includes("ping me")
  ) {
    return baseIntent(prompt, {
      name: "Reminder",
      avatar: "bell",
      intent: "scheduled_reminder",
      connector: null,
      action: reminderAction(prompt),
      schedule_cron: parseSchedule(lower) ?? "0 9 * * *",
      output_template: "plain_text",
      permissions_needed: []
    });
  }

  return baseIntent(prompt, {
    name: "Custom Agent",
    avatar: "spark",
    intent: "custom_read_agent",
    connector: null,
    action: "Sends a recurring message based on the user's prompt.",
    schedule_cron: parseSchedule(lower),
    output_template: "plain_text",
    permissions_needed: []
  });
}

function baseIntent(
  prompt: string,
  overrides: Partial<ParsedIntent>
): ParsedIntent {
  const intent = overrides.intent ?? "custom_read_agent";
  const realtimeEnabled =
    overrides.realtime_enabled ??
    (isIntrinsicallyRealtimeIntent(intent) ||
      (supportsRealtimeIntent(intent) && requestsRealtime(prompt)));
  const scheduleCron =
    realtimeEnabled && parseSchedule(prompt) === null
      ? null
      : overrides.schedule_cron ?? null;
  const githubRepository =
    intent === "github_activity_digest"
      ? overrides.github_repository ?? extractGitHubRepository(prompt)
      : null;

  return {
    name: overrides.name ?? "Custom Agent",
    avatar: overrides.avatar ?? "spark",
    intent,
    connector: overrides.connector ?? null,
    connector_ids: overrides.connector_ids ?? [],
    unsupported_connector: overrides.unsupported_connector ?? null,
    action: overrides.action ?? prompt,
    schedule_cron: scheduleCron,
    output_template: overrides.output_template ?? "plain_text",
    template_config: templateConfig(overrides.output_template ?? "plain_text"),
    safety_level: "read",
    risk_level: "low",
    permissions_needed: overrides.permissions_needed ?? [],
    realtime_enabled: realtimeEnabled,
    ...(overrides.required_access
      ? { required_access: overrides.required_access }
      : {}),
    ...(githubRepository ? { github_repository: githubRepository } : {})
  };
}

function trustedProviderForPrompt(lowerPrompt: string, unsupported?: string) {
  return listTrustedMcpProviders().find((provider) =>
    [provider.providerId, provider.displayName, ...(unsupported ? [unsupported] : [])].some((value) =>
      lowerPrompt.includes(value.toLowerCase())
    )
  );
}

function genericProviderIntent(
  prompt: string,
  lower: string,
  provider: ReturnType<typeof listTrustedMcpProviders>[number]
): ParsedIntent {
  return baseIntent(prompt, {
    name: provider.displayName,
    avatar: provider.iconName,
    intent: "custom_read_agent",
    connector: null,
    connector_ids: [],
    action: `Reads approved context from ${provider.displayName}.`,
    schedule_cron: parseSchedule(lower),
    output_template: "plain_text",
    permissions_needed: [],
    required_access: providerRequirements(provider)
  });
}

function providerRequirements(provider: {
  providerId: string;
  displayName: string;
  capabilities: string[];
}) {
  return provider.capabilities.flatMap((capability) => {
    const [service, action] = capability.split(".", 2);
    if (!service || !action) return [];
    return [{
      service,
      capabilities: [action],
      required: true,
      preferred_provider_ids: [provider.providerId],
      reason: `${provider.displayName} ${action} access`
    }];
  });
}

const REALTIME_INTENTS = new Set([
  "github_activity_digest",
  "slack_urgent_watcher",
  "lead_response_monitor",
  "calendar_agenda",
  "drive_summary",
  "pdf_summary",
  "meeting_recap",
  "portfolio_watch"
]);

function supportsRealtimeIntent(intent: string): boolean {
  return REALTIME_INTENTS.has(intent);
}

function isIntrinsicallyRealtimeIntent(intent: string): boolean {
  return intent === "slack_urgent_watcher" || intent === "lead_response_monitor";
}

function requestsRealtime(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return (
    /\breal[ -]?time\b|\bimmediately\b|\binstantly\b|\bas soon as\b|\bthe moment\b/.test(
      lower
    ) ||
    /\b(?:notify|alert|inform|tell|message|ping)\s+me\s+(?:when|whenever|if)\b/.test(
      lower
    ) ||
    /\b(?:when|whenever|if)\b[^.!?]{0,100}\b(?:changes?|updates?|push(?:es)?|commits?|releases?|opens?|closes?|merges?)\b/.test(
      lower
    )
  );
}

function templateConfig(template: string): Record<string, boolean> {
  return {
    has_progress_bars: template === "progress_tracker",
    has_countdown: template === "progress_tracker",
    has_streak: template === "progress_tracker" || template === "streak_counter",
    has_action_buttons: [
      "progress_tracker",
      "checklist",
      "daily_task",
      "streak_counter",
      "study_guide",
      "dsa_question",
      "content_extractor"
    ].includes(template),
    has_checklist: template === "checklist"
  };
}

function recipePermissions(connectors: readonly string[]): string[] {
  const labels: Record<string, string> = {
    gmail: "Gmail read access",
    drive: "Google Drive read access",
    calendar: "Google Calendar event read access",
    github: "GitHub profile and repository read access",
    slack: "Slack message history access",
    notion: "Read selected Notion pages",
    web_search: "Web search (no login needed)"
  };
  return connectors
    .map((connector) => labels[connector])
    .filter((label): label is string => Boolean(label));
}

function classifyCapability(prompt: string, lower: string): ParsedIntent | null {
  let best:
    | {
        definition: CapabilityDefinition;
        score: number;
      }
    | null = null;

  for (const definition of CAPABILITIES) {
    const score = scoreCapability(definition, lower);
    if (score === null) continue;

    if (!best || score > best.score) {
      best = { definition, score };
    }
  }

  return best ? capabilityIntent(prompt, lower, best.definition) : null;
}

function scoreCapability(
  definition: CapabilityDefinition,
  lower: string
): number | null {
  const { match } = definition;
  if (match.not?.some((pattern) => pattern.test(lower))) {
    return null;
  }

  let score = definition.priority ?? 0;
  let matchedRequired = false;

  for (const pattern of match.all ?? []) {
    if (!pattern.test(lower)) return null;
    score += 8;
    matchedRequired = true;
  }

  for (const group of match.allAny ?? []) {
    const matches = group.filter((pattern) => pattern.test(lower)).length;
    if (matches === 0) return null;
    score += 8 + matches;
    matchedRequired = true;
  }

  const optionalMatches =
    match.any?.filter((pattern) => pattern.test(lower)).length ?? 0;
  if (!matchedRequired && (match.any?.length ?? 0) > 0 && optionalMatches === 0) {
    return null;
  }

  return score + optionalMatches * 3;
}

function capabilityIntent(
  prompt: string,
  lower: string,
  definition: CapabilityDefinition
): ParsedIntent {
  const defaultSchedule =
    definition.defaultSchedule === undefined
      ? null
      : definition.defaultSchedule;
  return baseIntent(prompt, {
    name: definition.name,
    avatar: definition.avatar,
    intent: definition.intent,
    connector: definition.connector,
    connector_ids: definition.connectorIds ?? [],
    action:
      typeof definition.action === "function"
        ? definition.action(prompt)
        : definition.action,
    schedule_cron: parseSchedule(lower) ?? defaultSchedule,
    output_template: definition.outputTemplate,
    permissions_needed: definition.permissionsNeeded
  });
}

function parseSchedule(prompt: string): string | null {
  const lower = prompt.toLowerCase();
  const regexAmpm = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
  const regex24h = /\b(?:at\s+)?(\d{1,2}):(\d{2})\b/;

  let hour: number | null = null;
  let minute = 0;

  const matchAmpm = lower.match(regexAmpm);
  if (matchAmpm) {
    hour = to24Hour(matchAmpm[1], matchAmpm[3]);
    minute = matchAmpm[2] ? Number(matchAmpm[2]) : 0;
  } else {
    const match24h = lower.match(regex24h);
    if (match24h) {
      const h = Number(match24h[1]);
      const m = Number(match24h[2]);
      if (h >= 0 && h < 24 && m >= 0 && m < 60) {
        hour = h;
        minute = m;
      }
    }
  }

  if (hour !== null) {
    if (lower.includes("friday")) return `${minute} ${hour} * * 5`;
    if (lower.includes("weekday") || lower.includes("every weekday") || lower.includes("weekdays")) {
      return `${minute} ${hour} * * 1-5`;
    }
    if (lower.includes("weekly") || lower.includes("every week")) {
      return `${minute} ${hour} * * 1`;
    }
    if (lower.includes("monthly") || lower.includes("every month")) {
      return `${minute} ${hour} 1 * *`;
    }
    return `${minute} ${hour} * * *`;
  }

  if (lower.includes("friday")) return `0 9 * * 5`;
  if (lower.includes("weekday") || lower.includes("every weekday") || lower.includes("weekdays")) {
    return `0 9 * * 1-5`;
  }
  if (lower.includes("weekly") || lower.includes("every week")) {
    return `0 9 * * 1`;
  }
  if (lower.includes("monthly") || lower.includes("every month")) {
    return `0 9 1 * *`;
  }
  if (lower.includes("market close")) return `0 16 * * *`;
  if (lower.includes("evening")) return `0 18 * * *`;
  if (lower.includes("morning")) return `0 7 * * *`;
  if (lower.includes("daily") || lower.includes("every day")) {
    return `0 9 * * *`;
  }

  return null;
}

function reminderAction(prompt: string): string {
  const match = prompt.match(/\breminds?\s+me\s+to\s+(.+)$/i);
  const task = match?.[1]
    ?.replace(/\s+\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, "")
    .replace(/\s+\b(?:daily|every day|weekly|every week|monthly|every month)\b/gi, "")
    .trim();

  if (!task) {
    return "Sends the requested reminder.";
  }

  return `Reminder: ${task}.`;
}

function to24Hour(rawHour: string | undefined, meridiem: string | undefined): number {
  const hour = Number(rawHour);
  if (meridiem === "am") return hour === 12 ? 0 : hour;
  if (meridiem === "pm") return hour === 12 ? 12 : hour + 12;
  return hour;
}

export function responseLimitInstruction(limit?: string): string {
  if (limit === "concise") {
    return "RESPONSE DENSITY REQUIREMENT: The response must be extremely brief, concise, and focused. Avoid any extra explanation, detailed background, or filler. Deliver only the most essential key points or items directly.";
  }
  if (limit === "detailed") {
    return "RESPONSE DENSITY REQUIREMENT: The response must be highly detailed, verbose, and precise. Include comprehensive explanations, complete background details, and in-depth step-by-step points.";
  }
  // Default to balanced
  return "RESPONSE DENSITY REQUIREMENT: Deliver a balanced summary of information. Provide reasonable context and clear explanations without being overly verbose.";
}

export function responseStyleGuidance(limit?: string): string {
  if (limit === "concise") {
    return "Keep replies concise, extremely brief, and scannable. Use short bullets when listing items.";
  }
  if (limit === "detailed") {
    return "Provide thorough, in-depth, and comprehensive replies with complete background details and detailed step-by-step explanations.";
  }
  return "Keep replies practical, balanced, and scannable. Provide clear context without excessive length.";
}

export function maxTokensForResponseLimit(limit?: string, fallback: number = 900): number {
  if (limit === "concise") return 512;
  if (limit === "detailed") return 1200;
  if (limit === "balanced") return 900;
  return fallback;
}


export const STOCK_MAPPINGS: Record<string, string> = {
  "ril": "Reliance Industries",
  "reliance": "Reliance Industries",
  "tcs": "Tata Consultancy Services",
  "tata consultancy": "Tata Consultancy Services",
  "infy": "Infosys",
  "infosys": "Infosys",
  "tata steel": "Tata Steel",
  "hdfc": "HDFC Bank",
  "icici": "ICICI Bank",
  "sbi": "State Bank of India",
  "sbin": "State Bank of India",
  "state bank": "State Bank of India",
  "wipro": "Wipro",
  "airtel": "Bharti Airtel",
  "bharti airtel": "Bharti Airtel",
  "l&t": "Larsen & Toubro",
  "larsen": "Larsen & Toubro",
  "rvnl": "Rail Vikas Nigam",
  "irfc": "Indian Railway Finance Corporation",
  "lic": "Life Insurance Corporation",
  "hcl": "HCL Technologies"
};

export const STOP_WORDS = new Set([
  "track", "watch", "stocks", "stock", "portfolio", "market", "close", "and", "the", "avoid", "for", "this",
  "that", "daily", "with", "my", "holdings", "of", "me", "show", "give", "brief", "summary", "digest",
  "movement", "today", "yesterday", "tomorrow", "week", "month", "year", "latest", "current", "update",
  "price", "prices", "info", "information", "details", "report", "status", "rate", "rates",
  "quotes", "quote", "share", "shares"
]);

export function stockSymbols(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const searchQueries: string[] = [];

  for (const [key, value] of Object.entries(STOCK_MAPPINGS)) {
    const regex = new RegExp(`\\b${key}\\b`, "i");
    if (regex.test(lower)) {
      searchQueries.push(value);
    }
  }

  const matches = prompt.match(/\b[A-Z]{2,6}\b/g) ?? [];
  for (const symbol of matches) {
    if (["DSA", "JEE", "NEET", "PDF", "API"].includes(symbol)) {
      continue;
    }
    if (STOCK_MAPPINGS[symbol.toLowerCase()]) {
      continue;
    }
    searchQueries.push(symbol);
  }

  const words = lower.split(/[^a-zA-Z&]+/).map(w => w.trim()).filter(w => w.length >= 2);
  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    if (["dsa", "jee", "neet", "pdf", "api"].includes(word)) continue;
    if (STOCK_MAPPINGS[word]) continue;
    const isMatched = searchQueries.some(q => q.toLowerCase().includes(word));
    if (isMatched) continue;

    const titleCaseWord = word.charAt(0).toUpperCase() + word.slice(1);
    searchQueries.push(titleCaseWord);
  }

  return [...new Set(searchQueries)].slice(0, 6);
}
