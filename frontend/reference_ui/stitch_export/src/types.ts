/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ScreenId =
  | 'sydney-signin'
  | 'sydney-inbox'
  | 'sydney-thread'
  | 'sydney-createaccount'
  | 'agent-preferences'
  | 'new-agent'
  | 'confirm-agent'
  | 'connectors-categorized'
  | 'settings'
  | 'connectors-advanced';

export type TransitionType = 'push' | 'push_back' | 'slide_up' | 'none';

export interface Agent {
  id: string;
  name: string;
  avatarText: string;
  avatarBg: string;
  lastMessage: string;
  lastMessageTime: string;
  isPinned?: boolean;
  isActive?: boolean;
}

export interface Message {
  id: string;
  sender: 'agent' | 'user' | 'system';
  text: string;
  timestamp?: string;
  subContent?: {
    title: string;
    description: string;
    metrics: Array<{ label: string; value: string }>;
  };
}

export interface Connector {
  id: string;
  name: string;
  description: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'OAUTH';
  category: string;
  icon: string;
}

export interface AgentConfig {
  sentence: string;
  connectedTools: string[];
  responseTiming: 'real-time' | 'daily';
  responseLimit: 'concise' | 'balanced' | 'detailed';
  activeUntil: string;
  runIndefinitely: boolean;
}
