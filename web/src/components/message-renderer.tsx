"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import type { AgentMessage, MessageAction, MessageContent, MessageFeedbackType } from "@/lib/types";

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
  onFeedback,
  feedbackType
}: {
  message: AgentMessage;
  onAction?: (messageId: string, action: MessageAction) => void;
  onFeedback?: (messageId: string, value: MessageFeedbackType, subjectKey?: string) => void;
  feedbackType?: string;
}) {
  const content = typeof message.content === "string" ? ({ template: "plain_text", data: { body: message.content } } as MessageContent) : message.content;
  const data = record(content.data);
  const template = content.template ?? "plain_text";
  const isUser = message.role === "user";
  const presentation = content.presentation ?? {};
  const partCount = Math.max(1, Number(presentation.part_count ?? 1) || 1);
  const partIndex = Math.max(0, Number(presentation.part_index ?? 0) || 0);
  const isLastPart = partIndex >= partCount - 1;
  const feedbackSubjectKey = getFeedbackSubjectKey(template, data);
  const showFeedback =
    message.role === "agent" &&
    onFeedback !== undefined &&
    content._recovered_raw_payload !== true &&
    presentation.feedback_eligible === true &&
    isLastPart &&
    feedbackType === undefined;

  if (isUser) {
    return <div className="message-row user-row"><div className="user-message"><Markdown>{messageText(content)}</Markdown><span className="flutter-message-time"><MessageTime value={message.created_at} /></span></div></div>;
  }

  return (
    <div className="message-row agent-message-row">
      <article className={`message-card template-${template}`}>
        <TemplateContent template={template} data={data} messageId={message.id} onAction={onAction} />
        {(template === "study_guide" || template === "dsa_question" || template === "daily_task") && (
          <div className="message-action-row">
            <button onClick={() => onAction?.(message.id, { type: "message_action", action: "done" })}>Done</button>
            <button onClick={() => onAction?.(message.id, { type: "message_action", action: "snooze" })}>Snooze</button>
            <button onClick={() => onAction?.(message.id, { type: "message_action", action: "skip" })}>Skip</button>
          </div>
        )}
        {list(message.source_refs).length > 0 && <SourceLinks sources={message.source_refs ?? []} />}
        {showFeedback && <div className="message-feedback flutter-feedback-actions"><button aria-label="Useful" onClick={() => sendFeedback(onFeedback, message.id, "useful", feedbackSubjectKey)}>Useful</button><button aria-label="Not useful" onClick={() => sendFeedback(onFeedback, message.id, "not_useful", feedbackSubjectKey)}>Not useful</button></div>}
        <span className="flutter-message-time"><MessageTime value={message.created_at} /></span>
      </article>
    </div>
  );
}

function getFeedbackSubjectKey(template: string, data: UnknownRecord): string | undefined {
  if (template !== "news_brief") return undefined;
  const item = list(data.items).map(record).find((candidate) => text(candidate.category).trim());
  const category = item ? text(item.category).trim() : "";
  return category || undefined;
}

function sendFeedback(
  onFeedback: ((messageId: string, value: MessageFeedbackType, subjectKey?: string) => void) | undefined,
  messageId: string,
  value: MessageFeedbackType,
  subjectKey?: string
) {
  if (!onFeedback) return;
  if (subjectKey) onFeedback(messageId, value, subjectKey);
  else onFeedback(messageId, value);
}

function TemplateContent({ template, data, messageId, onAction }: { template: string; data: UnknownRecord; messageId: string; onAction?: (messageId: string, action: MessageAction) => void }) {
  if (template === "briefing_card") return <Briefing data={data} />;
  if (template === "data_summary" && (data.kind === "github_activity" || data.kind === "github_activity_digest")) return <Digest data={data} kind="github" />;
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
  if (template === "assistant_suggestion") return <AssistantSuggestion data={data} messageId={messageId} onAction={onAction} />;
  if (template === "action_confirmation") return <ActionConfirmation data={data} messageId={messageId} onAction={onAction} />;
  if (template === "agent_selection") return <AgentSelection data={data} messageId={messageId} onAction={onAction} />;
  if (template === "system") return <SystemMessage data={data} />;
  if (template === "gmail_digest") return <Digest data={data} kind="gmail" />;
  if (template === "github_activity" || template === "github_activity_digest") return <Digest data={data} kind="github" />;
  return <PlainText data={data} />;
}

