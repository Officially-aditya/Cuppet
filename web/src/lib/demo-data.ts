import type { Agent, AgentMessage, AgentRecipe, Connector, CurrentUserResponse } from "./types";

const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

export const demoUser: CurrentUserResponse = {
  user: { id: "demo-user", name: "Addy", email: "addy@example.com" },
  preferences: { time_zone: "Asia/Kolkata", follow_device_time_zone: true }
};

export const demoAgents: Agent[] = [
  { id: "assistant", name: "Assistant", description: "Your Cuppet copilot", status: "active", is_assistant: true, avatar: "sparkles", last_message_preview: "What should we work on?", latest_message_at: ago(1), unread_count: 0 },
  { id: "daily", name: "Daily briefing", description: "A calm overview of the day ahead", status: "active", avatar: "sun", connector_ids: ["gmail", "calendar"], schedule_cron: "0 8 * * 1-5", last_message_preview: "Your morning overview is ready", latest_message_at: ago(2), unread_count: 1 },
  { id: "inbox", name: "Inbox triage", description: "Find the messages that need a decision", status: "active", avatar: "mail", connector_ids: ["gmail"], last_message_preview: "3 emails need your attention", latest_message_at: ago(8), unread_count: 2 },
  { id: "calendar", name: "Calendar scout", description: "Watch for conflicts and useful focus blocks", status: "active", avatar: "calendar", connector_ids: ["calendar"], last_message_preview: "No conflicts in today’s schedule", latest_message_at: ago(21), unread_count: 0 },
  { id: "project", name: "Project pulse", description: "Summarize meaningful changes across Sydney", status: "paused", avatar: "activity", connector_ids: ["github", "slack"], last_message_preview: "Sydney moved forward this week", latest_message_at: ago(1440), unread_count: 0 }
];

export const demoMessages: Record<string, AgentMessage[]> = {
  daily: [
    {
      id: "brief-1",
      agent_id: "daily",
      role: "agent",
      created_at: ago(2),
      source_refs: [{ source: "Google Calendar" }, { source: "Gmail" }],
      content: {
        template: "briefing_card",
        presentation: { feedback_eligible: true, feedback_reason: "first_result", part_index: 0, part_count: 1 },
        data: {
          eyebrow: "Good morning, Addy",
          title: "Here’s the shape of your day.",
          summary: "You have a focused morning, two decisions waiting in your inbox, and one calendar change worth noting.",
          sections: [
            { id: "calendar", title: "Calendar", source: "Google Calendar", tone: "info", items: [{ title: "3 meetings", detail: "First one at 10:30 AM" }, { title: "Deep work window", detail: "8:30–10:15 AM is clear" }] },
            { id: "inbox", title: "Inbox", source: "Gmail", tone: "attention", items: [{ title: "2 replies worth making", detail: "Both can unblock work today" }] }
          ],
          priorities: ["Reply to the research handoff", "Review the launch checklist before 3:30"]
        }
      }
    },
    { id: "daily-user", agent_id: "daily", role: "user", created_at: ago(1), content: { template: "plain_text", data: { body: "Give me the short version." } } },
    { id: "daily-reply", agent_id: "daily", role: "agent", created_at: ago(0), content: { template: "plain_text", data: { body: "Two emails need decisions. Your morning is clear until 10:30, and the design review is now at 3:30." } } }
  ],
  inbox: [{ id: "inbox-1", agent_id: "inbox", role: "agent", created_at: ago(8), content: { template: "urgency_list", data: { title: "3 emails need your attention", source: "Gmail", items: [{ label: "Approve the research handoff", urgency: "high", preview: "Maya is waiting on a go/no-go decision." }, { label: "Confirm launch copy", urgency: "medium", preview: "Two headlines need your preference." }, { label: "Finance: August invoice", urgency: "medium", preview: "Payment is due this Friday." }] } } }],
  calendar: [{ id: "cal-1", agent_id: "calendar", role: "agent", created_at: ago(21), content: { template: "all_clear", data: { message: "No conflicts in today’s schedule.", sourceSummary: "Checked 3 meetings and your focus blocks." } } }],
  project: [{ id: "proj-1", agent_id: "project", role: "agent", created_at: ago(1440), content: { template: "data_summary", data: { title: "Sydney moved forward this week", summary: "The web groundwork landed, reliability improved, and the team closed four launch blockers.", metrics: [{ label: "PRs merged", value: "12" }, { label: "Issues closed", value: "8" }, { label: "Open blockers", value: "2" }] } } }],
  assistant: [{ id: "asst-1", agent_id: "assistant", role: "agent", created_at: ago(1), content: { template: "plain_text", data: { headline: "Welcome back", body: "I can help shape a new agent, explore a briefing, or work through an attachment." } } }]
};

