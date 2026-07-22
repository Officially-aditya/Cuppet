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
// States for Sign In Form (Refactor Improvement)
const [email, setEmail] = useState('user@session.local');
const [password, setPassword] = useState('sydneysafepass');
const [isLoading, setIsLoading] = useState(false);
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
// Helper for Sign In (simulated authentication)
const handleSignIn = () => {
if (isLoading) return;
// Simulate basic form validation
if (!email || !password) {
alert("Please enter both email and password.");
return;
}
setIsLoading(true);
// Simulate API delay
setTimeout(() => {
setIsLoading(false);
// Success simulation: navigate to inbox
setNavigation('sydney-inbox', 'push');
}, 1500);
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
value={email}
onChange={(e) => setEmail(e.target.value)}
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
value={password}
onChange={(e) => setPassword(e.target.value)}
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
{/* Sign In Trigger Button (Refactored for controlled state and loading) */}
<button
onClick={handleSignIn}
disabled={isLoading}
className={`w-full h-13 text-on-primary rounded-xl font-bold text-sm tracking-wide shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2
${isLoading ? 'bg-primary-container cursor-not-allowed' : 'bg-primary hover:bg-primary-container'}
`}
>
{isLoading ? (
<>
<Loader2 size={16} className="animate-spin" />
<span>Signing In...</span>
</>
) : (
<span>Sign In</span>
)}
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
[... truncated 69623 characters ...]
-sm uppercase flex items-center justify-center">
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