function PlainText({ data }: { data: UnknownRecord }) {
  const headline = text(data.headline || data.title);
  const body = text(data.body || data.text || data.message || data.detail || data.summary);
  return <>{headline && <h3>{headline}</h3>}{body ? <Markdown>{body}</Markdown> : !headline ? <Markdown>New message</Markdown> : null}{text(data.footer) && <p className="message-footer">{text(data.footer)}</p>}</>;
}

function Briefing({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker">{text(data.eyebrow) || "Briefing"}</p><h3>{text(data.title)}</h3><p>{text(data.summary)}</p><div className="briefing-sections">{list(data.sections).map((raw, index) => { const section = record(raw); return <section key={text(section.id) || index} className={`briefing-section tone-${text(section.tone) || "neutral"}`}><div className="section-title"><div><b>{text(section.title)}</b><small>{text(section.source)}</small></div></div><div>{list(section.items).map((itemRaw, itemIndex) => { const item = record(itemRaw); return <div className="briefing-line" key={itemIndex}><span className="line-dot" /><span><b>{text(item.title)}</b>{text(item.detail) && <small>{text(item.detail)}</small>}{text(item.meta) && <em>{text(item.meta)}</em>}</span></div>; })}</div></section>; })}</div>{list(data.priorities).length > 0 && <div className="priority-box"><b>Worth your attention</b>{list(data.priorities).map((raw, index) => { const item = record(raw); return <div key={index}><span>{text(raw) || text(item.title)}{text(item.detail) && <small>{text(item.detail)}</small>}</span></div>; })}</div>}</>;
}

function DataSummary({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker">Summary</p><h3>{text(data.title)}</h3><p>{text(data.summary || data.text || data.description)}</p>{list(data.metrics).length > 0 && <div className="metric-grid">{list(data.metrics).map((raw, index) => { const metric = record(raw); return <div className="metric" key={index}><strong>{text(metric.value)}</strong><b>{text(metric.label)}</b><small>{text(metric.sublabel)}</small></div>; })}</div>}<ItemList values={list(data.action_items).length ? list(data.action_items) : list(data.items)} /></>;
}

type DigestGroup = { repository?: string; items: UnknownRecord[] };

export function groupGitHubDigestItems(items: unknown[]): DigestGroup[] {
  const groups = new Map<string, DigestGroup>();
  items.forEach((raw, index) => {
    const item = record(raw);
    const repository = text(item.repository).trim();
    const key = repository ? `repository:${repository.toLowerCase()}` : `item:${index}`;
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, { repository: repository || undefined, items: [item] });
  });
  return [...groups.values()];
}

function UrgencyList({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker">{text(data.source) || "Attention"}</p><h3>{text(data.title)}</h3><div className="urgency-list">{list(data.items).map((raw, index) => { const item = record(raw); return <div key={index} className={`urgency-item urgency-${text(item.urgency) || "medium"}`}><span>{index + 1}</span><div><b>{text(item.label || item.title)}</b>{text(item.preview) && <p>{text(item.preview)}</p>}{text(item.due) && <small>{text(item.due)}</small>}</div></div>; })}</div></>;
}

function Checklist({ data }: { data: UnknownRecord }) {
  const steps = list(data.items).length ? list(data.items) : list(data.steps);
  const current = Number(data.current ?? 0); const total = Number(data.total ?? steps.length);
  return <><p className="message-kicker">Progress</p><h3>{text(data.title)}</h3><p>{text(data.subtitle || data.text || data.message)}</p>{total > 0 && <div className="progress-bar"><span style={{ width: `${Math.min(100, Math.round((current / total) * 100))}%` }} /></div>}<div className="check-list">{steps.map((raw, index) => { const item = record(raw); const done = item.checked === true || item.done === true; return <div key={index} className={done ? "done" : undefined}><span>{text(item.label)}</span></div>; })}</div>{text(data.footer) && <p className="message-footer">{text(data.footer)}</p>}</>;
}

function AllClear({ data }: { data: UnknownRecord }) {
  return <div className="all-clear"><div><p className="message-kicker">All clear</p><h3>{text(data.message)}</h3><p>{text(data.sourceSummary)}</p></div></div>;
}

function NewsBrief({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker">News brief</p><h3>{text(data.title)}</h3>{list(data.tldr).length > 0 && <ItemList values={list(data.tldr)} />}{list(data.items).map((raw, index) => { const item = record(raw); return <article className="news-item" key={index}><span>{text(item.category) || `0${index + 1}`}</span><div><b>{text(item.headline || item.title)}</b><p>{text(item.summary)}</p>{text(item.url) && <a href={text(item.url)} target="_blank" rel="noreferrer">{text(item.source) || "Open source"}</a>}</div></article>; })}{text(data.why_it_matters) && <div className="insight-box"><b>Why it matters</b><p>{text(data.why_it_matters)}</p></div>}</>;
}

function PortfolioWatch({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker">Portfolio watch</p><h3>{text(data.title)}</h3><p>{text(data.text)}</p><div className="stock-grid">{list(data.stocks).map((raw, index) => { const stock = record(raw); const change = text(stock.change); return <div key={index}><small>{text(stock.ticker)}</small><b>{text(stock.price)}</b><span className={change.startsWith("-") ? "negative" : "positive"}>{change}</span><p>{text(stock.name)}</p></div>; })}</div><p className="message-footer">{text(data.footer)}</p></>;
}

function Comparison({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker">{text(data.period) || "Comparison"}</p><h3>{text(data.title)}</h3><div className="comparison-list">{list(data.rows).map((raw, index) => { const row = record(raw); return <div key={index}><b>{text(row.label)}</b><ul>{list(row.changes).map((change, changeIndex) => <li key={changeIndex}>{text(change)}</li>)}</ul></div>; })}</div>{text(data.insight || data.trending_narrative) && <div className="insight-box"><b>Pattern</b><p>{text(data.insight || data.trending_narrative)}</p></div>}</>;
}

function Streak({ data }: { data: UnknownRecord }) {
  return <div className="streak-card"><span>{text(data.count)}</span><div><p className="message-kicker">{text(data.label)}</p><h3>{text(data.unit)}</h3><p>{text(data.caption)}</p></div>{text(data.word) && <div className="word-box"><b>{text(data.word)}</b><p>{text(data.definition)}</p><small>{text(data.example || data.translation)}</small></div>}</div>;
}

function Ideas({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker">Content ideas</p><h3>Ideas ready to shape</h3><div className="idea-grid">{list(data.ideas).map((raw, index) => { const idea = record(raw); return <div key={index}><span>0{index + 1}</span><b>{text(idea.title)}</b><p>{text(idea.hook)}</p><small>{text(idea.angle || idea.audience_value)}</small></div>; })}</div></>;
}

function DsaQuestion({ data }: { data: UnknownRecord }) {
  return <><div className="difficulty-row"><span className={`difficulty ${text(data.difficulty).toLowerCase()}`}>{text(data.difficulty)}</span><small>{text(data.complexity)}</small></div><h3>{text(data.title)}</h3><Markdown>{text(data.problem)}</Markdown>{list(data.examples).map((raw, index) => { const example = record(raw); return <div className="code-example" key={index}><b>Example {index + 1}</b><pre>Input: {text(example.input)}{"\n"}Output: {text(example.output)}</pre>{text(example.explanation) && <p>{text(example.explanation)}</p>}</div>; })}{text(data.hint) && <details><summary>Show a hint</summary><p>{text(data.hint)}</p></details>}</>;
}

function StudyGuide({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker">Study guide</p><h3>{text(data.topic)}</h3><Markdown>{text(data.definition)}</Markdown><ReferenceList values={list(data.references)} /></>;
}

function DailyTask({ data }: { data: UnknownRecord }) {
  return <><p className="message-kicker">Today’s task</p><h3>{text(data.title)}</h3><p>{text(data.task)}</p>{text(data.context) && <div className="insight-box"><p>{text(data.context)}</p></div>}{data.estimated_minutes !== undefined && <p className="message-footer">About {text(data.estimated_minutes)} minutes</p>}</>;
}

function AssistantSuggestion({ data, messageId, onAction }: { data: UnknownRecord; messageId: string; onAction?: (messageId: string, action: MessageAction) => void }) {
  const primary = record(data.primary_action);
  const secondary = list(data.secondary_actions).map(record).filter((action) => text(action.label) || text(action.decision));
  const explanation = record(data.explanation);
  const resolved = data.resolved === true;
  const dispatch = (action: UnknownRecord) => {
    const type = text(action.type) || "suggestion_decision";
    onAction?.(messageId, { ...action, type });
  };
  return <><div className="template-heading"><div><p className="message-kicker">Suggestion</p><h3>{text(data.title) || "A thought for you"}</h3></div></div>{text(data.body) && <Markdown>{text(data.body)}</Markdown>}{Object.keys(explanation).length > 0 && <div className="explanation-box"><b>Why this appeared</b><p>{text(explanation.summary)}</p>{list(explanation.data_categories).length > 0 && <small>Used: {list(explanation.data_categories).map(text).join(", ")}</small>}{list(explanation.data_categories_not_used).length > 0 && <small>Not used: {list(explanation.data_categories_not_used).map(text).join(", ")}</small>}</div>}{resolved ? <p className="message-footer">{resolutionLabel(text(data.resolution))}</p> : (Object.keys(primary).length > 0 || secondary.length > 0) && <div className="suggestion-actions">{Object.keys(primary).length > 0 && <button className="primary-button" onClick={() => dispatch(primary)}>{text(primary.label) || "Continue"}</button>}{secondary.map((action, index) => <button className="secondary-button" key={index} onClick={() => dispatch(action)}>{text(action.label) || text(action.decision) || "Not now"}</button>)}{text(data.suggestion_id) && <button className="text-button" onClick={() => dispatch({ type: "suggestion_decision", decision: "explain", suggestion_id: text(data.suggestion_id) })}>Why this?</button>}</div>}</>;
}

function ActionConfirmation({ data, messageId, onAction }: { data: UnknownRecord; messageId: string; onAction?: (messageId: string, action: MessageAction) => void }) {
  const actions = list(data.actions).map(record);
  const confirm = actions.find((action) => text(action.decision) === "confirm");
  const cancel = actions.find((action) => text(action.decision) === "cancel");
  const dispatch = (action: UnknownRecord) => onAction?.(messageId, { ...action, type: text(action.type) || "assistant_pending_action" });
  return <><p className="message-kicker">Confirmation</p><h3>{text(data.title) || "Confirm this action"}</h3><p className="confirmation-question">{text(data.question) || "Is this what you want me to do?"}</p><div className="confirmation-box"><b>{text(data.action_label) || "Continue"}</b>{text(data.action_detail) && <p>{text(data.action_detail)}</p>}</div>{text(data.context) && <p>{text(data.context)}</p>}{(confirm || cancel) && <div className="message-action-row">{confirm && <button className="primary-button" onClick={() => dispatch(confirm)}>{text(confirm.label) || "Yes, continue"}</button>}{cancel && <button onClick={() => dispatch(cancel)}>{text(cancel.label) || "Cancel"}</button>}</div>}</>;
}

function AgentSelection({ data, messageId, onAction }: { data: UnknownRecord; messageId: string; onAction?: (messageId: string, action: MessageAction) => void }) {
  const options = list(data.options).map(record);
  const [selected, setSelected] = useState(text(data.suggested_agent_id));
  const [resolved, setResolved] = useState(data.resolved === true);
  const cancel = record(data.cancel_action);
  const selectedName = text(options.find((option) => text(option.id) === selected)?.name);
  const submit = () => { if (!selected || !text(data.pending_action_id)) return; setResolved(true); onAction?.(messageId, { type: "assistant_pending_action", id: "assistant_select_agent", decision: "assistant_select_agent", pending_action_id: data.pending_action_id, selected_agent_id: selected }); };
  const cancelSelection = () => { setResolved(true); onAction?.(messageId, { ...cancel, type: text(cancel.type) || "assistant_pending_action" }); };
  return <><p className="message-kicker">Choose an agent</p><h3>{text(data.title) || "Confirm the agent"}</h3><p className="confirmation-question">{text(data.question) || "Which agent did you mean?"}</p>{text(data.context) && <p>{text(data.context)}</p>}{resolved ? <p className="message-footer">{text(data.resolution) === "cancelled" ? "Selection cancelled." : `Using ${text(data.selected_agent_name) || selectedName || "the selected agent"}.`}</p> : <div className="agent-selection-options">{options.map((option, index) => <label className={`agent-option ${selected === text(option.id) ? "selected" : ""}`} key={text(option.id) || index}><input type="radio" name={`agent-${messageId}`} checked={selected === text(option.id)} onChange={() => setSelected(text(option.id))} /><span><b>{text(option.name) || "Agent"}</b>{text(option.description) && <small>{text(option.description)}</small>}</span></label>)}<div className="message-action-row"><button className="primary-button" disabled={!selected} onClick={submit}>{selectedName ? `Use ${selectedName}` : "Choose an agent"}</button>{Object.keys(cancel).length > 0 && <button onClick={cancelSelection}>{text(cancel.label) || "Cancel"}</button>}</div></div>}</>;
}

function SystemMessage({ data }: { data: UnknownRecord }) {
  return <div className="system-message"><p className="message-kicker">System update</p><h3>{text(data.title) || text(data.headline) || "Cuppet update"}</h3><Markdown>{text(data.body || data.message || data.detail || data.text)}</Markdown></div>;
}

function Digest({ data, kind }: { data: UnknownRecord; kind: "gmail" | "github" }) {
  const title = text(data.title) || (kind === "gmail" ? "Inbox digest" : "GitHub activity");
  const items = list(data.items).length ? list(data.items) : list(data.timeline);
  const metrics = list(data.metrics);
  const groups: DigestGroup[] = kind === "github" ? groupGitHubDigestItems(items) : items.map((raw) => ({ repository: undefined, items: [record(raw)] }));
  return <><p className="message-kicker">{kind === "gmail" ? "Gmail digest" : "GitHub activity"}</p><h3>{title}</h3>{text(data.summary || data.body || data.text) && <Markdown>{text(data.summary || data.body || data.text)}</Markdown>}{metrics.length > 0 && <div className="digest-metrics">{metrics.map((raw, index) => { const metric = record(raw); return <div key={index}><strong>{text(metric.value)}</strong><small>{text(metric.label)}</small></div>; })}</div>}<div className="digest-list">{groups.map((group, index) => group.items.length > 1 && kind === "github" ? <GitHubDigestGroup key={group.repository || index} group={group} /> : <DigestItem key={group.repository || index} item={group.items[0]} kind={kind} />)}</div>{text(data.footer) && <p className="message-footer">{text(data.footer)}</p>}</>;
}

function DigestItem({ item, kind }: { item: UnknownRecord; kind: "gmail" | "github" }) {
  const source = text(item.repository || item.sender || item.from);
  const detail = digestDetail(item);
  const href = text(item.url);
  return <article className="digest-item">{kind === "github" && <span className="digest-marker" />}<div><b>{digestTitle(item)}</b>{source && <small>{source}</small>}{detail && <p>{detail}</p>}{href && <a href={href} target="_blank" rel="noreferrer">Open source</a>}</div></article>;
}

function GitHubDigestGroup({ group }: { group: DigestGroup }) {
  return <article className="digest-item digest-repository-group"><span className="digest-marker" /><div><div className="digest-group-heading"><b>{group.repository || "Repository updates"}</b><small>{group.items.length} updates</small></div><ul className="digest-update-list">{group.items.map((item, index) => { const href = text(item.url); const detail = digestDetail(item); return <li key={index}><span><b>{digestTitle(item)}</b>{detail && <small>{detail}</small>}</span>{href && <a href={href} target="_blank" rel="noreferrer">Open source</a>}</li>; })}</ul></div></article>;
}

function digestTitle(item: UnknownRecord): string {
  return text(item.title || item.headline || item.subject || item.name) || "Update";
}

function digestDetail(item: UnknownRecord): string {
  return text(item.detail || item.preview || item.summary || item.snippet);
}

function resolutionLabel(value: string): string {
  if (value === "accepted") return "Accepted. Cuppet is waiting for your confirmation before creating anything.";
  if (value === "not_now") return "Not now. I’ll leave this quiet for a while.";
  if (value === "dismiss") return "Dismissed. I won’t repeat this suggestion.";
  if (value === "less_like_this") return "Feedback saved. I’ll show fewer suggestions like this.";
  return "Suggestion resolved.";
}

function ItemList({ values }: { values: unknown[] }) {
  if (!values.length) return null;
  return <div className="simple-list">{values.map((raw, index) => { const item = record(raw); return <div key={index}><span><b>{text(raw) || text(item.label || item.title)}</b>{text(item.due || item.detail) && <small>{text(item.due || item.detail)}</small>}</span></div>; })}</div>;
}

function ReferenceList({ values }: { values: unknown[] }) {
  return <div className="reference-list">{values.map((raw, index) => { const item = record(raw); return <a key={index} href={text(item.url)} target="_blank" rel="noreferrer">{text(item.title) || "Reference"}</a>; })}</div>;
}

function SourceLinks({ sources }: { sources: Array<Record<string, unknown>> }) {
  return <details className="source-links"><summary>{sources.length} {sources.length === 1 ? "source" : "sources"}</summary><div>{sources.map((source, index) => { const href = text(source.url); const label = text(source.name || source.title || source.source) || `Source ${index + 1}`; return href ? <a key={index} href={href} target="_blank" rel="noreferrer">{label}</a> : <span key={index}>{label}</span>; })}</div></details>;
}

function MessageTime({ value }: { value: string }) {
  const date = new Date(value);
  return <time dateTime={value}>{Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>;
}
