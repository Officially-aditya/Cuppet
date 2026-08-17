"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Command,
  Inbox,
  LoaderCircle,
  Menu,
  MessageSquareText,
  Plug,
  Plus,
  Search,
  Settings2,
  Sparkles,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { demoAgents, demoConnectors, demoMessages, demoRecipes, demoUser } from "@/lib/demo-data";
import type { Agent, AgentMessage, Connector, CurrentUserResponse, ViewKey } from "@/lib/types";
import { AgentIcon, agentTone } from "./agent-icon";
import { AgentsPanel } from "./agents-panel";
import { ConnectorsPanel } from "./connectors-panel";
import { CreateAgentDialog } from "./create-agent-dialog";
import { FeedbackPanel } from "./feedback-panel";
import { OverviewPanel } from "./overview-panel";
import { SettingsPanel } from "./settings-panel";
import { ThreadView } from "./thread-view";

const navItems: Array<{ id: ViewKey; label: string; icon: typeof Inbox }> = [
  { id: "overview", label: "Overview", icon: Command },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "connectors", label: "Connectors", icon: Plug }
];

export function WorkspaceApp({ demo, onExitDemo }: { demo: boolean; onExitDemo?: () => void }) {
  const queryClient = useQueryClient();
  const [view, setViewState] = useState<ViewKey>(initialView);
  const [selectedAgentId, setSelectedAgentId] = useState(initialAgentId);
  const [detailAgentId, setDetailAgentId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [threadOpen, setThreadOpen] = useState(() => Boolean(initialAgentId()));
  const [createOpen, setCreateOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [toast, setToast] = useState("");
  const [sending, setSending] = useState(false);
  const [demoAgentState, setDemoAgentState] = useState<Agent[]>(demoAgents);
  const [demoMessageState, setDemoMessageState] = useState<Record<string, AgentMessage[]>>(demoMessages);
  const [demoConnectorState, setDemoConnectorState] = useState<Connector[]>(demoConnectors);

  const meQuery = useQuery({ queryKey: ["me"], queryFn: api.me, enabled: !demo });
  const agentsQuery = useQuery({ queryKey: ["agents"], queryFn: api.agents, enabled: !demo });
  const recipesQuery = useQuery({ queryKey: ["recipes"], queryFn: api.recipes, enabled: !demo });
  const connectorsQuery = useQuery({ queryKey: ["connectors"], queryFn: api.connectors, enabled: !demo });
  const briefingsQuery = useQuery({ queryKey: ["briefings"], queryFn: api.briefings, enabled: !demo });

  const me: CurrentUserResponse = demo ? demoUser : meQuery.data ?? { user: { id: "", email: "", name: "" }, preferences: { time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone, follow_device_time_zone: true } };
  const agents = useMemo(
    () => (demo ? demoAgentState : agentsQuery.data?.agents ?? []),
    [agentsQuery.data?.agents, demo, demoAgentState]
  );
  const connectors = demo ? demoConnectorState : connectorsQuery.data ?? [];
  const recipes = demo ? demoRecipes : recipesQuery.data?.recipes ?? [];
  const briefings = demo ? (demoMessageState.daily?.filter((message) => message.content && typeof message.content === "object" && message.content.template === "briefing_card") ?? []) : briefingsQuery.data?.briefings ?? [];
  const effectiveSelectedAgentId = selectedAgentId || agents.find((agent) => !agent.is_assistant)?.id || agents[0]?.id || "";
  const selectedAgent = agents.find((agent) => agent.id === effectiveSelectedAgentId) ?? agents[0];
  const detailAgent = agents.find((agent) => agent.id === detailAgentId);
  const messagesQuery = useQuery({ queryKey: ["messages", selectedAgent?.id], queryFn: () => api.messages(selectedAgent!.id), enabled: !demo && Boolean(selectedAgent?.id) });
  const messages = selectedAgent ? (demo ? demoMessageState[selectedAgent.id] ?? [] : messagesQuery.data?.messages ?? []) : [];
  const loading = !demo && (agentsQuery.isLoading || meQuery.isLoading);

  const showToast = useCallback((value: string) => {
    setToast(value);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  const setView = useCallback((next: ViewKey) => {
    setViewState(next);
    setSidebarOpen(false);
    setThreadOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    if (next !== "inbox") url.searchParams.delete("agent");
    window.history.replaceState({}, "", url);
  }, []);

  useEffect(() => {
    const keyboard = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen((open) => !open); }
      if (event.key === "Escape") { setCommandOpen(false); setCreateOpen(false); }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);

  useEffect(() => {
    if (demo) return;
    const events = new EventSource("/api/events", { withCredentials: true });
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
      void queryClient.invalidateQueries({ queryKey: ["briefings"] });
      if (effectiveSelectedAgentId) void queryClient.invalidateQueries({ queryKey: ["messages", effectiveSelectedAgentId] });
    };
    events.onmessage = refresh;
    events.addEventListener("agent.created", refresh);
    events.addEventListener("agent.updated", refresh);
    events.addEventListener("message.created", refresh);
    return () => events.close();
  }, [demo, effectiveSelectedAgentId, queryClient]);

  useEffect(() => {
    const oauth = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== "cuppet.oauth.complete") return;
      void queryClient.invalidateQueries({ queryKey: ["connectors"] });
      void queryClient.invalidateQueries({ queryKey: ["archive"] });
      showToast(event.data.error ? `Connection failed: ${event.data.error}` : "Connection updated.");
    };
    window.addEventListener("message", oauth);
    return () => window.removeEventListener("message", oauth);
  }, [queryClient, showToast]);

  const selectThread = (agent: Agent) => {
    setSelectedAgentId(agent.id);
    setViewState("inbox");
    setThreadOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.set("view", "inbox");
    url.searchParams.set("agent", agent.id);
    window.history.replaceState({}, "", url);
  };

  const parseAgent = async (prompt: string) => {
    if (demo) return { parsed_intent: { name: prompt.includes("inbox") ? "Inbox helper" : "New useful agent", action: prompt, schedule_label: /every|weekday|daily|weekly/i.test(prompt) ? "On the schedule you described" : "On demand", connector_ids: [prompt.toLowerCase().includes("gmail") || prompt.toLowerCase().includes("inbox") ? "gmail" : "web_search"] } };
    return api.parseAgent({ prompt });
  };

  const createAgent = async (prompt: string) => {
    if (demo) {
      const id = `demo-${Date.now()}`;
      const agent: Agent = { id, name: prompt.split(/[,.]/)[0]!.slice(0, 42) || "New agent", description: prompt, prompt, status: "active", avatar: "sparkles", last_message_preview: "Agent created and ready", latest_message_at: new Date().toISOString(), unread_count: 1 };
      setDemoAgentState((current) => [...current, agent]);
      setDemoMessageState((current) => ({ ...current, [id]: [{ id: `${id}-welcome`, agent_id: id, role: "agent", created_at: new Date().toISOString(), content: { template: "plain_text", data: { headline: "Agent ready", body: "I’m set up. You can run me now, or refine my instructions from Agent settings." } } }] }));
      selectThread(agent);
    } else {
      const result = await api.createAgent({ prompt });
      await queryClient.invalidateQueries({ queryKey: ["agents"] });
      selectThread(result.agent);
    }
    showToast("Agent created.");
  };

  const updateAgent = async (agentId: string, value: Record<string, unknown>) => {
    if (demo) setDemoAgentState((current) => current.map((agent) => agent.id === agentId ? { ...agent, ...value, parsed_intent: value.response_limit ? { ...agent.parsed_intent, response_limit: value.response_limit } : agent.parsed_intent } as Agent : agent));
    else { await api.updateAgent(agentId, value); await queryClient.invalidateQueries({ queryKey: ["agents"] }); }
    showToast("Agent updated.");
  };

  const deleteAgent = async (agent: Agent) => {
    if (!window.confirm(`Delete ${agent.name} and its conversation?`)) return;
    if (demo) { setDemoAgentState((current) => current.filter((item) => item.id !== agent.id)); setDetailAgentId(""); }
    else { await api.deleteAgent(agent.id); await queryClient.invalidateQueries({ queryKey: ["agents"] }); }
    showToast("Agent deleted.");
  };

  const runAgent = async (agent: Agent) => {
    if (demo) {
      const message: AgentMessage = { id: `run-${Date.now()}`, agent_id: agent.id, role: "agent", created_at: new Date().toISOString(), content: { template: "all_clear", data: { message: `${agent.name} finished a fresh check.`, sourceSummary: "No new urgent items appeared in the demo workspace." } } };
      setDemoMessageState((current) => ({ ...current, [agent.id]: [...(current[agent.id] ?? []), message] }));
    } else { await api.runAgent(agent.id); }
    showToast("Agent run started.");
  };

  const sendMessage = async (text: string, attachmentIds?: string[]) => {
    if (!selectedAgent) return;
    setSending(true);
    try {
      if (demo) {
        const userMessage: AgentMessage = { id: `user-${Date.now()}`, agent_id: selectedAgent.id, role: "user", created_at: new Date().toISOString(), content: { template: "plain_text", data: { body: text || `Attached ${attachmentIds?.length ?? 0} file(s)` } } };
        setDemoMessageState((current) => ({ ...current, [selectedAgent.id]: [...(current[selectedAgent.id] ?? []), userMessage] }));
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        const reply: AgentMessage = { id: `reply-${Date.now()}`, agent_id: selectedAgent.id, role: "agent", created_at: new Date().toISOString(), content: { template: "plain_text", data: { body: selectedAgent.is_assistant ? "I’ve got it. In the live workspace I’d use your connected context to work through that with you." : "Understood. I’ll use that direction the next time I run, and you can refine it further in Agent settings." } } };
        setDemoMessageState((current) => ({ ...current, [selectedAgent.id]: [...(current[selectedAgent.id] ?? []), reply] }));
      } else {
        await api.sendMessage(selectedAgent.id, { ...(text ? { text } : {}), ...(attachmentIds?.length ? { attachment_ids: attachmentIds } : {}) });
        await Promise.all([queryClient.invalidateQueries({ queryKey: ["messages", selectedAgent.id] }), queryClient.invalidateQueries({ queryKey: ["agents"] })]);
      }
    } catch (caught) { showToast(errorMessage(caught)); }
    finally { setSending(false); }
  };

  const clearMessages = async () => {
    if (!selectedAgent || !window.confirm(`Clear the conversation with ${selectedAgent.name}?`)) return;
    if (demo) setDemoMessageState((current) => ({ ...current, [selectedAgent.id]: [] }));
    else { await api.clearMessages(selectedAgent.id); await queryClient.invalidateQueries({ queryKey: ["messages", selectedAgent.id] }); }
  };

  const connect = async (connector: Connector) => {
    if (demo) { setDemoConnectorState((current) => current.map((item) => item.id === connector.id ? { ...item, status: "connected" } : item)); return; }
    if (connector.id === "web_search") { await api.connectorStatus(connector.id, true); await queryClient.invalidateQueries({ queryKey: ["connectors"] }); return; }
    const session = await api.connectorOAuthStart(connector.id);
    window.sessionStorage.setItem("cuppet-oauth-connector", connector.id);
    if (session.providerId) window.sessionStorage.setItem("cuppet-oauth-provider", session.providerId);
    const popup = window.open(session.authUrl, "cuppet-oauth", "popup,width=620,height=760");
    if (!popup) window.location.assign(session.authUrl);
  };

  const disconnect = async (connector: Connector) => {
    if (demo) setDemoConnectorState((current) => current.map((item) => item.id === connector.id ? { ...item, status: "disconnected" } : item));
    else { await api.connectorStatus(connector.id, false); await queryClient.invalidateQueries({ queryKey: ["connectors"] }); }
  };

  const commandResults = useMemo(() => {
    const navigation = navItems.filter((item) => item.label.toLowerCase().includes(commandQuery.toLowerCase())).map((item) => ({ id: `nav-${item.id}`, label: item.label, note: "Go to view", action: () => setView(item.id) }));
    const agentResults = agents.filter((agent) => agent.name.toLowerCase().includes(commandQuery.toLowerCase())).slice(0, 6).map((agent) => ({ id: `agent-${agent.id}`, label: agent.name, note: "Open agent thread", action: () => selectThread(agent) }));
    return [...navigation, ...agentResults];
  }, [agents, commandQuery, setView]);

  if (loading) return <main className="boot-screen"><span className="brand-mark"><Sparkles size={19} /></span><LoaderCircle className="spin" size={18} /><span>Gathering your agents…</span></main>;
  if (!demo && (agentsQuery.error || meQuery.error)) return <main className="boot-screen error-state"><span className="brand-mark"><X size={19} /></span><h1>We couldn’t open your workspace.</h1><p>{errorMessage(agentsQuery.error || meQuery.error)}</p><button className="primary-button" onClick={() => window.location.reload()}>Try again</button></main>;

  return <main className={`workspace-shell live-workspace view-${view} ${threadOpen ? "mobile-thread-open" : ""}`}>
    <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
      <div className="brand-row"><div className="brand-mark"><Sparkles size={18} /></div><span className="brand-name">Cuppet</span><button className="icon-button mobile-only" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={20} /></button></div>
      {demo && <div className="demo-badge"><Sparkles size={12} />Demo workspace</div>}
      <nav className="primary-nav" aria-label="Primary navigation">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => setView(id)}><Icon size={18} />{label}{id === "inbox" && agents.reduce((sum, agent) => sum + (agent.unread_count ?? 0), 0) > 0 && <span className="nav-count">{agents.reduce((sum, agent) => sum + (agent.unread_count ?? 0), 0)}</span>}</button>)}</nav>
      <div className="sidebar-section"><p className="eyebrow">Recent agents</p>{agents.filter((agent) => !agent.is_assistant).slice(0, 4).map((agent) => <button key={agent.id} className={`mini-thread ${effectiveSelectedAgentId === agent.id && view === "inbox" ? "active" : ""}`} onClick={() => selectThread(agent)}><span className={`mini-avatar ${agentTone(agent.id)}`}><AgentIcon name={agent.avatar} size={14} /></span><span><b>{agent.name}</b><small>{agent.last_message_preview || agent.description}</small></span>{Boolean(agent.unread_count) && <i>{agent.unread_count}</i>}</button>)}</div>
      <div className="sidebar-spacer" />
      <button className="command-button" onClick={() => setCommandOpen(true)}><Search size={15} />Search<span>⌘K</span></button>
      <button className="new-agent-button" onClick={() => setCreateOpen(true)}><Plus size={17} />New agent</button>
      <button className={`profile-row ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}><span className="profile-avatar">{initials(me.user.name || me.user.email)}</span><span><b>{me.user.name || "Cuppet user"}</b><small>{demo ? "Demo workspace" : me.user.email}</small></span><Settings2 size={16} /></button>
      <button className="feedback-link" onClick={() => setView("feedback")}><MessageSquareText size={15} />Send feedback</button>
    </aside>
    {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
    <button className="mobile-nav-trigger icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>

    {view === "overview" && <OverviewPanel agents={agents} briefings={briefings} firstName={(me.user.name || "").split(" ")[0] || ""} onSelectAgent={(id) => { const agent = agents.find((item) => item.id === id); if (agent) selectThread(agent); }} onCreateAgent={() => setCreateOpen(true)} />}
    {view === "inbox" && <><InboxPane agents={agents} selectedAgentId={selectedAgent?.id} onSelect={selectThread} />{selectedAgent ? <ThreadView agent={selectedAgent} messages={messages} loading={!demo && messagesQuery.isLoading} sending={sending} onBack={() => setThreadOpen(false)} onSend={sendMessage} onUpload={demo ? async (file) => ({ id: `file-${Date.now()}`, name: file.name }) : async (file) => { const result = await api.upload(file); return { id: result.file.id, name: result.file.name }; }} onRun={() => void runAgent(selectedAgent)} onToggleStatus={() => void updateAgent(selectedAgent.id, { status: selectedAgent.status === "active" ? "paused" : "active" })} onToggleMute={() => void updateAgent(selectedAgent.id, { notifications_muted: selectedAgent.parsed_intent?.notifications_muted !== true })} onOpenSettings={() => { setDetailAgentId(selectedAgent.id); setView("agents"); }} onClear={() => void clearMessages()} onAction={(messageId, action) => { if (!demo) void api.messageAction(selectedAgent.id, messageId, action).then(() => queryClient.invalidateQueries({ queryKey: ["messages", selectedAgent.id] })); }} onFeedback={(messageId, value) => { if (!demo) void api.messageFeedback(messageId, value).then(() => showToast("Thanks for the feedback.")); }} /> : <div className="empty-thread"><Bot size={24} /><h3>No agent selected</h3></div>}</>}
    {view === "agents" && <AgentsPanel agents={agents} selected={detailAgent} onSelect={(agent) => setDetailAgentId(agent.id)} onCreate={() => setCreateOpen(true)} onOpenThread={selectThread} onUpdate={updateAgent} onDelete={deleteAgent} onRun={(agent) => void runAgent(agent)} />}
    {view === "connectors" && <ConnectorsPanel connectors={connectors} onConnect={connect} onDisconnect={disconnect} />}
    {view === "settings" && <SettingsPanel me={me} demo={demo} onExitDemo={onExitDemo} />}
    {view === "feedback" && <FeedbackPanel onSubmit={async (topic, message) => { if (!demo) await api.feedback(topic, message); }} />}

    {createOpen && <CreateAgentDialog recipes={recipes} onClose={() => setCreateOpen(false)} onParse={parseAgent} onCreate={createAgent} />}
    {commandOpen && <div className="command-backdrop" onMouseDown={() => setCommandOpen(false)}><section className="command-palette" onMouseDown={(event) => event.stopPropagation()}><div><Search size={18} /><input autoFocus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Search agents and views…" /><button onClick={() => setCommandOpen(false)}>esc</button></div><nav>{commandResults.map((result) => <button key={result.id} onClick={() => { result.action(); setCommandOpen(false); setCommandQuery(""); }}><span className="command-result-icon"><Command size={15} /></span><span><b>{result.label}</b><small>{result.note}</small></span></button>)}{commandResults.length === 0 && <p>No matching agents or views.</p>}</nav></section></div>}
    {toast && <div className="toast" role="status"><Sparkles size={15} />{toast}</div>}
  </main>;
}

function InboxPane({ agents, selectedAgentId, onSelect }: { agents: Agent[]; selectedAgentId?: string; onSelect: (agent: Agent) => void }) {
  const [filter, setFilter] = useState<"all" | "unread" | "active">("all");
  const [query, setQuery] = useState("");
  const visible = agents.filter((agent) => (filter === "unread" ? Boolean(agent.unread_count) : filter === "active" ? agent.status === "active" : true) && `${agent.name} ${agent.last_message_preview ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="inbox-pane"><header className="pane-header"><div><p className="eyebrow">Workspace</p><h1>Inbox</h1></div><div className="inbox-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label="Search inbox" /></div></header><div className="filter-row"><button className={`filter-chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button><button className={`filter-chip ${filter === "unread" ? "active" : ""}`} onClick={() => setFilter("unread")}>Unread <span>{agents.reduce((sum, agent) => sum + (agent.unread_count ?? 0), 0)}</span></button><button className={`filter-chip ${filter === "active" ? "active" : ""}`} onClick={() => setFilter("active")}>Active</button></div><div className="agent-list">{visible.map((agent) => <button key={agent.id} className={`agent-row ${agent.id === selectedAgentId ? "active" : ""}`} onClick={() => onSelect(agent)}><span className={`agent-avatar ${agentTone(agent.id)}`}><AgentIcon name={agent.avatar ?? (agent.is_assistant ? "sparkles" : "bot")} /></span><span className="agent-copy"><span className="agent-title"><b>{agent.name}</b><time>{relativeTime(agent.latest_message_at || agent.updated_at)}</time></span><small>{agent.last_message_preview || agent.description || "Ready when you are"}</small></span>{Boolean(agent.unread_count) && <span className="unread-count">{agent.unread_count}</span>}</button>)}{visible.length === 0 && <div className="inbox-empty"><Search size={21} /><p>No agents match this view.</p></div>}</div></section>;
}

function initials(value: string): string { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CU"; }
function relativeTime(value?: string): string { if (!value) return ""; const delta = Date.now() - new Date(value).getTime(); const minutes = Math.floor(delta / 60_000); if (minutes < 1) return "Now"; if (minutes < 60) return `${minutes}m`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h`; return `${Math.floor(hours / 24)}d`; }

function initialView(): ViewKey {
  if (typeof window === "undefined") return "overview";
  const requested = new URLSearchParams(window.location.search).get("view") as ViewKey | null;
  return requested && ["overview", "inbox", "agents", "connectors", "settings", "feedback"].includes(requested)
    ? requested
    : new URLSearchParams(window.location.search).has("agent")
      ? "inbox"
      : "overview";
}

function initialAgentId(): string {
  return typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("agent") ?? "";
}
