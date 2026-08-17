"use client";

import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  ExternalLink,
  FileText,
  ListChecks,
  Newspaper,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { AgentMessage, MessageContent } from "@/lib/types";

type UnknownRecord = Record<string, unknown>;

const record = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

export function messageText(content: AgentMessage["content"]): string {
  if (typeof content === "string") return content;
  const data = record(content.data);
  return [data.body, data.text, data.message, data.detail, data.summary, data.title, content.message]
    .map(text)
    .find(Boolean) ?? "New message";
}

function Markdown({ children }: { children: string }) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{children}</ReactMarkdown></div>;
}

export function MessageRenderer({
  message,
  onAction,
  onFeedback
}: {
  message: AgentMessage;
  onAction?: (messageId: string, action: "done" | "snooze" | "skip") => void;
  onFeedback?: (messageId: string, value: "helpful" | "not_helpful") => void;
}) {
  const content = typeof message.content === "string" ? ({ template: "plain_text", data: { body: message.content } } as MessageContent) : message.content;
  const data = record(content.data);
  const template = content.template ?? "plain_text";
  const isUser = message.role === "user";

  if (isUser) {
    return <div className="message-row user-row"><div className="user-message"><Markdown>{messageText(content)}</Markdown></div><MessageTime value={message.created_at} /></div>;
  }

  return (
    <div className="message-row agent-message-row">
      <article className={`message-card template-${template}`}>
        <TemplateContent template={template} data={data} />
        {(template === "study_guide" || template === "dsa_question" || template === "daily_task") && (
          <div className="message-action-row">
            <button onClick={() => onAction?.(message.id, "done")}><Check size={15} />Done</button>
            <button onClick={() => onAction?.(message.id, "snooze")}><Clock3 size={15} />Snooze</button>
            <button onClick={() => onAction?.(message.id, "skip")}>Skip</button>
          </div>
        )}
        {list(message.source_refs).length > 0 && <SourceLinks sources={message.source_refs ?? []} />}
      </article>
      <div className="message-meta-row">
        <MessageTime value={message.created_at} />
        <span className="message-feedback"><button aria-label="Helpful" onClick={() => onFeedback?.(message.id, "helpful")}><ThumbsUp size={13} /></button><button aria-label="Not helpful" onClick={() => onFeedback?.(message.id, "not_helpful")}><ThumbsDown size={13} /></button></span>
      </div>
    </div>
  );
}

function TemplateContent({ template, data }: { template: string; data: UnknownRecord }) {
  if (template === "briefing_card") return <Briefing data={data} />;
  if (template === "data_summary") return <DataSummary data={data} />;
  if (template === "urgency_list") return <UrgencyList data={data} />;
  if (template === "checklist" || template === "progress_tracker") return <Checklist data={data} />;
  if (template === "all_clear") return <AllClear data={data} />;
  if (template === "news_brief") return <NewsBrief data={data} />;
  if (template === "portfolio_watch") return <PortfolioWatch data={data} />;
  if (template === "comparison") return <Comparison data={data} />;
  if (template === "streak_counter") return <Streak data={data} />;
  if (template === "content_extractor") return <Ideas data={data} />;
  if (template === "dsa_question") return <DsaQuestion data={data} />;
  if (template === "study_guide") return <StudyGuide data={data} />;
  if (template === "daily_task") return <DailyTask data={data} />;
  return <PlainText data={data} />;
}

function PlainText({ data }: { data: UnknownRecord }) {
  const headline = text(data.headline || data.title);
  const body = text(data.body || data.text || data.message || data.detail || data.summary);
  return <>{headline && <p className="message-kicker"><Sparkles size={14} />{headline}</p>}{headline && body && <h3>{headline}</h3>}<Markdown>{body || headline || "New message"}</Markdown>{text(data.footer) && <p className="message-footer">{text(data.footer)}</p>}</>;
}