export const demoConnectors: Connector[] = [
  { id: "gmail", name: "Gmail", description: "Read approved email context and prepare summaries", category: "Email & communication", icon_name: "Mail", status: "connected", auth_configured: true, required_scopes: ["Read messages and metadata"] },
  { id: "calendar", name: "Google Calendar", description: "Watch schedules, conflicts, and meeting changes", category: "Productivity & docs", icon_name: "CalendarDays", status: "connected", auth_configured: true, required_scopes: ["Read calendars and events"] },
  { id: "drive", name: "Google Drive", description: "Read selected files and summarize documents", category: "Productivity & docs", icon_name: "HardDrive", status: "disconnected", auth_configured: true },
  { id: "github", name: "GitHub", description: "Follow repositories, pull requests, and issues", category: "Engineering", icon_name: "Github", status: "connected", auth_configured: true },
  { id: "slack", name: "Slack", description: "Read selected channels and prepare useful updates", category: "Email & communication", icon_name: "MessageSquare", status: "disconnected", auth_configured: true },
  { id: "notion", name: "Notion", description: "Read selected workspace pages and recent changes", category: "Productivity & docs", icon_name: "FileText", status: "disconnected", auth_configured: true },
  { id: "web_search", name: "Web Search", description: "Search the public web without a login", category: "Web & research", icon_name: "Search", status: "connected", auth_configured: true }
];

const demoRecipe = (
  id: string,
  name: string,
  description: string,
  category: string,
  example_prompt: string,
  required_connectors: string[] = []
): AgentRecipe => ({
  id,
  version: 1,
  name,
  description,
  category,
  example_prompt,
  required_connectors
});

// Keep the demo workspace aligned with the visible recipes returned by the
// backend so the New Agent flow is useful before a user connects an account.
export const demoRecipes: AgentRecipe[] = [
  demoRecipe("news_brief", "News agent", "Five ranked current stories with a TL;DR.", "news", "Create a News agent. Research the top stories every morning and rank five useful developments.", ["web_search"]),
  demoRecipe("tech_news_brief", "Tech News", "A ranked briefing of fresh, high-signal technology news.", "news", "Create a Tech News agent. Give me a concise technology briefing every morning.", ["web_search"]),
  demoRecipe("email_digest", "Email agent", "Ranks Gmail replies, deadlines, finance or security alerts, and useful updates.", "work", "Create an Email agent. Review Gmail every evening and surface replies, deadlines, finance, and security alerts.", ["gmail"]),
  demoRecipe("calendar_agenda", "Calendar agent", "Turns upcoming Google Calendar events into a concise prioritized agenda.", "work", "Create a Calendar agent. Prepare a prioritized agenda from my upcoming Google Calendar events every morning.", ["calendar"]),
  demoRecipe("github_activity_digest", "GitHub agent", "Ranks commit messages, repository, issue, and pull-request activity involving you.", "work", "Create a GitHub agent. Summarize my recent repository, issue, and pull-request activity every morning.", ["github"]),
  demoRecipe("scheduled_reminder", "Reminder agent", "A scheduled, tone-aware nudge with an optional tiny next step.", "productivity", "Create a Reminder agent. Remind me every evening to code for a few minutes with an encouraging first step."),
  demoRecipe("dsa_question", "DSA agent", "One progressive coding problem with constraints, examples, and a bounded hint.", "learning", "Create a DSA agent. Send me one progressive coding problem every evening with examples and a hint."),
  demoRecipe("portfolio_watch", "Market watch", "Tracks required symbols and explains material market moves and events.", "markets", "Create a Market watch agent. Track RIL, TCS, and MRF and explain material moves on weekdays.", ["web_search"]),
  demoRecipe("content_extractor", "Content extractor", "Finds three fresh, audience-fit content angles and supports draft selection.", "content", "Create a Content extractor. Find three fresh technology content angles for curious professionals every morning.", ["web_search"]),
  demoRecipe("daily_executive_briefing", "Daily briefing", "Calendar, important email, and Slack synthesized into one prioritized card.", "briefing", "Create a Daily briefing agent. Combine today's calendar, important Gmail, and relevant Slack into one morning briefing.", ["gmail", "calendar", "slack"]),
  demoRecipe("project_pulse", "Project pulse", "GitHub, Slack, Notion, and Drive activity synthesized into a project view.", "briefing", "Create a Project pulse agent. Summarize GitHub, Slack, Notion, and Drive progress every weekday.", ["github", "slack", "notion", "drive"]),
  demoRecipe("meeting_intelligence", "Meeting intelligence", "Calendar events enriched with relevant email and workspace context.", "briefing", "Create a Meeting intelligence agent. Prepare context for my upcoming meetings every weekday.", ["calendar", "gmail", "drive", "notion"]),
  demoRecipe("weekly_accomplishment_report", "Weekly accomplishments", "An evidence-based weekly review across connected work tools.", "briefing", "Create a Weekly accomplishments agent. Summarize my contributions and measurable progress every Friday.", ["slack", "github", "drive", "notion"])
];
