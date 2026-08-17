"use client";

import {
  ArrowLeft,
  Bell,
  BellOff,
  LoaderCircle,
  MoreVertical,
  Paperclip,
  Play,
  Plus,
  Send,
  Settings2,
  Trash2,
  X
} from "lucide-react";
import Image from "next/image";
import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import type { Agent, AgentMessage } from "@/lib/types";
import { AgentIcon, agentTone } from "./agent-icon";
import { MessageRenderer } from "./message-renderer";

export function ThreadView({
  agent,
  messages,
  loading,
  sending,
  onBack,
  onSend,
  onUpload,
  onAction,
  onFeedback,
  onRun,
  onToggleMute,
  onOpenSettings,
  onClear
}: {
  agent: Agent;
  messages: AgentMessage[];
  loading?: boolean;
  sending?: boolean;
  onBack?: () => void;
  onSend: (text: string, attachmentIds?: string[]) => Promise<void> | void;
  onUpload?: (file: File) => Promise<{ id: string; name: string }>;
  onAction?: (messageId: string, action: "done" | "snooze" | "skip") => void;
  onFeedback?: (messageId: string, value: "helpful" | "not_helpful") => void;
  onRun?: () => void;
  onToggleMute?: () => void;
  onOpenSettings?: () => void;
  onClear?: () => void;
}) {
  const [value, setValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string }>>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const muted = agent.parsed_intent?.notifications_muted === true;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = value.trim();
    if ((!trimmed && !attachments.length) || sending) return;
    setValue("");
    const ids = attachments.map((item) => item.id);
    setAttachments([]);
    await onSend(trimmed, ids);
  };

  const keyboard = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const upload = async (file?: File) => {
    if (!file || !onUpload) return;
    setUploading(true);
    try {
      const uploaded = await onUpload(file);
      setAttachments((current) => [...current, uploaded]);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <section className="thread-pane live-thread">
      <header className="thread-header">
        <div className="thread-identity">
          {onBack && <button className="icon-button mobile-back" onClick={onBack} aria-label="Back to inbox"><ArrowLeft size={19} /></button>}
          <button className="thread-profile" onClick={onOpenSettings}>
            {agent.is_assistant ? <Image className="thread-assistant-avatar" src="/cuppet-app-icon.png" alt="" width={32} height={32} /> : <span className={`thread-agent-initials ${agentTone(agent.id)}`}>{initials(agent.name)}</span>}
            <span><h2>{agent.name}</h2><small><span className={`status-dot ${agent.status}`} />{agent.status === "paused" ? "PAUSED" : agent.schedule_cron ? "SCHEDULED" : "ON DEMAND"}</small></span>
          </button>
        </div>
        <div className="thread-actions">
          <div className="menu-anchor">
            <button className="icon-button" onClick={() => setMenuOpen((open) => !open)} aria-label="Thread actions"><MoreVertical size={20} /></button>
            {menuOpen && <div className="popover-menu">
              {!agent.is_assistant && <button onClick={() => { onRun?.(); setMenuOpen(false); }}><Play size={16} />Run agent now</button>}
              {!agent.is_assistant && <button onClick={() => { onOpenSettings?.(); setMenuOpen(false); }}><Settings2 size={16} />Agent settings</button>}
              <button onClick={() => { onToggleMute?.(); setMenuOpen(false); }}>{muted ? <Bell size={16} /> : <BellOff size={16} />}{muted ? "Unmute agent" : "Mute agent"}</button>
              <button className="danger" onClick={() => { onClear?.(); setMenuOpen(false); }}><Trash2 size={16} />Clear conversation</button>
            </div>}
          </div>
        </div>
      </header>

      <div className="message-scroll">
        {loading ? <div className="thread-loading"><LoaderCircle className="spin" /><span>Gathering the thread…</span></div> : messages.length === 0 ? <div className="empty-thread"><span className={`agent-avatar ${agentTone(agent.id)}`}><AgentIcon name={agent.avatar} size={22} /></span><h3>Start a conversation with {agent.name}</h3><p>{agent.is_assistant ? "Ask a question, shape a new agent, or attach a document." : "Ask for an update or adjust what this agent should pay attention to."}</p></div> : <><div className="day-divider"><span>TODAY</span></div>{messages.map((message) => <MessageRenderer key={message.id} message={message} onAction={onAction} onFeedback={onFeedback} />)}</>}
        {sending && <div className="thinking-row"><span /><span /><span /><small>{agent.name} is thinking</small></div>}
      </div>

      <form className="composer-wrap" onSubmit={submit}>
        {attachments.length > 0 && <div className="attachment-tray">{attachments.map((item) => <span key={item.id}><Paperclip size={13} />{item.name}<button type="button" onClick={() => setAttachments((current) => current.filter((entry) => entry.id !== item.id))}><X size={12} /></button></span>)}</div>}
        <div className="composer-row">
          <div className="composer">
            <input ref={fileInput} className="visually-hidden" type="file" accept=".pdf,.txt,.md,.csv,.json,.doc,.docx,.png,.jpg,.jpeg" onChange={(event) => void upload(event.target.files?.[0])} />
            <button type="button" className="icon-button subtle" onClick={() => fileInput.current?.click()} disabled={uploading} aria-label="Add attachment">{uploading ? <LoaderCircle className="spin" size={18} /> : <Plus size={22} />}</button>
            <textarea rows={1} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={keyboard} placeholder="Message agent" aria-label={`Message ${agent.name}`} />
          </div>
          <button className="send-button" disabled={sending || (!value.trim() && !attachments.length)} aria-label="Send message">{sending ? <LoaderCircle className="spin" size={17} /> : <Send size={20} />}</button>
        </div>
      </form>
    </section>
  );
}

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CU";
}
