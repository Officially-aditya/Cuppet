/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Agent, Message, Connector } from './types';

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'assistant',
    name: 'Assistant',
    avatarText: 'S',
    avatarBg: 'bg-primary-container text-on-primary-container',
    lastMessage: 'I can help you turn a sentence into a useful micro-agent.',
    lastMessageTime: 'Permanent',
    isPinned: true,
    isActive: false,
  },
  {
    id: 'ops-watch',
    name: 'Ops Watch',
    avatarText: 'OW',
    avatarBg: 'bg-orange-600 text-white',
    lastMessage: 'Two items need attention before Friday.',
    lastMessageTime: '9:41 AM',
    isPinned: false,
    isActive: true,
  },
  {
    id: 'research-scout',
    name: 'Research Scout',
    avatarText: 'RS',
    avatarBg: 'bg-blue-800 text-white',
    lastMessage: 'I summarized the latest category shifts.',
    lastMessageTime: 'Yesterday',
    isPinned: false,
    isActive: false,
  }
];

export const SC_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    sender: 'system',
    text: 'Assistant is pinned so you always have a place to start.'
  },
  {
    id: 'msg-2',
    sender: 'agent',
    text: 'Tell me what you want watched, summarized, reminded, or prepared. One sentence is enough.'
  },
  {
    id: 'msg-3',
    sender: 'user',
    text: 'Summarize the latest category shifts for the market pulse.'
  },
  {
    id: 'msg-4',
    sender: 'agent',
    text: 'Ready to summarize. Below is the parsed market pulse summary generated based on connected insights.',
    subContent: {
      title: 'Market pulse',
      description: 'Demand is shifting toward lighter setup and clearer privacy controls.',
      metrics: [
        { label: 'SOURCES CHECKED', value: '18' },
        { label: 'STRONG SIGNALS', value: '5' },
        { label: 'NOISE FILTERED', value: '42%' }
      ]
    }
  },
  {
    id: 'msg-5',
    sender: 'system',
    text: 'Delegation streak: 3 days. Small, steady handoffs build trust.'
  }
];

export const INITIAL_CONNECTORS: Connector[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Let agents read approved mailbox context through the backend.',
    status: 'CONNECTED',
    category: 'EMAIL & COMMUNICATION',
    icon: 'Mail'
  },
  {
    id: 'gcal',
    name: 'Google Calendar',
    description: 'Use availability and upcoming events when you approve it.',
    status: 'OAUTH',
    category: 'CALENDAR & SCHEDULING',
    icon: 'Calendar'
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Watch selected channels and prepare concise updates.',
    status: 'CONNECTING',
    category: 'EMAIL & COMMUNICATION',
    icon: 'MessageSquare'
  },
  {
    id: 'outlook',
    name: 'Outlook',
    description: 'Access emails and communications from your Microsoft account.',
    status: 'DISCONNECTED',
    category: 'EMAIL & COMMUNICATION',
    icon: 'Layers'
  },
  {
    id: 'calendly',
    name: 'Calendly',
    description: 'Manage your scheduling and meeting links seamlessly.',
    status: 'DISCONNECTED',
    category: 'CALENDAR & SCHEDULING',
    icon: 'Clock'
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Connect your workspace for documentation and notes.',
    status: 'DISCONNECTED',
    category: 'PRODUCTIVITY & DOCS',
    icon: 'BookOpen'
  },
  {
    id: 'gdocs',
    name: 'Google Docs',
    description: 'Allow agents to reference and summarize documents.',
    status: 'DISCONNECTED',
    category: 'PRODUCTIVITY & DOCS',
    icon: 'FileText'
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Track project progress and issue statuses.',
    status: 'DISCONNECTED',
    category: 'PROJECT MANAGEMENT',
    icon: 'Trello'
  },
  {
    id: 'asana',
    name: 'Asana',
    description: 'Keep your tasks and projects in sync with Sydney.',
    status: 'DISCONNECTED',
    category: 'PROJECT MANAGEMENT',
    icon: 'CheckSquare'
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Monitor repositories, issues, and pull requests.',
    status: 'DISCONNECTED',
    category: 'DEVELOPER TOOLS',
    icon: 'Github'
  },
  {
    id: 'gdrive',
    name: 'Google Drive',
    description: 'Access your cloud files and resources.',
    status: 'DISCONNECTED',
    category: 'STORAGE & FILES',
    icon: 'HardDrive'
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Keep your digital media synchronized.',
    status: 'DISCONNECTED',
    category: 'STORAGE & FILES',
    icon: 'FolderOpen'
  }
];
