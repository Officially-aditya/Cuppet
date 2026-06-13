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
}

const UNSUPPORTED_CONNECTORS = [
  "instagram",
  "whatsapp",
  "twitter",
  "linkedin",
  "google fit",
  "fitbit",
  "calendar",
  "notion"
];

export function parseIntent(prompt: string): ParsedIntent {
  const lower = prompt.toLowerCase();
  const unsupported =
    UNSUPPORTED_CONNECTORS.find((connector) => lower.includes(connector)) ??
    (/\bx\b/.test(lower) ? "x" : undefined);

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

  if (/\b(?:stock|stocks|portfolio|market close|holdings?)\b/.test(lower)) {
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
      output_template: "progress_tracker",
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
  return {
    name: overrides.name ?? "Custom Agent",
    avatar: overrides.avatar ?? "spark",
    intent: overrides.intent ?? "custom_read_agent",
    connector: overrides.connector ?? null,
    connector_ids: overrides.connector_ids ?? [],
    unsupported_connector: overrides.unsupported_connector ?? null,
    action: overrides.action ?? prompt,
    schedule_cron: overrides.schedule_cron ?? null,
    output_template: overrides.output_template ?? "plain_text",
    template_config: templateConfig(overrides.output_template ?? "plain_text"),
    safety_level: "read",
    risk_level: "low",
    permissions_needed: overrides.permissions_needed ?? []
  };
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
      "streak_counter"
    ].includes(template),
    has_checklist: template === "checklist"
  };
}

function parseSchedule(prompt: string): string | null {
  const explicitTime = prompt.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  const hour = explicitTime ? to24Hour(explicitTime[1], explicitTime[3]) : null;
  const minute = explicitTime?.[2] ? Number(explicitTime[2]) : 0;

  if (prompt.includes("friday")) return `${minute} ${hour ?? 9} * * 5`;
  if (prompt.includes("weekly") || prompt.includes("every week")) {
    return `${minute} ${hour ?? 9} * * 1`;
  }
  if (prompt.includes("monthly") || prompt.includes("every month")) {
    return `${minute} ${hour ?? 9} 1 * *`;
  }
  if (prompt.includes("market close")) return `${minute} ${hour ?? 16} * * *`;
  if (prompt.includes("evening")) return `${minute} ${hour ?? 18} * * *`;
  if (prompt.includes("morning")) return `${minute} ${hour ?? 7} * * *`;
  if (prompt.includes("daily") || prompt.includes("every day")) {
    return `${minute} ${hour ?? 9} * * *`;
  }
  if (explicitTime) return `${minute} ${hour} * * *`;

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
