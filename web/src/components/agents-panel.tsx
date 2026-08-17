"use client";

import { Bot, ChevronRight, CirclePause, Clock3, MoreHorizontal, Pencil, Play, Plus, Search, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { Agent } from "@/lib/types";
import { AgentIcon, agentTone } from "./agent-icon";

export function AgentsPanel({
  agents,
  selected,
  onSelect,
  onCreate,
  onOpenThread,
  onUpdate,
  onDelete,
  onRun
}: {
  agents: Agent[];
  selected?: Agent;
  onSelect: (agent: Agent) => void;
  onCreate: () => void;
  onOpenThread: (agent: Agent) => void;
  onUpdate: (agentId: string, value: Record<string, unknown>) => Promise<void>;
  onDelete: (agent: Agent) => Promise<void>;
  onRun: (agent: Agent) => void;
}) {
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => agents.filter((agent) => !agent.is_assistant && (filter === "all" || agent.status === filter) && `${agent.name} ${agent.description ?? ""}`.toLowerCase().includes(query.toLowerCase())), [agents, filter, query]);

  return <section className="content-panel agents-panel">
    <header className="content-header"><div><p className="eyebrow">Workspace</p><h1>Agents</h1><p>Create, pause, and tune the work Cuppet does for you.</p></div><button className="primary-button" onClick={onCreate}><Plus size={17} />New agent</button></header>
    <div className="agents-toolbar"><div className="segmented-control"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button><button className={filter === "active" ? "active" : ""} onClick={() => setFilter("active")}>Active</button><button className={filter === "paused" ? "active" : ""} onClick={() => setFilter("paused")}>Paused</button></div><div className="search-input"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agents" /></div></div>
    <div className={`agents-workspace ${selected ? "with-detail" : ""}`}>
      <div className="agent-card-grid">{visible.map((agent) => <article className={`agent-management-card ${selected?.id === agent.id ? "selected" : ""}`} key={agent.id} onClick={() => onSelect(agent)}><div className="management-card-top"><span className={`agent-avatar ${agentTone(agent.id)}`}><AgentIcon name={agent.avatar} size={20} /></span><span className={`status-pill ${agent.status}`}>{agent.status}</span><button aria-label="More actions"><MoreHorizontal size={18} /></button></div><h3>{agent.name}</h3><p>{agent.description || agent.prompt || "A useful Cuppet agent."}</p><div className="agent-tags">{agent.connector_ids?.slice(0, 3).map((connector) => <span key={connector}>{connector}</span>)}{agent.schedule_cron && <span><Clock3 size={11} />Scheduled</span>}</div><footer><small>{agent.last_message_preview || "No updates yet"}</small><ChevronRight size={16} /></footer></article>)}{visible.length === 0 && <div className="panel-empty wide"><span><Bot size={22} /></span><h3>No agents here yet</h3><p>Try another filter, or create one from a plain-language request.</p><button className="primary-button" onClick={onCreate}><Plus size={16} />New agent</button></div>}</div>
      {selected && <AgentDetail agent={selected} onClose={() => onSelect(selected)} onUpdate={onUpdate} onDelete={onDelete} onOpenThread={onOpenThread} onRun={onRun} />}
    </div>
  </section>;
}

function AgentDetail({ agent, onUpdate, onDelete, onOpenThread, onRun }: { agent: Agent; onClose: () => void; onUpdate: (id: string, value: Record<string, unknown>) => Promise<void>; onDelete: (agent: Agent) => Promise<void>; onOpenThread: (agent: Agent) => void; onRun: (agent: Agent) => void }) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || agent.prompt || "");
  const [responseLimit, setResponseLimit] = useState(String(agent.parsed_intent?.response_limit ?? "balanced"));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const save = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setNotice(""); try { await onUpdate(agent.id, { name, description, response_limit: responseLimit }); setNotice("Saved"); } finally { setBusy(false); } };
  return <aside className="agent-detail"><div className="agent-detail-heading"><span className={`agent-avatar ${agentTone(agent.id)}`}><AgentIcon name={agent.avatar} size={21} /></span><div><p className="eyebrow">Agent settings</p><h2>{agent.name}</h2></div></div><div className="detail-actions"><button className="secondary-button" onClick={() => onRun(agent)}><Play size={15} />Run now</button><button className="secondary-button" onClick={() => onOpenThread(agent)}>Open thread</button></div><form onSubmit={save}><label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>Instructions</span><textarea rows={6} value={description} onChange={(event) => setDescription(event.target.value)} /></label><label><span>Response length</span><select value={responseLimit} onChange={(event) => setResponseLimit(event.target.value)}><option value="concise">Concise</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option></select></label><div className="setting-row"><span><b>Status</b><small>{agent.status === "active" ? "Cuppet can run this agent." : "This agent won’t run until resumed."}</small></span><button type="button" className="toggle-action" onClick={() => void onUpdate(agent.id, { status: agent.status === "active" ? "paused" : "active" })}>{agent.status === "active" ? <><CirclePause size={15} />Pause</> : <><Play size={15} />Resume</>}</button></div><footer>{notice && <span className="saved-note">{notice}</span>}<button className="primary-button" disabled={busy}><Pencil size={15} />{busy ? "Saving…" : "Save changes"}</button></footer></form><div className="danger-zone"><div><b>Delete agent</b><p>This removes its configuration and conversation.</p></div><button onClick={() => void onDelete(agent)}><Trash2 size={15} />Delete</button></div></aside>;
}
