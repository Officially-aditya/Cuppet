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

export const demoRecipes: AgentRecipe[] = [
  { id: "daily_briefing", name: "Daily briefing", description: "A useful start-of-day overview from your connected tools.", category: "Planning", example_prompt: "Every weekday at 8 AM, brief me on my calendar and important email." },
  { id: "inbox_triage", name: "Inbox triage", description: "Surface the messages that genuinely need a decision.", category: "Communication", example_prompt: "Watch Gmail and tell me when something needs a reply." },
  { id: "project_pulse", name: "Project pulse", description: "Summarize meaningful progress across GitHub and Slack.", category: "Engineering", example_prompt: "Every Friday, summarize meaningful progress on Sydney." },
  { id: "news_brief", name: "News brief", description: "Follow a topic and synthesize the useful developments.", category: "Research", example_prompt: "Every morning, give me a concise AI agents news brief." }
];