function Briefing({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker"><Sparkles size={14} />{text(data.eyebrow) || "Briefing"}</p><h3>{text(data.title)}</h3><p>{text(data.summary)}</p><div className="briefing-sections">{list(data.sections).map((raw, index) => { const section = record(raw); return <section key={text(section.id) || index} className={`briefing-section tone-${text(section.tone) || "neutral"}`}><div className="section-title"><span><FileText size={15} /></span><div><b>{text(section.title)}</b><small>{text(section.source)}</small></div></div><div>{list(section.items).map((itemRaw, itemIndex) => { const item = record(itemRaw); return <div className="briefing-line" key={itemIndex}><span className="line-dot" /><span><b>{text(item.title)}</b>{text(item.detail) && <small>{text(item.detail)}</small>}{text(item.meta) && <em>{text(item.meta)}</em>}</span></div>; })}</div></section>; })}</div>{list(data.priorities).length > 0 && <div className="priority-box"><b>Worth your attention</b>{list(data.priorities).map((raw, index) => { const item = record(raw); return <div key={index}><ArrowUpRight size={14} /><span>{text(raw) || text(item.title)}{text(item.detail) && <small>{text(item.detail)}</small>}</span></div>; })}</div>}</>;
}

function DataSummary({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker"><TrendingUp size={14} />Summary</p><h3>{text(data.title)}</h3><p>{text(data.summary || data.text || data.description)}</p>{list(data.metrics).length > 0 && <div className="metric-grid">{list(data.metrics).map((raw, index) => { const metric = record(raw); return <div className="metric" key={index}><strong>{text(metric.value)}</strong><b>{text(metric.label)}</b><small>{text(metric.sublabel)}</small></div>; })}</div>}<ItemList values={list(data.action_items).length ? list(data.action_items) : list(data.items)} /></>;
}

function UrgencyList({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker"><AlertCircle size={14} />{text(data.source) || "Attention"}</p><h3>{text(data.title)}</h3><div className="urgency-list">{list(data.items).map((raw, index) => { const item = record(raw); return <div key={index} className={`urgency-item urgency-${text(item.urgency) || "medium"}`}><span>{index + 1}</span><div><b>{text(item.label || item.title)}</b>{text(item.preview) && <p>{text(item.preview)}</p>}{text(item.due) && <small>{text(item.due)}</small>}</div></div>; })}</div></>;
}

function Checklist({ data }: { data: UnknownRecord }) {
  const steps = list(data.items).length ? list(data.items) : list(data.steps);
  const current = Number(data.current ?? 0); const total = Number(data.total ?? steps.length);
  return <><p className="message-kicker"><ListChecks size={14} />Progress</p><h3>{text(data.title)}</h3><p>{text(data.subtitle || data.text || data.message)}</p>{total > 0 && <div className="progress-bar"><span style={{ width: `${Math.min(100, Math.round((current / total) * 100))}%` }} /></div>}<div className="check-list">{steps.map((raw, index) => { const item = record(raw); const done = item.checked === true || item.done === true; return <div key={index}>{done ? <CheckCircle2 size={17} /> : <Circle size={17} />}<span>{text(item.label)}</span></div>; })}</div>{text(data.footer) && <p className="message-footer">{text(data.footer)}</p>}</>;
}

function AllClear({ data }: { data: UnknownRecord }) {
  return <div className="all-clear"><span><CheckCircle2 size={22} /></span><div><p className="message-kicker">All clear</p><h3>{text(data.message)}</h3><p>{text(data.sourceSummary)}</p></div></div>;
}

function NewsBrief({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker"><Newspaper size={14} />News brief</p><h3>{text(data.title)}</h3>{list(data.tldr).length > 0 && <ItemList values={list(data.tldr)} />}{list(data.items).map((raw, index) => { const item = record(raw); return <article className="news-item" key={index}><span>{text(item.category) || `0${index + 1}`}</span><div><b>{text(item.headline || item.title)}</b><p>{text(item.summary)}</p>{text(item.url) && <a href={text(item.url)} target="_blank" rel="noreferrer">{text(item.source) || "Open source"}<ExternalLink size={12} /></a>}</div></article>; })}{text(data.why_it_matters) && <div className="insight-box"><b>Why it matters</b><p>{text(data.why_it_matters)}</p></div>}</>;
}

function PortfolioWatch({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker"><TrendingUp size={14} />Portfolio watch</p><h3>{text(data.title)}</h3><p>{text(data.text)}</p><div className="stock-grid">{list(data.stocks).map((raw, index) => { const stock = record(raw); const change = text(stock.change); return <div key={index}><small>{text(stock.ticker)}</small><b>{text(stock.price)}</b><span className={change.startsWith("-") ? "negative" : "positive"}>{change}</span><p>{text(stock.name)}</p></div>; })}</div><p className="message-footer">{text(data.footer)}</p></>;
}

function Comparison({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker">{text(data.period) || "Comparison"}</p><h3>{text(data.title)}</h3><div className="comparison-list">{list(data.rows).map((raw, index) => { const row = record(raw); return <div key={index}><b>{text(row.label)}</b><ul>{list(row.changes).map((change, changeIndex) => <li key={changeIndex}>{text(change)}</li>)}</ul></div>; })}</div>{text(data.insight || data.trending_narrative) && <div className="insight-box"><b>Pattern</b><p>{text(data.insight || data.trending_narrative)}</p></div>}</>;
}

function Streak({ data }: { data: UnknownRecord }) {
  return <div className="streak-card"><span>{text(data.count)}</span><div><p className="message-kicker">{text(data.label)}</p><h3>{text(data.unit)}</h3><p>{text(data.caption)}</p></div>{text(data.word) && <div className="word-box"><b>{text(data.word)}</b><p>{text(data.definition)}</p><small>{text(data.example || data.translation)}</small></div>}</div>;
}

function Ideas({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker"><Sparkles size={14} />Content ideas</p><h3>Ideas ready to shape</h3><div className="idea-grid">{list(data.ideas).map((raw, index) => { const idea = record(raw); return <div key={index}><span>0{index + 1}</span><b>{text(idea.title)}</b><p>{text(idea.hook)}</p><small>{text(idea.angle || idea.audience_value)}</small></div>; })}</div></>;
}

function DsaQuestion({ data }: { data: UnknownRecord }) {
  return <><div className="difficulty-row"><span className={`difficulty ${text(data.difficulty).toLowerCase()}`}>{text(data.difficulty)}</span><small>{text(data.complexity)}</small></div><h3>{text(data.title)}</h3><Markdown>{text(data.problem)}</Markdown>{list(data.examples).map((raw, index) => { const example = record(raw); return <div className="code-example" key={index}><b>Example {index + 1}</b><pre>Input: {text(example.input)}{"\n"}Output: {text(example.output)}</pre>{text(example.explanation) && <p>{text(example.explanation)}</p>}</div>; })}{text(data.hint) && <details><summary>Show a hint</summary><p>{text(data.hint)}</p></details>}</>;
}

function StudyGuide({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker">Study guide</p><h3>{text(data.topic)}</h3><Markdown>{text(data.definition)}</Markdown><ReferenceList values={list(data.references)} /></>;
}

function DailyTask({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker">Today’s task</p><h3>{text(data.title)}</h3><p>{text(data.task)}</p>{text(data.context) && <div className="insight-box"><p>{text(data.context)}</p></div>}{data.estimated_minutes !== undefined && <p className="message-footer"><Clock3 size={12} /> About {text(data.estimated_minutes)} minutes</p>}</>;
}

function ItemList({ values }: { values: unknown[] }) {
  if (!values.length) return null;
  return <div className="simple-list">{values.map((raw, index) => { const item = record(raw); return <div key={index}><Check size={14} /><span><b>{text(raw) || text(item.label || item.title)}</b>{text(item.due || item.detail) && <small>{text(item.due || item.detail)}</small>}</span></div>; })}</div>;
}

function ReferenceList({ values }: { values: unknown[] }) {
  return <div className="reference-list">{values.map((raw, index) => { const item = record(raw); return <a key={index} href={text(item.url)} target="_blank" rel="noreferrer">{text(item.title) || "Reference"}<ExternalLink size={13} /></a>; })}</div>;
}

function SourceLinks({ sources }: { sources: Array<Record<string, unknown>> }) {
  return <details className="source-links"><summary>{sources.length} {sources.length === 1 ? "source" : "sources"}</summary><div>{sources.map((source, index) => { const href = text(source.url); const label = text(source.name || source.title || source.source) || `Source ${index + 1}`; return href ? <a key={index} href={href} target="_blank" rel="noreferrer">{label}<ExternalLink size={11} /></a> : <span key={index}>{label}</span>; })}</div></details>;
}

function MessageTime({ value }: { value: string }) {
  const date = new Date(value);
  return <time dateTime={value}>{Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>;
}
