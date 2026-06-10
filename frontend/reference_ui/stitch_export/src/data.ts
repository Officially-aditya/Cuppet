import { Connector, AgentThread, ChatMessage } from "./types";

export const INITIAL_CONNECTORS: Connector[] = [
  {
    id: "gmail",
    name: "Gmail",
    summary: "Read & send emails",
    status: "connected",
    iconName: "mail",
  },
  {
    id: "calendar",
    name: "Google Calendar",
    summary: "Manage schedule",
    status: "linked",
    iconName: "calendar_month",
  },
  {
    id: "slack",
    name: "Slack",
    summary: "Action required",
    status: "review",
    iconName: "tag",
  },
];

export const INITIAL_THREADS: AgentThread[] = [
  {
    id: "assistant",
    name: "Assistant",
    initials: "S",
    colorClass: "bg-primary-container text-on-primary",
    preview: "Your home base for delegation.",
    detail: "I can help you turn a sentence into a useful agent.",
    isPinned: true,
  },
  {
    id: "opswatch",
    name: "Ops Watch",
    initials: "OW",
    colorClass: "bg-warning text-white",
    preview: "Tracks deadlines and flags anything slipping.",
    detail: "Two items need attention before Friday.",
    hasBadge: true,
  },
  {
    id: "scout",
    name: "Research Scout",
    initials: "RS",
    colorClass: "bg-info text-white",
    preview: "Collects weekly market notes.",
    detail: "I summarized the latest category shifts.",
  },
];

export const INITIAL_SCOUT_CHAT: ChatMessage[] = [
  {
    id: "scout-1",
    sender: "system",
    content: "Assistant is pinned so you always have a place to start.",
  },
  {
    id: "scout-2",
    sender: "agent",
    content: "Tell me what you want watched, summarized, reminded, or prepared. One sentence is enough.",
  },
  {
    id: "scout-3",
    sender: "user",
    content: "Summarize the latest category shifts for the market pulse.",
  },
  {
    id: "scout-4",
    sender: "agent",
    content: "Demand is shifting toward lighter setup and clearer privacy controls.",
    templateType: "report",
  },
  {
    id: "scout-5",
    sender: "agent",
    content: "Delegation streak: 3 days. Small, steady handoffs build trust.",
    templateType: "streak",
  },
];

export const INITIAL_TRACKER_CHAT: ChatMessage[] = [
  {
    id: "tr-1",
    sender: "system",
    content: "Yesterday, 10:42 AM",
  },
  {
    id: "tr-2",
    sender: "agent",
    content: "I'm ready to help. Let's finish setting up your workflow so I can start delegating tasks.",
    templateType: "progress",
  },
  {
    id: "tr-3",
    sender: "user",
    content: "I'll connect the CRM tool now. What else do we need?",
  },
  {
    id: "tr-4",
    sender: "system",
    content: "Awaiting connection",
  },
];
