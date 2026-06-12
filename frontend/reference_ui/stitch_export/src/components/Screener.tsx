/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Calendar,
  MessageSquare,
  ArrowLeft,
  Settings,
  Plus,
  Sparkles,
  Inbox,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronRight,
  Search,
  Send,
  Check,
  Loader2,
  Key,
  Lock,
  Eye,
  EyeOff,
  User,
  Sliders,
  Globe,
  Layers,
  BookOpen,
  FileText,
  Trello,
  CheckSquare,
  Github,
  HardDrive,
  FolderOpen,
  Bell
} from 'lucide-react';
import { ScreenId, TransitionType, Agent, Message, Connector, AgentConfig } from '../types';
import { INITIAL_AGENTS, SC_MESSAGES, INITIAL_CONNECTORS } from '../data';

interface ScreenerProps {
  currentScreen: ScreenId;
  previousScreen: ScreenId | null;
  transitionType: TransitionType;
  setNavigation: (target: ScreenId, transition: TransitionType) => void;
}

export default function Screener({
  currentScreen,
  previousScreen,
  transitionType,
  setNavigation
}: ScreenerProps) {
  // Shared States/Customizations for Simulation UI
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [messages, setMessages] = useState<Message[]>(SC_MESSAGES);
  const [connectors, setConnectors] = useState<Connector[]>(INITIAL_CONNECTORS);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create / Edit agent configurations
  const [newAgentConfig, setNewAgentConfig] = useState<AgentConfig>({
    sentence: 'Watch my customer escalations and brief me each morning.',
    connectedTools: ['Gmail', 'Google Calendar'],
    responseTiming: 'real-time',
    responseLimit: 'balanced',
    activeUntil: 'June 30, 2026',
    runIndefinitely: false
  });

  // User input message state for thread
  const [replyInput, setReplyInput] = useState('');

  // Password visibility states
  const [showSignInPass, setShowSignInPass] = useState(false);
  const [showCreatePass, setShowCreatePass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // States for interactive connector creation draft
  const [selectedConnectorCategory, setSelectedConnectorCategory] = useState('EMAIL & COMMUNICATION');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Animation Variant Helpers based on Slide push types
  const getVariants = () => {
    if (transitionType === 'push') {
      return {
        initial: { x: '100%', opacity: 0.9 },
        animate: { x: 0, opacity: 1 },
        exit: { x: '-100%', opacity: 0.9 }
      };
    }
    if (transitionType === 'push_back') {
      return {
        initial: { x: '-100%', opacity: 0.9 },
        animate: { x: 0, opacity: 1 },
        exit: { x: '100%', opacity: 0.9 }
      };
    }
    if (transitionType === 'slide_up') {
      return {
        initial: { y: '100%', opacity: 0.9 },
        animate: { y: 0, opacity: 1 },
        exit: { y: '100%', opacity: 0.4 }
      };
    }
    // 'none' or default transition variant
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 }
    };
  };

  const currentVariants = getVariants();

  // Helper inside New Agent to toggle tools inline
  const toggleTool = (toolName: string) => {
    if (newAgentConfig.connectedTools.includes(toolName)) {
      setNewAgentConfig({
        ...newAgentConfig,
        connectedTools: newAgentConfig.connectedTools.filter(t => t !== toolName)
      });
    } else {
      setNewAgentConfig({
        ...newAgentConfig,
        connectedTools: [...newAgentConfig.connectedTools, toolName]
      });
    }
  };

  // Helper inside Thread to submit new agent simulated message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim()) return;
    
    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: replyInput
    };

    setMessages(prev => [...prev, userMsg]);
    setReplyInput('');

    // Simulate Agent Thinking / Processing & Output response dynamically
    setTimeout(() => {
      const thinkingMsg: Message = {
        id: `msg-thinking-${Date.now()}`,
        sender: 'system',
        text: 'Scouting network, evaluating incoming parameters...'
      };
      setMessages(prev => [...prev, thinkingMsg]);

      setTimeout(() => {
        const agentReply: Message = {
          id: `msg-agent-${Date.now()}`,
          sender: 'agent',
          text: `Processed instructions: '${userMsg.text}'. Based on your Connected Tools, I identified relevant items matching this pattern.`,
          subContent: {
            title: 'Dynamic Agent Insights',
            description: `Auto-analysis matching query filters. Filtered logs successfully.`,
            metrics: [
              { label: 'SOURCES ANALYZED', value: '14' },
              { label: 'RELEVANCE LEVEL', value: 'High' },
              { label: 'CONFIDENCE', value: '98%' }
            ]
          }
        };
        setMessages(prev => prev.filter(m => m.id !== thinkingMsg.id).concat(agentReply));
      }, 1200);

    }, 600);
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-background text-on-background select-none font-sans">
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={currentScreen}
          variants={currentVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: transitionType === 'none' ? 0 : 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="w-full h-full flex flex-col overflow-y-auto"
        >
          {/* ========================================================= */}
          {/* 1. SYDNEY SIGN IN - PREMIUM REFACTOR                       */}
          {/* ========================================================= */}
          {currentScreen === 'sydney-signin' && (
            <div className="flex-1 flex flex-col justify-between px-6 py-10 w-full max-w-md mx-auto">
              <div className="flex-1 flex flex-col justify-center my-auto">
                <div className="flex flex-col items-center mb-8">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-xs border border-line mb-4 overflow-hidden">
                    <img
                      alt="Sydney Logo"
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 object-contain"
                      src="https://lh3.googleusercontent.com/aida/AP1WRLveLAeaAz87J_Hn1xgVHPqZ-xI0IfCKstFZiS9U7qN4OA_Gu69fGcsDm7RtCJrUnJutuYHs3D0eZfHxdx2o845RQtsfoec6KB4CJX6ZzVDjKov8DxgEHH6LoWSqduekO3EGf-ErRHlDCVNHGZgAJbeKE8B8SDery4qV_KjCO5gsDI-r-s1APeisLdH_QIVWo_eswzQXCZnZO8pfKdutyFFxGY4flEomqqW-tS1sw5eZjj94PZLQo_LoHEY7"
                    />
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-on-surface mb-2 font-sans text-center">Welcome back</h1>
                  <p className="text-sm font-normal text-muted-ink text-center max-w-xs">
                    Delegate work through conversations with agents you trust.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Email Input */}
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5 ml-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                        <Mail size={18} />
                      </span>
                      <input
                        type="email"
                        defaultValue="user@session.local"
                        placeholder="Email Address"
                        className="w-full h-12 pl-11 pr-4 bg-white border border-line rounded-xl text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5 ml-1">
                      Password
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                        <Lock size={18} />
                      </span>
                      <input
                        type={showSignInPass ? 'text' : 'password'}
                        defaultValue="sydneysafepass"
                        placeholder="Password"
                        className="w-full h-12 pl-11 pr-11 bg-white border border-line rounded-xl text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignInPass(!showSignInPass)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                      >
                        {showSignInPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <span className="text-xs font-bold text-muted-ink hover:text-primary cursor-pointer transition-colors">
                      Forgot Password?
                    </span>
                  </div>

                  {/* Sign In Trigger Button */}
                  <button
                    onClick={() => setNavigation('sydney-inbox', 'push')}
                    className="w-full h-13 bg-primary text-on-primary rounded-xl font-bold text-sm tracking-wide shadow-xs hover:bg-primary-container active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
                  >
                    <span>Sign In</span>
                  </button>

                  {/* Google OAuth alternative */}
                  <div className="flex items-center my-6">
                    <div className="flex-1 h-px bg-line"></div>
                    <span className="px-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">or</span>
                    <div className="flex-1 h-px bg-line"></div>
                  </div>

                  <button
                    onClick={() => setNavigation('sydney-inbox', 'push')}
                    className="w-full h-12 bg-white border border-line text-on-surface rounded-xl font-bold text-sm shadow-xs hover:bg-surface-container-low active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#EA4335"
                        d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.203-3.085C18.28 1.43 15.43.8 12.24.8c-6.19 0-11.2 5.01-11.2 11.2s5.01 11.2 11.2 11.2c6.46 0 10.76-4.54 10.76-10.92 0-74-.08-1.195-.08-1.195H12.24z"
                      />
                    </svg>
                    <span>Sign in with Google</span>
                  </button>
                </div>
              </div>

              {/* No account link trigger */}
              <div className="mt-8 text-center text-xs">
                <span className="text-on-surface-variant">Don't have an account? </span>
                <button
                  onClick={() => setNavigation('sydney-createaccount', 'push')}
                  className="text-primary font-bold hover:underline underline-offset-2 ml-1"
                >
                  Create one
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. SYDNEY CREATE ACCOUNT - PREMIUM REFACTOR                */}
          {/* ========================================================= */}
          {currentScreen === 'sydney-createaccount' && (
            <div className="flex-1 flex flex-col justify-between px-6 py-8 w-full max-w-md mx-auto">
              <div className="flex-1 flex flex-col justify-center">
                <div className="flex flex-col items-center mb-6">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-xs border border-line mb-4 overflow-hidden">
                    <img
                      alt="Sydney Logo"
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 object-contain"
                      src="https://lh3.googleusercontent.com/aida/AP1WRLveLAeaAz87J_Hn1xgVHPqZ-xI0IfCKstFZiS9U7qN4OA_Gu69fGcsDm7RtCJrUnJutuYHs3D0eZfHxdx2o845RQtsfoec6KB4CJX6ZzVDjKov8DxgEHH6LoWSqduekO3EGf-ErRHlDCVNHGZgAJbeKE8B8SDery4qV_KjCO5gsDI-r-s1APeisLdH_QIVWo_eswzQXCZnZO8pfKdutyFFxGY4flEomqqW-tS1sw5eZjj94PZLQo_LoHEY7"
                    />
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-on-surface mb-2 font-sans text-center">Create Account</h1>
                  <p className="text-sm font-normal text-muted-ink text-center max-w-xs">
                    Delegate work through conversations with agents you trust.
                  </p>
                </div>

                <div className="space-y-3.5">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 ml-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                        <User size={18} />
                      </span>
                      <input
                        type="text"
                        placeholder="Enter your full name"
                        className="w-full h-11 pl-11 pr-4 bg-white border border-line rounded-xl text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 ml-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                        <Mail size={18} />
                      </span>
                      <input
                        type="email"
                        placeholder="Enter your email..."
                        className="w-full h-11 pl-11 pr-4 bg-white border border-line rounded-xl text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 ml-1">
                      Password
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                        <Lock size={18} />
                      </span>
                      <input
                        type={showCreatePass ? 'text' : 'password'}
                        placeholder="••••••••••••••••"
                        className="w-full h-11 pl-11 pr-11 bg-white border border-line rounded-xl text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCreatePass(!showCreatePass)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                      >
                        {showCreatePass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Password Confirmation */}
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 ml-1">
                      Password Confirmation
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                        <Key size={18} />
                      </span>
                      <input
                        type={showConfirmPass ? 'text' : 'password'}
                        placeholder="••••••••••••••••"
                        className="w-full h-11 pl-11 pr-11 bg-white border border-line rounded-xl text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                      >
                        {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Submit create account trigger */}
                  <button
                    onClick={() => setNavigation('sydney-inbox', 'push')}
                    className="w-full h-12 mt-2 bg-primary text-on-primary rounded-xl font-bold text-sm tracking-wide shadow-xs hover:bg-primary-container active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <span>Create Account</span>
                  </button>

                  <div className="flex items-center my-4">
                    <div className="flex-1 h-px bg-line"></div>
                    <span className="px-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">or</span>
                    <div className="flex-1 h-px bg-line"></div>
                  </div>

                  <button
                    onClick={() => setNavigation('sydney-inbox', 'push')}
                    className="w-full h-11 bg-white border border-line text-on-surface rounded-xl font-bold text-sm shadow-xs hover:bg-surface-container-low active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#EA4335"
                        d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.203-3.085C18.28 1.43 15.43.8 12.24.8c-6.19 0-11.2 5.01-11.2 11.2s5.01 11.2 11.2 11.2c6.46 0 10.76-4.54 10.76-10.92 0-74-.08-1.195-.08-1.195H12.24z"
                      />
                    </svg>
                    <span>Sign in with Google</span>
                  </button>
                </div>
              </div>

              {/* Already have an account trigger */}
              <div className="mt-8 text-center text-xs">
                <span className="text-on-surface-variant">Already have an account? </span>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setNavigation('sydney-signin', 'push_back');
                  }}
                  className="text-primary font-bold hover:underline underline-offset-2 ml-1"
                >
                  Sign in
                </a>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. SYDNEY INBOX - PREMIUM REFACTOR                        */}
          {/* ========================================================= */}
          {currentScreen === 'sydney-inbox' && (
            <div className="flex-1 flex flex-col justify-between h-full relative">
              {/* Top Navigation */}
              <div className="px-6 py-4 border-b border-line bg-surface flex items-center justify-between sticky top-0 z-10">
                <h1 className="text-xl font-bold tracking-tight text-on-surface font-sans">Sydney</h1>
                <div className="flex items-center gap-2">
                  {/* Sync hub indicator button */}
                  <button
                    onClick={() => setNavigation('connectors-advanced', 'none')}
                    className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors flex items-center gap-1"
                    title="Hub Status"
                  >
                    <Globe size={20} className="text-primary" />
                    <span className="hidden">hub</span>
                  </button>
                  {/* Settings gear block */}
                  <button
                    onClick={() => setNavigation('settings', 'none')}
                    className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors flex items-center gap-1"
                    title="Settings"
                  >
                    <Settings size={20} />
                    <span className="hidden">settings</span>
                  </button>
                </div>
              </div>

              {/* Body Area */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Assistant is pinned notification banner */}
                <div className="bg-surface-container-low text-xs border border-line py-3 px-4 rounded-xl flex items-center gap-2.5 text-on-surface-variant">
                  <Info size={16} className="text-primary shrink-0" />
                  <span>Assistant is pinned so you always have a place to start.</span>
                </div>

                {/* Agents List */}
                <div className="space-y-2.5">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="bg-white border border-line rounded-xl p-4 flex items-start gap-3.5 hover:shadow-xs hover:border-outline-variant transition-all cursor-pointer relative"
                      onClick={() => {
                        if (agent.id === 'research-scout') {
                          setNavigation('sydney-thread', 'push');
                        }
                      }}
                    >
                      {/* Avatar initial circle */}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm uppercase shrink-0 ${agent.avatarBg}`}>
                        {agent.avatarText}
                      </div>

                      {/* Content block */}
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-baseline justify-between mb-0.5">
                          {/* Agent Name button containing Research Scout */}
                          {agent.id === 'research-scout' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setNavigation('sydney-thread', 'push');
                              }}
                              className="font-bold text-sm text-on-surface text-left hover:text-primary transition-colors focus:outline-none"
                            >
                              {agent.name}
                            </button>
                          ) : (
                            <h3 className="font-bold text-sm text-on-surface">{agent.name}</h3>
                          )}
                          <span className="text-[11px] text-muted-ink whitespace-nowrap">{agent.lastMessageTime}</span>
                        </div>
                        <p className="text-xs text-on-surface-variant truncate font-normal leading-relaxed">
                          {agent.lastMessage}
                        </p>
                      </div>

                      {/* Online and Pinned indicators */}
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {agent.isPinned && (
                          <svg className="w-4 h-4 text-outline" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                          </svg>
                        )}
                        {agent.isActive && (
                          <span className="w-2.5 h-2.5 bg-primary rounded-full ring-4 ring-primary-soft"></span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Aesthetic Call to Action */}
                <div className="py-8 text-center max-w-xs mx-auto">
                  <h4 className="text-sm font-bold text-on-surface mb-1">Start with one sentence</h4>
                  <p className="text-xs text-muted-ink leading-relaxed font-normal">
                    Create an agent for something you want watched, summarized, or prepared.
                  </p>
                </div>
              </div>

              {/* FLOATING ACTION BUTTON (New Agent Trigger) */}
              <div className="absolute right-5 bottom-20 z-20">
                <button
                  onClick={() => setNavigation('new-agent', 'slide_up')}
                  className="bg-primary text-on-primary font-bold px-4 py-3 rounded-xl shadow-lg hover:bg-primary-container active:scale-95 transition-all flex items-center gap-2 tracking-wide"
                >
                  <Plus size={20} />
                  <span>New</span>
                  <span className="hidden">add</span>
                </button>
              </div>

              {/* Premium Persistent Bottom Bar */}
              <div className="h-14 border-t border-line bg-surface-container-lowest grid grid-cols-4 items-center px-4 sticky bottom-0 z-10">
                {/* Inbox tab */}
                <button
                  onClick={() => setNavigation('sydney-inbox', 'none')}
                  className="flex flex-col items-center justify-center text-primary"
                  title="Inbox"
                >
                  <Inbox size={20} />
                  <span className="text-[10px] font-bold mt-1">Inbox</span>
                </button>

                {/* Workspace Hub toggle */}
                <button
                  onClick={() => setNavigation('connectors-advanced', 'none')}
                  className="flex flex-col items-center justify-center text-outline hover:text-on-surface"
                  title="Connectors"
                >
                  <Globe size={20} />
                  <span className="text-[10px] font-medium mt-1">Connectors</span>
                </button>

                {/* Interactive Status Metrics */}
                <button
                  onClick={() => setNavigation('sydney-thread', 'push')}
                  className="flex flex-col items-center justify-center text-outline hover:text-on-surface"
                  title="Active Scout"
                >
                  <Sparkles size={20} />
                  <span className="text-[10px] font-medium mt-1">Scout</span>
                </button>

                {/* Setup settings gear */}
                <button
                  onClick={() => setNavigation('settings', 'none')}
                  className="flex flex-col items-center justify-center text-outline hover:text-on-surface"
                  title="Settings"
                >
                  <Settings size={20} />
                  <span className="text-[10px] font-medium mt-1">Settings</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. SYDNEY THREAD - PREMIUM REFACTOR                       */}
          {/* ========================================================= */}
          {currentScreen === 'sydney-thread' && (
            <div className="flex-1 flex flex-col justify-between h-full relative bg-surface-bright">
              {/* Header block */}
              <div className="px-5 py-3 border-b border-line bg-white flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setNavigation('sydney-inbox', 'push_back')}
                    className="p-1 px-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors flex items-center"
                  >
                    <ArrowLeft size={18} />
                    <span className="hidden">arrow_back</span>
                  </button>
                  <div className="w-8 h-8 rounded-lg bg-blue-800 text-white font-bold text-xs uppercase flex items-center justify-center">
                    RS
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-on-surface hover:text-primary">Research Scout</h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0"></span>
                      <span className="text-[10px] text-primary font-bold tracking-wider uppercase">Active</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setNavigation('connectors-advanced', 'none')}
                    className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors flex items-center"
                  >
                    <Globe size={18} className="text-primary animate-pulse" />
                    <span className="hidden">hub</span>
                  </button>
                  <button
                    onClick={() => setNavigation('agent-preferences', 'push')}
                    className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors flex items-center"
                  >
                    <Settings size={18} />
                    <span className="hidden">settings</span>
                  </button>
                </div>
              </div>

              {/* Messaging Flow messages list wrapper */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Fixed time header */}
                <div className="text-center">
                  <span className="text-[10px] font-bold text-muted-ink uppercase tracking-widest bg-surface-container px-2.5 py-1 rounded-full">
                    Today
                  </span>
                </div>

                <AnimatePresence initial={false}>
                  {messages.map((msg, index) => {
                    if (msg.sender === 'system') {
                      return (
                        <div key={msg.id || index} className="flex justify-center my-2">
                          <div className="bg-system-bubble text-on-surface-variant border border-line px-4 py-2.5 rounded-xl max-w-xs flex items-start gap-2.5 shadow-2xs">
                            <Info size={16} className="text-info shrink-0 mt-0.5" />
                            <span className="text-[11px] font-medium leading-relaxed">
                              {msg.text}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    const isUser = msg.sender === 'user';
                    return (
                      <div
                        key={msg.id || index}
                        className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[82%] relative flex flex-col p-4 shadow-2xs ${
                            isUser
                              ? 'bg-user-bubble text-ink rounded-2xl rounded-br-2xs'
                              : 'bg-agent-bubble text-on-surface border border-line rounded-2xl rounded-bl-2xs'
                          }`}
                        >
                          <p className="text-sm font-normal leading-relaxed mb-1.5">{msg.text}</p>
                          
                          {/* Inner custom state metrics block */}
                          {msg.subContent && (
                            <div className="mt-3 pt-3 border-t border-line/70 space-y-3">
                              <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
                                <CheckCircle2 size={16} />
                                <span>READY</span>
                              </div>
                              <div className="border border-line rounded-xl p-3 bg-surface-container-lowest">
                                <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                                  {msg.subContent.title}
                                </h4>
                                <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
                                  {msg.subContent.description}
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                  {msg.subContent.metrics.map((met, mi) => (
                                    <div key={mi} className="bg-surface border border-line/60 rounded-lg p-2 text-center">
                                      <span className="block text-[8px] font-bold text-on-surface-variant uppercase leading-none mb-1">
                                        {met.label}
                                      </span>
                                      <span className="text-xs font-bold text-on-surface">
                                        {met.value}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Bottom message response sender input bar */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-line bg-white flex items-center gap-3 sticky bottom-0 z-10">
                <input
                  type="text"
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  placeholder="Message agent"
                  className="flex-1 h-12 px-4 border border-line rounded-xl text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline bg-surface-container-low"
                />
                <button
                  type="submit"
                  className="w-12 h-12 bg-primary text-on-primary rounded-xl flex items-center justify-center hover:bg-primary-container active:scale-95 transition-all shrink-0 shadow-xs"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. AGENT PREFERENCES                                      */}
          {/* ========================================================= */}
          {currentScreen === 'agent-preferences' && (
            <div className="flex-1 flex flex-col justify-between h-full relative bg-surface-bright">
              {/* Header block */}
              <div className="px-5 py-4 border-b border-line bg-white flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setNavigation('sydney-thread', 'push_back')}
                    aria-label="Go back"
                    className="p-1 px-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <h2 className="font-bold text-base text-on-surface">Agent Preferences</h2>
                </div>
              </div>

              {/* Body form contents */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                <p className="text-xs text-muted-ink leading-relaxed">
                  Configure how this agent processes information and communicates with you.
                </p>

                {/* Card 1: Response Timing Option box selection */}
                <div className="bg-white border border-line rounded-xl p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <Sliders size={18} />
                    <span>Response Timing</span>
                  </div>
                  <p className="text-[11px] text-muted-ink">
                    Select when the agent should deliver updates or actions.
                  </p>

                  <div className="space-y-2">
                    {/* Option real-time */}
                    <div
                      onClick={() => setNewAgentConfig({ ...newAgentConfig, responseTiming: 'real-time' })}
                      className={`border p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                        newAgentConfig.responseTiming === 'real-time' ? 'border-primary bg-primary-soft/40' : 'border-line hover:border-outline-variant'
                      }`}
                    >
                      <div>
                        <h4 className="text-xs font-bold text-on-surface">Real-time</h4>
                        <p className="text-[10px] text-on-surface-variant mt-0.5">Immediate notification on every action</p>
                      </div>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        newAgentConfig.responseTiming === 'real-time' ? 'border-primary bg-primary' : 'border-outline'
                      }`}>
                        {newAgentConfig.responseTiming === 'real-time' && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                      </span>
                    </div>

                    {/* Option daily */}
                    <div
                      onClick={() => setNewAgentConfig({ ...newAgentConfig, responseTiming: 'daily' })}
                      className={`border p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                        newAgentConfig.responseTiming === 'daily' ? 'border-primary bg-primary-soft/40' : 'border-line hover:border-outline-variant'
                      }`}
                    >
                      <div>
                        <h4 className="text-xs font-bold text-on-surface">Daily Summary</h4>
                        <p className="text-[10px] text-on-surface-variant mt-0.5">A consolidated digest at a set time</p>
                      </div>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        newAgentConfig.responseTiming === 'daily' ? 'border-primary bg-primary' : 'border-outline'
                      }`}>
                        {newAgentConfig.responseTiming === 'daily' && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Response Limit Slider */}
                <div className="bg-white border border-line rounded-xl p-4 space-y-4 shadow-2xs">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <Layers size={18} />
                    <span>Response Limit</span>
                  </div>
                  <p className="text-[11px] text-muted-ink">
                    Adjust the verbosity of the agent's output.
                  </p>

                  <div className="pt-2">
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="1"
                      value={newAgentConfig.responseLimit === 'concise' ? 1 : newAgentConfig.responseLimit === 'balanced' ? 2 : 3}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setNewAgentConfig({
                          ...newAgentConfig,
                          responseLimit: val === 1 ? 'concise' : val === 2 ? 'balanced' : 'detailed'
                        });
                      }}
                      className="w-full accent-primary pointer-events-auto cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-on-surface-variant font-bold mt-2 px-1">
                      <span className={newAgentConfig.responseLimit === 'concise' ? 'text-primary' : ''}>Concise</span>
                      <span className={newAgentConfig.responseLimit === 'balanced' ? 'text-primary' : ''}>Balanced</span>
                      <span className={newAgentConfig.responseLimit === 'detailed' ? 'text-primary' : ''}>Detailed</span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Active Limits Dates */}
                <div className="bg-white border border-line rounded-xl p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <Calendar size={18} />
                    <span>Active Until</span>
                  </div>
                  <p className="text-[11px] text-muted-ink">
                    Set an expiration date for this agent's active duties.
                  </p>

                  <div className="relative">
                    <input
                      type="text"
                      disabled={newAgentConfig.runIndefinitely}
                      value={newAgentConfig.runIndefinitely ? 'Unlimited' : newAgentConfig.activeUntil}
                      onChange={(e) => setNewAgentConfig({ ...newAgentConfig, activeUntil: e.target.value })}
                      className="w-full h-11 px-4 bg-surface-container border border-line rounded-xl text-xs font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                    <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant" />
                  </div>

                  <label className="flex items-center gap-2.5 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAgentConfig.runIndefinitely}
                      onChange={(e) => setNewAgentConfig({ ...newAgentConfig, runIndefinitely: e.target.checked })}
                      className="rounded border-line text-primary focus:ring-primary"
                    />
                    <span className="text-xs text-on-surface-variant font-medium">Run indefinitely</span>
                  </label>
                </div>
              </div>

              {/* Bottom Actions for Save preferences */}
              <div className="p-4 border-t border-line bg-white sticky bottom-0 z-10">
                <button
                  onClick={() => setNavigation('sydney-thread', 'push_back')}
                  className="w-full h-12 bg-primary text-on-primary rounded-xl font-bold text-sm shadow-xs hover:bg-primary-container active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <CheckSquare size={18} />
                  <span>Save Preferences</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. NEW AGENT - WITH CONNECTED TOOLS                        */}
          {/* ========================================================= */}
          {currentScreen === 'new-agent' && (
            <div className="flex-1 flex flex-col justify-between h-full relative bg-surface-bright">
              {/* Header block */}
              <div className="px-5 py-4 border-b border-line bg-white flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setNavigation('sydney-inbox', 'push_back')}
                    aria-label="Go back"
                    className="p-1 px-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <h2 className="font-bold text-base text-on-surface">New Agent</h2>
                </div>
              </div>

              {/* Body Contents */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {/* Visual Avatar Header block icon with robot */}
                <div className="flex flex-col items-center py-2">
                  <div className="w-16 h-16 rounded-2xl bg-primary-soft/70 border border-line flex items-center justify-center relative">
                    <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="10" rx="2" />
                      <path d="M12 2v4M8 5h8M12 11V9" />
                      <circle cx="8" cy="15" r="1" />
                      <circle cx="16" cy="15" r="1" />
                    </svg>
                    <div className="absolute -top-1 -right-1 bg-white border border-line text-primary rounded-full p-0.5">
                      <Plus size={14} />
                    </div>
                  </div>
                </div>

                {/* Textarea Area for What should this agent handle? */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-on-surface uppercase tracking-wider ml-1">
                    What should this agent handle?
                  </label>
                  <div className="relative border border-line rounded-xl bg-white p-3 focus-within:border-primary transition-all">
                    <textarea
                      rows={3}
                      value={newAgentConfig.sentence}
                      onChange={(e) => setNewAgentConfig({ ...newAgentConfig, sentence: e.target.value })}
                      placeholder="Write one sentence to describe what the agent should do..."
                      className="w-full text-sm text-on-surface bg-transparent border-none focus:outline-none resize-none leading-relaxed placeholder:text-outline-variant pr-10"
                    />
                    <div className="absolute right-3 bottom-3 flex items-center gap-2">
                      <button type="button" className="p-1.5 bg-surface-container hover:bg-surface-container-high rounded-lg text-outline-variant hover:text-on-surface transition-colors">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="4" y="2" width="16" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
                          <circle cx="12" cy="14" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
                          <line x1="12" y1="5" x2="12" y2="9" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      </button>
                      <button type="button" className="p-1.5 bg-primary text-on-primary rounded-lg shadow-xs hover:bg-primary-container transition-all">
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Connected Tools section block with additive button */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-on-surface uppercase tracking-wider ml-1">
                      Connected Tools
                    </label>
                    <button
                      onClick={() => setNavigation('connectors-advanced', 'push')}
                      className="text-xs text-primary font-bold flex items-center gap-1 hover:underline underline-offset-2"
                    >
                      Manage
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div
                      onClick={() => toggleTool('Gmail')}
                      className={`px-3 py-2 border rounded-xl text-xs font-bold font-sans flex items-center gap-2 cursor-pointer select-none transition-all ${
                        newAgentConfig.connectedTools.includes('Gmail')
                          ? 'bg-primary-soft text-primary border-primary'
                          : 'bg-white text-on-surface-variant border-line hover:border-outline-variant'
                      }`}
                    >
                      <Mail size={14} />
                      <span>Gmail</span>
                    </div>

                    <div
                      onClick={() => toggleTool('Google Calendar')}
                      className={`px-3 py-2 border rounded-xl text-xs font-bold font-sans flex items-center gap-2 cursor-pointer select-none transition-all ${
                        newAgentConfig.connectedTools.includes('Google Calendar')
                          ? 'bg-primary-soft text-primary border-primary'
                          : 'bg-white text-on-surface-variant border-line hover:border-outline-variant'
                      }`}
                    >
                      <Calendar size={14} />
                      <span>Google Calendar</span>
                    </div>

                    {/* Add Button trigger */}
                    <button
                      onClick={() => setNavigation('connectors-advanced', 'push')}
                      className="px-3 py-2 bg-white border border-dashed border-outline-variant rounded-xl text-xs font-medium text-primary hover:text-primary-container hover:border-primary transition-all flex items-center gap-1"
                    >
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Common capabilities pills block */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-on-surface uppercase tracking-wider ml-1">
                    Common capabilities
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    <span className="px-3 py-1.5 bg-surface-container-low text-xs text-on-surface-variant rounded-full border border-line font-medium hover:border-primary transition-colors cursor-pointer">
                      Summarize
                    </span>
                    <span className="px-3 py-1.5 bg-surface-container-low text-xs text-on-surface-variant rounded-full border border-line font-medium hover:border-primary transition-colors cursor-pointer">
                      Track progress
                    </span>
                    <span className="px-3 py-1.5 bg-surface-container-low text-xs text-on-surface-variant rounded-full border border-line font-medium hover:border-primary transition-colors cursor-pointer">
                      Flag urgency
                    </span>
                    <span className="px-3 py-1.5 bg-surface-container-low text-xs text-on-surface-variant rounded-full border border-line font-medium hover:border-primary transition-colors cursor-pointer">
                      Checklist
                    </span>
                  </div>
                </div>

                {/* Agent Preferences Timing toggle */}
                <div className="bg-white border border-line rounded-xl p-4 space-y-3.5 shadow-2xs mt-1">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                    <Sliders size={16} />
                    <span>Response Timing</span>
                  </div>

                  <div className="space-y-2">
                    <div
                      onClick={() => setNewAgentConfig({ ...newAgentConfig, responseTiming: 'real-time' })}
                      className={`border p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                        newAgentConfig.responseTiming === 'real-time' ? 'border-primary bg-primary-soft/20' : 'border-line'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          newAgentConfig.responseTiming === 'real-time' ? 'border-primary' : 'border-outline'
                        }`}>
                          {newAgentConfig.responseTiming === 'real-time' && <span className="w-2 h-2 bg-primary rounded-full"></span>}
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-on-surface">Real-time</h4>
                          <p className="text-[10px] text-muted-ink mt-0.5">Get updates as soon as they happen</p>
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => setNewAgentConfig({ ...newAgentConfig, responseTiming: 'daily' })}
                      className={`border p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                        newAgentConfig.responseTiming === 'daily' ? 'border-primary bg-primary-soft/20' : 'border-line'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          newAgentConfig.responseTiming === 'daily' ? 'border-primary' : 'border-outline'
                        }`}>
                          {newAgentConfig.responseTiming === 'daily' && <span className="w-2 h-2 bg-primary rounded-full"></span>}
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-on-surface">Daily Summary</h4>
                          <p className="text-[10px] text-muted-ink mt-0.5">Get summaries compiled daily</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions Submit */}
              <div className="p-4 border-t border-line bg-white sticky bottom-0 z-10 flex gap-3">
                <button
                  type="button"
                  onClick={() => setNavigation('sydney-inbox', 'push_back')}
                  className="flex-1 h-12 bg-white border border-line text-on-surface hover:bg-surface rounded-xl font-bold text-sm transition-all text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setNavigation('confirm-agent', 'push')}
                  className="flex-1 h-12 bg-primary text-on-primary rounded-xl font-bold text-sm shadow-xs hover:bg-primary-container active:scale-95 transition-all text-center flex items-center justify-center"
                >
                  Submit
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 7. CONFIRM AGENT - PREMIUM REFACTOR                        */}
          {/* ========================================================= */}
          {currentScreen === 'confirm-agent' && (
            <div className="flex-1 flex flex-col justify-between h-full relative bg-surface-bright">
              {/* Header block */}
              <div className="px-5 py-4 border-b border-line bg-white flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setNavigation('new-agent', 'push_back')}
                    aria-label="Go back"
                    className="p-1 px-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <h2 className="font-bold text-base text-on-surface">Confirm</h2>
                </div>
              </div>

              {/* Body Content Info cards */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Main Avatar and Description Sentence Card */}
                <div className="bg-white border border-line rounded-xl p-5 text-center space-y-3.5 shadow-2xs">
                  <div className="w-12 h-12 rounded-full bg-primary-soft text-primary font-bold text-sm uppercase flex items-center justify-center mx-auto">
                    M
                  </div>
                  <h3 className="font-bold text-base text-on-surface font-sans">Meeting Prep</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed font-normal">
                    "Summarize the key points from recent meetings and prepare a draft agenda for tomorrow."
                  </p>
                </div>

                {/* Analysis detail blocks */}
                <div className="space-y-3">
                  {/* Card 1: What it does code */}
                  <div className="bg-white border border-line rounded-xl p-4 space-y-2 shadow-2xs">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      <span>What it does</span>
                    </div>
                    <ul className="list-disc list-inside text-xs text-on-surface-variant space-y-1.5 pl-1 leading-relaxed">
                      <li>Reviews recent calendar events</li>
                      <li>Extracts key discussion points</li>
                      <li>Drafts a structured agenda for upcoming meetings</li>
                    </ul>
                  </div>

                  {/* Card 2: When it runs */}
                  <div className="bg-white border border-line rounded-xl p-4 space-y-2 shadow-2xs">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      <span>When it runs</span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Whenever you message it
                    </p>
                  </div>

                  {/* Card 3: What it needs tags */}
                  <div className="bg-white border border-line rounded-xl p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>What it needs</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2.5 py-1 bg-surface border border-line text-on-surface-variant font-bold text-[10px] rounded-lg flex items-center gap-1 uppercase tracking-wide">
                        <Calendar size={12} />
                        Calendar Access
                      </span>
                      <span className="px-2.5 py-1 bg-surface border border-line text-on-surface-variant font-bold text-[10px] rounded-lg flex items-center gap-1 uppercase tracking-wide">
                        <FileText size={12} />
                        Notes Access
                      </span>
                    </div>
                  </div>

                  {/* Card 4: What it sends */}
                  <div className="bg-white border border-line rounded-xl p-4 space-y-2 shadow-2xs">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                      <Send size={14} />
                      <span>What it sends</span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed font-normal">
                      A draft agenda and summary message
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom actionable panels container split */}
              <div className="p-4 border-t border-line bg-white sticky bottom-0 z-10 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setNavigation('sydney-inbox', 'push')}
                  className="w-full h-12 bg-primary text-on-primary rounded-xl font-bold text-sm tracking-wide shadow-xs hover:bg-primary-container active:scale-95 transition-all flex items-center justify-center"
                >
                  Create agent
                </button>
                <button
                  type="button"
                  onClick={() => setNavigation('new-agent', 'push_back')}
                  className="w-full h-11 bg-white border border-line text-on-surface hover:bg-surface rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center text-center"
                >
                  Edit sentence
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 8. CONNECTORS - ADVANCED INTEGRATED FLOW                   */}
          {/* ========================================================= */}
          {currentScreen === 'connectors-advanced' && (
            <div className="flex-1 flex flex-col justify-between h-full relative bg-surface-bright">
              {/* Header block */}
              <div className="px-5 py-4 border-b border-line bg-white flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setNavigation('sydney-inbox', 'none')}
                    aria-label="Back"
                    className="p-1 px-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <h2 className="font-bold text-base text-on-surface">Connectors</h2>
                </div>
              </div>

              {/* Body Area connection states */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Description info text */}
                <p className="text-xs text-muted-ink leading-relaxed">
                  Connectors are approved here, but tokens stay with the backend.
                </p>

                {/* Connection lists */}
                <div className="space-y-3">
                  {/* Gmail Integration (CONNECTED) */}
                  <div className="bg-white border border-line rounded-xl p-4 space-y-3.5 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shrink-0">
                        <Mail size={20} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-on-surface leading-tight mb-0.5">Gmail</h4>
                        <p className="text-[10px] text-on-surface-variant leading-relaxed font-normal">
                          Let agents read approved mailbox context through the backend.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-0.5 text-xs text-primary font-bold">
                      <Check size={16} />
                      <span>CONNECTED</span>
                    </div>
                  </div>

                  {/* Google Calendar (OPENING) */}
                  <div className="bg-white border border-line rounded-xl p-4 space-y-3 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <Calendar size={20} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-on-surface leading-tight mb-0.5">Google Calendar</h4>
                        <p className="text-[10px] text-on-surface-variant leading-relaxed font-normal">
                          Use availability and upcoming events when you approve it.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                        <Loader2 size={14} className="animate-spin text-primary" />
                        <span>Opening OAuth</span>
                      </div>
                      <button
                        onClick={() => setNavigation('connectors-categorized', 'none')}
                        className="bg-primary text-on-primary text-xs font-bold px-3 py-1.5 rounded-lg shadow-2xs"
                      >
                        Opening...
                      </button>
                    </div>
                  </div>

                  {/* Slack (CONNECTING) */}
                  <div className="bg-white border border-line rounded-xl p-4 space-y-3 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                        <MessageSquare size={14} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-on-surface leading-tight mb-0.5">Slack</h4>
                        <p className="text-[10px] text-on-surface-variant leading-relaxed font-normal">
                          Watch selected channels and prepare concise updates.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                        <Loader2 size={14} className="animate-spin text-primary" />
                        <span>Connecting...</span>
                      </div>
                      <button className="bg-primary text-on-primary text-xs font-bold px-3 py-1.5 rounded-lg opacity-90 cursor-not-allowed">
                        Connecting...
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Add bar dropdown selector target */}
              <div className="p-4 border-t border-line bg-white sticky bottom-0 z-10 space-y-3">
                <div
                  id="add-connector-dropdown"
                  className="relative rounded-xl border border-line bg-surface p-3.5"
                >
                  {/* div[1] under id("add-connector-dropdown") */}
                  <div className="flex items-center justify-between w-full">
                    {/* div[1]/div[1] */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 bg-primary-soft text-primary rounded-xl flex items-center justify-center shrink-0">
                        <Plus size={20} />
                      </div>
                      <span className="text-xs font-bold text-on-surface">Add new connector</span>
                    </div>

                    {/* div[1]/div[2] */}
                    <div className="flex items-center gap-2">
                      {/* div[1]/div[2]/button[1] */}
                      <button
                        onClick={() => setNavigation('connectors-categorized', 'none')}
                        className="bg-surface-container border border-line hover:border-outline text-on-surface font-bold text-[10px] uppercase px-3 py-1.5 rounded-lg shadow-2xs transition-all"
                      >
                        Connect
                      </button>
                      <div className="flex">
                        <button
                          onClick={() => setNavigation('connectors-categorized', 'none')}
                          className="p-1 px-1.5 text-on-surface-variant hover:bg-surface-container rounded-md transition-colors border"
                          title="Expand connector options"
                        >
                          <span className="sr-only">Toggle Dropdown</span>
                          <ChevronRight size={16} className="rotate-90" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Other... trigger */}
                <button
                  onClick={() => setNavigation('connectors-categorized', 'none')}
                  className="w-full h-11 bg-white border border-line hover:bg-surface text-primary font-bold text-xs tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-1"
                >
                  <span>Other...</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 9. CONNECTORS - CATEGORIZED DIRECTORY                      */}
          {/* ========================================================= */}
          {currentScreen === 'connectors-categorized' && (
            <div className="flex-1 flex flex-col justify-between h-full relative bg-surface-bright">
              {/* Header block with search inputs */}
              <div className="border-b border-line bg-white sticky top-0 z-10">
                <div className="px-5 py-4 flex items-center gap-3">
                  <button
                    onClick={() => setNavigation('connectors-advanced', 'push_back')}
                    aria-label="Go back"
                    className="p-1 px-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <h2 className="font-bold text-base text-on-surface">Add Connector</h2>
                </div>

                {/* Sub search details */}
                <div className="px-5 pb-3">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
                    <input
                      type="text"
                      placeholder="Search connectors..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-10 pl-9 pr-4 bg-surface-container-low border border-line rounded-lg text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Body categorized list list items */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Lists of Categories */}
                {(() => {
                  const itemsByCategory: Record<string, Connector[]> = {};
                  connectors.forEach(item => {
                    if (!itemsByCategory[item.category]) {
                      itemsByCategory[item.category] = [];
                    }
                    itemsByCategory[item.category].push(item);
                  });

                  // Render categories matching searches
                  return Object.entries(itemsByCategory).map(([cat, list]) => {
                    const filtered = list.filter(c =>
                      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      c.description.toLowerCase().includes(searchQuery.toLowerCase())
                    );

                    if (filtered.length === 0) return null;

                    return (
                      <div key={cat} className="space-y-2">
                        <label className="block text-[9px] font-bold text-muted-ink uppercase tracking-widest pl-1">
                          {cat}
                        </label>
                        <div className="space-y-1.5">
                          {filtered.map((conn) => (
                            <button
                              key={conn.id}
                              onClick={() => {
                                // Outlook click behavior -> goes back to connectors-advanced
                                if (conn.name === 'Outlook') {
                                  setNavigation('connectors-advanced', 'push_back');
                                } else {
                                  // toggle state
                                  setConnectors(connectors.map(c => c.id === conn.id ? { ...c, status: c.status === 'CONNECTED' ? 'DISCONNECTED' : 'CONNECTED' } : c));
                                }
                              }}
                              className="w-full text-left bg-white border border-line rounded-xl p-3 flex items-start gap-3 hover:border-outline hover:bg-surface-container-lowest transition-all"
                            >
                              <div className="w-9 h-9 bg-surface border border-line rounded-lg flex items-center justify-center shrink-0">
                                {conn.icon === 'Mail' && <Mail size={16} className="text-red-500" />}
                                {conn.icon === 'Calendar' && <Calendar size={16} className="text-blue-500" />}
                                {conn.icon === 'MessageSquare' && <MessageSquare size={16} className="text-green-500" />}
                                {conn.icon === 'Layers' && <Layers size={16} className="text-indigo-500" />}
                                {conn.icon === 'Clock' && <Sliders size={16} className="text-orange-500" />}
                                {conn.icon === 'BookOpen' && <BookOpen size={16} className="text-amber-600" />}
                                {conn.icon === 'FileText' && <FileText size={16} className="text-sky-500" />}
                                {conn.icon === 'Trello' && <Trello size={16} className="text-purple-500" />}
                                {conn.icon === 'CheckSquare' && <CheckSquare size={16} className="text-emerald-500" />}
                                {conn.icon === 'Github' && <Github size={16} className="text-gray-800" />}
                                {conn.icon === 'HardDrive' && <HardDrive size={16} className="text-blue-600" />}
                                {conn.icon === 'FolderOpen' && <FolderOpen size={16} className="text-yellow-600" />}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-on-surface">{conn.name}</span>
                                  {conn.status === 'CONNECTED' && (
                                    <span className="text-[9px] font-bold text-primary flex items-center gap-0.5">
                                      <Check size={10} /> Active
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-ink leading-relaxed mt-0.5">
                                  {conn.description}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}

                {/* Bottom interactive other connector panel trigger */}
                <div className="pt-2">
                  <button
                    onClick={() => setNavigation('connectors-advanced', 'push_back')}
                    className="w-full h-11 bg-white border border-line hover:bg-surface text-on-surface-variant hover:text-on-surface font-bold text-xs tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Other...</span>
                    <ChevronRight size={14} className="rotate-90" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 10. SETTINGS - PREMIUM REFACTOR                           */}
          {/* ========================================================= */}
          {currentScreen === 'settings' && (
            <div className="flex-1 flex flex-col justify-between h-full relative bg-surface-bright">
              {/* Header block with back controls */}
              <div className="px-5 py-4 border-b border-line bg-white flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setNavigation('sydney-inbox', 'none')}
                    aria-label="Go back"
                    className="p-1 px-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <h2 className="font-bold text-base text-on-surface">Settings</h2>
                </div>
              </div>

              {/* Body preferences inputs lists */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Account Details User Info card */}
                <div className="bg-white border border-line rounded-xl p-4 flex items-center gap-4 shadow-2xs">
                  <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary font-bold text-sm uppercase flex items-center justify-center">
                    AU
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-on-surface">Authenticated User</h3>
                    <p className="text-xs text-muted-ink mt-0.5">user@session.local</p>
                  </div>
                </div>

                {/* Section PREFERENCES */}
                <div className="space-y-1 px-1">
                  <p className="text-[9px] font-bold text-muted-ink uppercase tracking-widest mb-1.5 pl-1">
                    Preferences
                  </p>
                  <div className="bg-white border border-line rounded-xl p-4 flex items-center justify-between shadow-2xs">
                    <div>
                      <h4 className="text-xs font-bold text-on-surface mb-0.5">Push notifications</h4>
                      <p className="text-[10px] text-muted-ink leading-normal">
                        Enable message and agent status alerts.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-outline bg-surface px-2.5 py-1 rounded-full border border-line whitespace-nowrap">
                      Not configured
                    </span>
                  </div>
                </div>

                {/* Section SECURITY with Connectors trigger */}
                <div className="space-y-1.5 px-0.5">
                  <p className="text-[9px] font-bold text-muted-ink uppercase tracking-widest mb-1 pl-1.5_pt-1">
                    Security
                  </p>
                  <button
                    onClick={() => setNavigation('connectors-advanced', 'push')}
                    className="w-full text-left bg-white border border-line rounded-xl p-4 flex items-center justify-between shadow-2xs hover:border-primary transition-all group"
                  >
                    <div>
                      <span className="font-bold text-xs text-on-surface group-hover:text-primary transition-colors block mb-0.5">
                        Connectors
                      </span>
                      <p className="text-[10px] text-muted-ink leading-normal font-normal">
                        Review accounts approved for backend access.
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-outline-variant group-hover:text-on-surface transition-colors" />
                  </button>
                </div>

                {/* Section PRIVACY details */}
                <div className="space-y-1 px-1">
                  <p className="text-[9px] font-bold text-muted-ink uppercase tracking-widest mb-1.5 pl-1 pt-1">
                    Privacy
                  </p>
                  <div className="bg-white border border-line rounded-xl p-4 shadow-2xs">
                    <h4 className="text-xs font-bold text-on-surface mb-0.5">Session storage</h4>
                    <p className="text-[10px] text-muted-ink leading-relaxed">
                      This app stores only your Sydney session token on device. No browser fingerprints or passive scripts are injected.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom actionable panels signout trigger */}
              <div className="p-4 border-t border-line bg-white sticky bottom-0 z-10">
                <button
                  onClick={() => setNavigation('sydney-signin', 'push_back')}
                  className="w-full h-12 bg-white hover:bg-red-50 border border-red-200 hover:border-red-400 text-red-600 rounded-xl font-bold text-sm tracking-wide transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut size={16} />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
