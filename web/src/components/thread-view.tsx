"use client";

import {
  ArrowLeft,
  Copy,
  LoaderCircle,
  MoreVertical,
  Paperclip,
  Plus,
  Send,
  X
} from "lucide-react";
import Image from "next/image";
import { Fragment, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Agent, AgentMessage, ArchivedMessagePage, MessageAction, MessageFeedbackType } from "@/lib/types";
import { AgentIcon, agentTone } from "./agent-icon";
import { messageText, MessageRenderer } from "./message-renderer";

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
  feedback,
  onRun,
  onToggleMute,
  onOpenSettings,
  onClear
  ,onLoadArchived
}: {
  agent: Agent;
  messages: AgentMessage[];
  loading?: boolean;
  sending?: boolean;
  onBack?: () => void;
  onSend: (text: string, attachmentIds?: string[], sourceMessageId?: string) => Promise<void> | void;
  onUpload?: (file: File) => Promise<{ id: string; name: string }>;
  onAction?: (messageId: string, action: MessageAction) => void;
  onFeedback?: (messageId: string, value: MessageFeedbackType, subjectKey?: string) => void;
  feedback?: Record<string, string>;
  onRun?: () => void;
  onToggleMute?: () => void;
  onOpenSettings?: () => void;
  onClear?: () => void;
  onLoadArchived?: (cursor?: string) => Promise<ArchivedMessagePage>;
}) {
  const [value, setValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; preview?: string }>>([]);
  const [archivedMessages, setArchivedMessages] = useState<AgentMessage[]>([]);
  const [archiveCursor, setArchiveCursor] = useState<string | undefined>();
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveLoaded, setArchiveLoaded] = useState(false);
  const [quote, setQuote] = useState<{ id: string; text: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ message: AgentMessage; x: number; y: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageScroll = useRef<HTMLDivElement>(null);
  const muted = agent.parsed_intent?.notifications_muted === true;
  const allMessages = useMemo(() => [...archivedMessages, ...messages], [archivedMessages, messages]);
  const groups = messageGroups(allMessages);

  const effectiveFeedback = useMemo(
    () => ({ ...feedback, ...feedbackByMessage }),
    [feedback, feedbackByMessage]
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const scroll = messageScroll.current;
      if (scroll) scroll.scrollTop = scroll.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [agent.id, messages.length, sending]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = value.trim();
    if ((!trimmed && !attachments.length) || sending) return;
    setValue("");
    const ids = attachments.map((item) => item.id);
    setAttachments([]);
    const sourceMessageId = quote?.id;
    setQuote(null);
    await onSend(trimmed, ids, sourceMessageId);
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
      setAttachments((current) => [...current, { ...uploaded, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined }]);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) await upload(file);
  };

  const loadArchived = async () => {
    if (!onLoadArchived || archiveLoading) return;
    setArchiveLoading(true);
    try {
      const page = await onLoadArchived(archiveCursor);
      setArchivedMessages((current) => [...page.messages, ...current]);
      setArchiveCursor(page.next_cursor ?? undefined);
      setArchiveLoaded(true);
    } finally { setArchiveLoading(false); }
  };

  const copyMessage = async (message: AgentMessage) => {
    await navigator.clipboard?.writeText(messageText(message.content));
    setContextMenu(null);
  };

  const replyToMessage = (message: AgentMessage) => {
    setQuote({ id: message.id, text: messageText(message.content) });
    setContextMenu(null);
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(`.thread-composer-input-${agent.id}`)?.focus(), 0);
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
              {!agent.is_assistant && <button onClick={() => { onRun?.(); setMenuOpen(false); }}>Run agent now</button>}
              <button onClick={() => { onOpenSettings?.(); setMenuOpen(false); }}>Agent preferences</button>
              <button className="danger" onClick={() => { onClear?.(); setMenuOpen(false); }}>Clear chat</button>
              <button onClick={() => { onToggleMute?.(); setMenuOpen(false); }}>{muted ? "Unmute agent" : "Mute agent"}</button>
            </div>}
          </div>
        </div>
      </header>

      <div ref={messageScroll} className="message-scroll" onClick={() => setContextMenu(null)}>
        {onLoadArchived && <div className="archive-loader">{archiveLoaded && !archiveCursor ? <span>Beginning of archived history</span> : <button onClick={() => void loadArchived()} disabled={archiveLoading}>{archiveLoading ? <LoaderCircle className="spin" size={14} /> : <ArrowLeft size={14} />} {archiveLoading ? "Loading older messages…" : "Load older messages"}</button>}</div>}
        {loading ? <div className="thread-loading"><LoaderCircle className="spin" /><span>Gathering the thread…</span></div> : allMessages.length === 0 ? <div className="empty-thread"><span className={`agent-avatar ${agentTone(agent.id)}`}><AgentIcon name={agent.avatar} size={22} /></span><h3>Start a conversation with {agent.name}</h3><p>{agent.is_assistant ? "Ask a question, shape a new agent, or attach a document." : "Ask for an update or adjust what this agent should pay attention to."}</p></div> : <>{groups.map((group, groupIndex) => <Fragment key={`${group.key}-${groupIndex}`}><div className="day-divider"><span>{group.label}</span></div>{group.messages.map((message) => <div key={message.id} className={`thread-message-shell ${archivedMessages.some((item) => item.id === message.id) ? "archived-message" : ""}`} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setContextMenu({ message, x: event.clientX, y: event.clientY }); }}><MessageRenderer message={message} onAction={onAction} onFeedback={onFeedback ? (messageId, value, subjectKey) => { setFeedbackByMessage((current) => ({ ...current, [messageId]: value })); onFeedback(messageId, value, subjectKey); } : undefined} feedbackType={effectiveFeedback[message.id]} /></div>)}</Fragment>)}</>}
        {sending && <div className="thinking-row" aria-label={`${agent.name} is typing`}><span /><span /><span /></div>}
      </div>

      <form className="composer-wrap" onSubmit={submit}>
        {quote && <div className="reply-quote"><div><small>Replying to</small><span>{quote.text}</span></div><button type="button" onClick={() => setQuote(null)} aria-label="Cancel reply"><X size={14} /></button></div>}
        {attachments.length > 0 && <div className="attachment-tray">{attachments.map((item) => <span key={item.id}>{item.preview ? <Image src={item.preview} alt="" width={22} height={22} unoptimized /> : <Paperclip size={13} />}{item.name}<button type="button" onClick={() => { if (item.preview) URL.revokeObjectURL(item.preview); setAttachments((current) => current.filter((entry) => entry.id !== item.id)); }}><X size={12} /></button></span>)}</div>}
        <div className="composer-row" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void uploadFiles(event.dataTransfer.files); }}>
          <div className="composer">
            <input ref={fileInput} className="visually-hidden" type="file" multiple accept=".pdf,.txt,.md,.csv,.json,.doc,.docx,.png,.jpg,.jpeg" onChange={(event) => void uploadFiles(event.target.files ?? [])} />
            <button type="button" className="icon-button subtle" onClick={() => fileInput.current?.click()} disabled={uploading} aria-label="Add attachment">{uploading ? <LoaderCircle className="spin" size={18} /> : <Plus size={22} />}</button>
            <textarea className={`thread-composer-input-${agent.id}`} rows={1} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={keyboard} placeholder="Message agent" aria-label={`Message ${agent.name}`} />
          </div>
          <button className="send-button" disabled={sending || (!value.trim() && !attachments.length)} aria-label="Send message">{sending ? <LoaderCircle className="spin" size={17} /> : <Send size={20} />}</button>
        </div>
      </form>
      {contextMenu && <div className="message-context-menu" style={{ left: Math.min(contextMenu.x, window.innerWidth - 180), top: Math.min(contextMenu.y, window.innerHeight - 100) }} onClick={(event) => event.stopPropagation()}><button onClick={() => void copyMessage(contextMenu.message)}><Copy size={14} />Copy message</button><button onClick={() => replyToMessage(contextMenu.message)}>Reply with quote</button></div>}
    </section>
  );
}

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CU";
}

function messageGroups(messages: AgentMessage[]): Array<{ key: string; label: string; messages: AgentMessage[] }> {
  const groups: Array<{ key: string; label: string; messages: AgentMessage[] }> = [];
  for (const message of messages) {
    const date = new Date(message.created_at);
    const key = Number.isNaN(date.getTime()) ? "unknown" : localDateKey(date);
    const previous = groups.at(-1);
    if (previous?.key === key) previous.messages.push(message);
    else groups.push({ key, label: threadDayLabel(date), messages: [message] });
  }
  return groups;
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function threadDayLabel(date: Date, now = new Date()): string {
  if (Number.isNaN(date.getTime())) return "MESSAGES";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const difference = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (difference === 0) return "TODAY";
  if (difference === 1) return "YESTERDAY";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(day.getFullYear() === today.getFullYear() ? {} : { year: "numeric" })
  }).format(day).toUpperCase();
}
