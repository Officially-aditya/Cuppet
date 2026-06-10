/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Screen {
  Splash = "SPLASH",
  SignIn = "SIGN_IN",
  SignUp = "SIGN_UP",
  ForgotPassword = "FORGOT_PASSWORD",
  Inbox = "INBOX",
  NewAgent = "NEW_AGENT",
  ConfirmAgent = "CONFIRM_AGENT",
  SetupTracker = "SETUP_TRACKER",
  Connectors = "CONNECTORS",
  ScoutChat = "SCOUT_CHAT",
  Settings = "SETTINGS",
}

export interface Connector {
  id: string;
  name: string;
  summary: string;
  status: "connected" | "linked" | "review" | "none";
  iconName: string;
}

export interface AgentThread {
  id: string;
  name: string;
  initials: string;
  colorClass: string;
  preview: string;
  detail: string;
  hasBadge?: boolean;
  isPinned?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "agent" | "system";
  content: string;
  timestamp?: string;
  templateType?: "progress" | "report" | "streak" | "none";
}
