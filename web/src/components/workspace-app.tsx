"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bot,
  Command,
  LoaderCircle,
  Menu,
  MessageSquareText,
  Plus,
  Pin,
  Search,
  Settings2,
  Sparkles,
  X
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { demoAgents, demoConnectors, demoMessages, demoRecipes, demoUser } from "@/lib/demo-data";
import type { Agent, AgentMessage, AgentRecipe, Connector, CurrentUserResponse, MessageAction, ViewKey } from "@/lib/types";
import { AgentIcon, agentTone } from "./agent-icon";
import { AgentsPanel } from "./agents-panel";
import { ConnectorsPanel } from "./connectors-panel";
import { ConnectorLogo } from "./connector-logo";
import { CreateAgentDialog } from "./create-agent-dialog";
import { FeedbackPanel } from "./feedback-panel";
import { OverviewPanel } from "./overview-panel";
import { SettingsPanel } from "./settings-panel";
import { ThreadView } from "./thread-view";

const navItems: Array<{ id: ViewKey; label: string; iconClass: string }> = [
  { id: "inbox", label: "Inbox", iconClass: "app-nav-inbox" },
  { id: "connectors", label: "Connectors", iconClass: "app-nav-connectors" },
  { id: "settings", label: "Settings", iconClass: "app-nav-settings" }
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
  const personalizationQuery = useQuery({ queryKey: ["personalization"], queryFn: api.personalization, enabled: !demo });

  const me: CurrentUserResponse = demo ? demoUser : meQuery.data ?? { user: { id: "", email: "", name: "" }, preferences: { time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone, follow_device_time_zone: true } };
  const agents = useMemo(
    () => (demo ? demoAgentState : agentsQuery.data?.agents ?? []),
    [agentsQuery.data?.agents, demo, demoAgentState]
  );
  const connectors = demo ? demoConnectorState : connectorsQuery.data ?? [];
  const recipes = demo ? demoRecipes : recipesQuery.data?.recipes ?? [];
  const briefings = demo ? (demoMessageState.daily?.filter((message) => message.content && typeof message.content === "object" && message.content.template === "briefing_card") ?? []) : briefingsQuery.data?.briefings ?? [];
  const persistedFeedback = useMemo(() => {
    const feedback: Record<string, string> = {};
    for (const item of personalizationQuery.data?.feedback ?? []) feedback[item.message_id] = item.feedback_type;
    return feedback;
  }, [personalizationQuery.data?.feedback]);
  const [localMessageFeedback, setLocalMessageFeedback] = useState<Record<string, string>>({});
  const messageFeedback = useMemo(
    () => ({ ...persistedFeedback, ...localMessageFeedback }),
    [localMessageFeedback, persistedFeedback]
  );
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

  const parseAgent = async (prompt: string, recipe?: AgentRecipe) => {
    if (demo) {
      const connectorIds = recipe?.required_connectors ?? (prompt.toLowerCase().includes("gmail") || prompt.toLowerCase().includes("inbox") ? ["gmail"] : []);
      return {
        parsed_intent: {
          name: recipe?.name ?? (prompt.includes("inbox") ? "Inbox helper" : "New useful agent"),
          action: recipe?.description ?? prompt,
          schedule_label: recipe ? "Configured template schedule" : /every|weekday|daily|weekly/i.test(prompt) ? "On the schedule you described" : "On demand",
          connector_ids: connectorIds
        }
      };
    }
    return api.parseAgent({ prompt, ...recipeRequest(recipe) });
  };

  const createAgent = async (prompt: string, recipe?: AgentRecipe) => {
    if (demo) {
      const id = `demo-${Date.now()}`;
      const agent: Agent = { id, name: recipe?.name ?? (prompt.split(/[,.]/)[0]!.slice(0, 42) || "New agent"), description: recipe?.description ?? prompt, prompt, status: "active", avatar: recipe?.icon ?? "sparkles", connector_ids: recipe?.required_connectors, last_message_preview: "Agent created and ready", latest_message_at: new Date().toISOString(), unread_count: 1 };
      setDemoAgentState((current) => [...current, agent]);
      setDemoMessageState((current) => ({ ...current, [id]: [{ id: `${id}-welcome`, agent_id: id, role: "agent", created_at: new Date().toISOString(), content: { template: "plain_text", data: { headline: "Agent ready", body: "I’m set up. You can run me now, or refine my instructions from Agent settings." } } }] }));
      selectThread(agent);
    } else {
      const result = await api.createAgent({ prompt, ...recipeRequest(recipe) });
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

  const sendMessage = async (text: string, attachmentIds?: string[], sourceMessageId?: string) => {
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
        await api.sendMessage(selectedAgent.id, { ...(text ? { text } : {}), ...(attachmentIds?.length ? { attachment_ids: attachmentIds } : {}), ...(sourceMessageId ? { source_message_id: sourceMessageId } : {}) });
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

  const handleMessageAction = async (messageId: string, action: MessageAction) => {
    if (demo || !selectedAgent) return;
    try {
      if (action.type === "message_action") {
        await api.messageAction(selectedAgent.id, messageId, String(action.action ?? ""));
      } else if (action.type === "suggestion_decision") {
        const suggestionId = String(action.suggestion_id ?? "");
        if (!suggestionId) return;
        if (action.decision === "explain") {
          const explanation = await api.suggestionExplanation(suggestionId);
          showToast(String(explanation.explanation?.summary ?? "Suggestion explanation loaded."));
        } else await api.suggestionDecision(suggestionId, String(action.decision ?? ""));
      } else if (action.type === "assistant_pending_action") {
        const pendingActionId = String(action.pending_action_id ?? "");
        const decision = String(action.decision ?? "");
        if (!pendingActionId || !decision) return;
        await api.assistantAction(selectedAgent.id, { ...action, decision, pending_action_id: pendingActionId });
      } else if (action.type === "message_activity") {
        const subjectKey = String(action.subject_key ?? "").trim();
        if (!subjectKey) return;
        await api.messageActivity(messageId, { activity_type: String(action.activity_type ?? "view"), subject_type: String(action.subject_type ?? "topic"), subject_key: subjectKey });
      } else if (action.type === "open_in_assistant") {
        const handoff = await api.handoffToAssistant(selectedAgent.id, messageId);
        const assistant = agents.find((candidate) => candidate.id === handoff.assistant_agent_id);
        if (assistant) selectThread(assistant);
      } else if (action.type === "send_message") {
        await api.sendMessage(selectedAgent.id, { text: String(action.text ?? ""), ...(action.source_message_id ? { source_message_id: action.source_message_id } : {}) });
      } else if (action.type === "connector_action") {
        const connectorId = String(action.connector_id ?? "");
        const connector = connectors.find((candidate) => candidate.id === connectorId);
        if (connector) await connect(connector);
      }
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["messages", selectedAgent.id] }), queryClient.invalidateQueries({ queryKey: ["agents"] }), queryClient.invalidateQueries({ queryKey: ["personalization"] })]);
    } catch (caught) { showToast(errorMessage(caught)); }
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

  const createCustomConnector = async (value: { name: string; endpoint: string; description: string; capabilities: string[]; oauth_scopes: string[] }) => {
    if (demo) {
      const connector: Connector = { id: `mcp.demo.${Date.now()}`, name: value.name, description: value.description || "Read approved data from this MCP provider.", category: "CUSTOM MCP", status: "disconnected", icon_name: "Extension", auth_configured: true, auth_method: "oauth2", required_scopes: value.oauth_scopes };
      setDemoConnectorState((current) => [...current, connector]);
    } else { await api.createCustomMcpProvider(value); await queryClient.invalidateQueries({ queryKey: ["connectors"] }); }
    showToast("Custom MCP provider added.");
  };

  const deleteCustomConnector = async (connector: Connector) => {
    if (!window.confirm(`Remove ${connector.name}?`)) return;
    if (demo) setDemoConnectorState((current) => current.filter((item) => item.id !== connector.id));
    else { await api.deleteCustomMcpProvider(connector.provider_id ?? connector.id); await queryClient.invalidateQueries({ queryKey: ["connectors"] }); }
    showToast("Custom MCP provider removed.");
  };

  const commandResults = useMemo(() => {
    const navigation = navItems.filter((item) => item.label.toLowerCase().includes(commandQuery.toLowerCase())).map((item) => ({ id: `nav-${item.id}`, label: item.label, note: "Go to view", action: () => setView(item.id) }));
    const agentResults = agents.filter((agent) => agent.name.toLowerCase().includes(commandQuery.toLowerCase())).slice(0, 6).map((agent) => ({ id: `agent-${agent.id}`, label: agent.name, note: "Open agent thread", action: () => selectThread(agent) }));
    return [...navigation, ...agentResults];
  }, [agents, commandQuery, setView]);

  if (loading) return <main className="boot-screen"><span className="brand-mark"><Sparkles size={19} /></span><LoaderCircle className="spin" size={18} /><span>Gathering your agents…</span></main>;
  if (!demo && (agentsQuery.error || meQuery.error)) return <main className="boot-screen error-state"><span className="brand-mark"><X size={19} /></span><h1>We couldn’t open your workspace.</h1><p>{errorMessage(agentsQuery.error || meQuery.error)}</p><button className="primary-button" onClick={() => window.location.reload()}>Try again</button></main>;

  const inboxPane = <InboxPane agents={agents} briefings={briefings} firstName={(me.user.name || "").split(" ")[0] || ""} selectedAgentId={selectedAgent?.id} view={view} onNavigate={setView} onSelect={selectThread} onCreate={() => setCreateOpen(true)} onFeedback={() => setView("feedback")} />;

  return <main className={`workspace-shell live-workspace view-${view} ${threadOpen ? "mobile-thread-open" : ""}`}>
    <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
      {demo && <div className="demo-badge" title="Demo workspace"><Sparkles size={12} /><span>Demo workspace</span></div>}
      <div className="sidebar-section"><p className="eyebrow">Recent agents</p>{agents.filter((agent) => !agent.is_assistant).slice(0, 4).map((agent) => <button key={agent.id} className={`mini-thread ${effectiveSelectedAgentId === agent.id && view === "inbox" ? "active" : ""}`} onClick={() => selectThread(agent)}><span className={`mini-avatar ${agentTone(agent.id)}`}><AgentIcon name={agent.avatar} size={14} /></span><span><b>{agent.name}</b><small>{agent.last_message_preview || agent.description}</small></span>{Boolean(agent.unread_count) && <i>{agent.unread_count}</i>}</button>)}</div>
      <div className="sidebar-spacer" />
      <button className="command-button" title="Search" onClick={() => setCommandOpen(true)}><Search size={17} />Search<span>⌘K</span></button>
      <button className="new-agent-button" title="New agent" onClick={() => setCreateOpen(true)}><Plus size={19} />New agent</button>
      <button title="Settings" aria-label="Open settings" className={`profile-row ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}><span className={`profile-avatar profile-avatar-${me.user.avatar ?? 1}`}>{initials(me.user.name || me.user.email)}</span><span><b>{me.user.name || "Cuppet user"}</b><small>{demo ? "Demo workspace" : me.user.email}</small></span><Settings2 size={16} /></button>
      <button className="feedback-link" title="Send feedback" onClick={() => setView("feedback")}><MessageSquareText size={17} />Send feedback</button>
    </aside>
    {view !== "inbox" && <DestinationNav view={view} agents={agents} onNavigate={setView} className="bottom-nav-mobile-only" />}
    {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
    <button className="mobile-nav-trigger icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>

    {view === "inbox" && <>{inboxPane}{selectedAgent ? <ThreadView key={selectedAgent.id} agent={selectedAgent} messages={messages} feedback={messageFeedback} loading={!demo && messagesQuery.isLoading} sending={sending} onBack={() => setThreadOpen(false)} onSend={sendMessage} onLoadArchived={demo ? undefined : (cursor) => api.archivedMessages(selectedAgent.id, cursor)} onUpload={demo ? async (file) => ({ id: `file-${Date.now()}`, name: file.name }) : async (file) => { const result = await api.upload(file); return { id: result.file.id, name: result.file.name }; }} onRun={() => void runAgent(selectedAgent)} onToggleMute={() => void updateAgent(selectedAgent.id, { notifications_muted: selectedAgent.parsed_intent?.notifications_muted !== true })} onOpenSettings={() => { setDetailAgentId(selectedAgent.id); setView("agents"); }} onClear={() => void clearMessages()} onAction={(messageId, action) => void handleMessageAction(messageId, action)} onFeedback={(messageId, value, subjectKey) => { setLocalMessageFeedback((current) => ({ ...current, [messageId]: value })); if (!demo) void api.messageFeedback(messageId, value, subjectKey).then(() => { void queryClient.invalidateQueries({ queryKey: ["personalization"] }); showToast("Thanks for the feedback."); }).catch((error) => showToast(errorMessage(error))); }} /> : <div className="empty-thread"><Bot size={24} /><h3>No agent selected</h3></div>}</>}
    {view !== "inbox" && <>{inboxPane}{view === "overview" && <OverviewPanel agents={agents} briefings={briefings} firstName={(me.user.name || "").split(" ")[0] || ""} onSelectAgent={(id) => { const agent = agents.find((item) => item.id === id); if (agent) selectThread(agent); }} onCreateAgent={() => setCreateOpen(true)} />}{view === "agents" && <AgentsPanel agents={agents} selected={detailAgent} onSelect={(agent) => setDetailAgentId(agent.id)} onCreate={() => setCreateOpen(true)} onOpenThread={selectThread} onUpdate={updateAgent} onDelete={deleteAgent} onRun={(agent) => void runAgent(agent)} />}{view === "connectors" && <ConnectorsPanel connectors={connectors} onConnect={connect} onDisconnect={disconnect} onCreateCustom={createCustomConnector} onDeleteCustom={deleteCustomConnector} />}{view === "settings" && <SettingsPanel me={me} demo={demo} onExitDemo={onExitDemo} onOpenConnectors={() => setView("connectors")} />}{view === "feedback" && <FeedbackPanel onBack={() => setView("inbox")} onSubmit={async (topic, message) => { if (!demo) await api.feedback(topic, message); }} />}</>}

    {createOpen && <CreateAgentDialog recipes={recipes} onClose={() => setCreateOpen(false)} onParse={parseAgent} onCreate={createAgent} />}
    {commandOpen && <div className="command-backdrop" onMouseDown={() => setCommandOpen(false)}><section className="command-palette" onMouseDown={(event) => event.stopPropagation()}><div><Search size={18} /><input autoFocus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Search agents and views…" /><button onClick={() => setCommandOpen(false)}>esc</button></div><nav>{commandResults.map((result) => <button key={result.id} onClick={() => { result.action(); setCommandOpen(false); setCommandQuery(""); }}><span className="command-result-icon"><Command size={15} /></span><span><b>{result.label}</b><small>{result.note}</small></span></button>)}{commandResults.length === 0 && <p>No matching agents or views.</p>}</nav></section></div>}
    {toast && <div className="toast" role="status"><Sparkles size={15} />{toast}</div>}
  </main>;
}

function recipeRequest(recipe?: AgentRecipe): Record<string, unknown> {
  if (!recipe?.id) return {};
  const recipeInputs: Record<string, unknown> = {};
  for (const field of recipe.fields ?? []) {
    const key = field.id ?? field.key;
    const value = field.default !== undefined ? field.default : field.default_value;
    if (key && value !== undefined) recipeInputs[key] = value;
  }
  return {
    recipe_id: recipe.id,
    ...(recipe.version ? { recipe_version: recipe.version } : {}),
    ...(Object.keys(recipeInputs).length ? { recipe_inputs: recipeInputs } : {})
  };
}

function InboxPane({ agents, briefings, firstName, selectedAgentId, view, onNavigate, onSelect, onCreate, onFeedback }: { agents: Agent[]; briefings: AgentMessage[]; firstName: string; selectedAgentId?: string; view: ViewKey; onNavigate: (view: ViewKey) => void; onSelect: (agent: Agent) => void; onCreate: () => void; onFeedback: () => void }) {
  const openBriefing = (briefing: AgentMessage) => {
    const assistant = agents.find((agent) => agent.is_assistant);
    const source = agents.find((agent) => agent.id === briefing.agent_id);
    if (assistant || source) onSelect(assistant ?? source!);
  };

  return <section className="inbox-pane flutter-inbox">
    <header className="flutter-workspace-header">
      <div className="flutter-header-copy">
        <p className="flutter-eyebrow">{firstName ? `${firstName[0]!.toUpperCase()}${firstName.slice(1)}'s Workspace` : "Your workspace"}</p>
        <div className="flutter-brand-title"><Image src="/cuppet-mark.png" alt="" width={36} height={36} /><h1>Cuppet</h1></div>
        <p className="flutter-subtitle">Your delegation agents</p>
      </div>
      <button className="flutter-feedback-button" onClick={onFeedback}>Feedback</button>
    </header>

    <div className="flutter-inbox-list">
      {briefings.length > 0 && <section className="flutter-briefings">
        <div className="flutter-section-label"><b>BRIEFINGS</b><span>Tap to explore with Assistant</span></div>
        {briefings.map((briefing) => <BriefingPreview key={briefing.id} briefing={briefing} onOpen={() => openBriefing(briefing)} />)}
      </section>}
      <section className="flutter-agent-list" aria-label="Agents">
        {agents.map((agent) => <button key={agent.id} className={`flutter-agent-card ${agent.id === selectedAgentId ? "selected" : ""}`} onClick={() => onSelect(agent)}>
          {agent.is_assistant ? <Image className="flutter-assistant-avatar" src="/cuppet-app-icon.png" alt="" width={44} height={44} /> : <span className={`flutter-agent-avatar ${agentTone(agent.id)}`}>{initials(agent.name)}</span>}
          <span className="flutter-agent-copy"><span className="flutter-agent-title"><b>{agent.name}</b>{agent.is_assistant && <Pin size={14} />}<time>{agent.is_assistant ? "Pinned" : relativeTime(agent.latest_message_at || agent.updated_at)}</time></span><span className={agent.unread_count ? "unread-preview" : ""}>{agent.last_message_preview || agent.description || "Ready when you are"}</span></span>
          {Boolean(agent.unread_count) && <span className="flutter-unread-count">{Math.min(agent.unread_count ?? 0, 3)}{(agent.unread_count ?? 0) > 3 ? "+" : ""}</span>}
        </button>)}
      </section>
    </div>

    <button className="flutter-new-agent" onClick={onCreate}><Plus size={20} /><span>New Agent</span></button>
    <DestinationNav view={view} agents={agents} onNavigate={onNavigate} className="agent-sidebar-nav" />
  </section>;
}

function DestinationNav({ view, agents, onNavigate, className = "" }: { view: ViewKey; agents: Agent[]; onNavigate: (view: ViewKey) => void; className?: string }) {
  const unreadCount = agents.reduce((sum, agent) => sum + (agent.unread_count ?? 0), 0);
  return <nav className={`bottom-nav ${className}`.trim()} aria-label="Primary navigation">{navItems.map(({ id, label, iconClass }) => <button key={id} type="button" data-nav-id={id} title={label} aria-current={view === id ? "page" : undefined} className={`bottom-nav-item ${view === id ? "active" : ""}`} onClick={() => onNavigate(id)}><span className={`app-nav-icon ${iconClass}`} aria-hidden="true" /><span>{label}</span>{id === "inbox" && unreadCount > 0 && <b className="bottom-nav-count">{unreadCount}</b>}</button>)}</nav>;
}

function BriefingPreview({ briefing, onOpen }: { briefing: AgentMessage; onOpen: () => void }) {
  const data = briefingData(briefing);
  const sections = Array.isArray(data.sections) ? data.sections.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)).slice(0, 3) : [];
  const updates = sections.map((section) => {
    const items = Array.isArray(section.items) ? section.items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
    return { source: stringValue(section.source || section.title) || "Update", title: stringValue(items[0]?.title) };
  }).filter((item) => item.title);
  const summary = updates.length ? updates.map((item) => `${item.source}: ${item.title}`).join(" · ") : stringValue(data.summary) || "No new updates from connected sources.";
  return <button className="flutter-briefing-card" onClick={onOpen}>
    <span className="flutter-briefing-heading"><b>{(stringValue(data.eyebrow) || "Briefing").toUpperCase()}</b><ArrowRight size={17} /></span>
    <strong>{stringValue(data.title) || "Your briefing"}</strong>
    <span className="flutter-briefing-summary">{summary}</span>
    {updates.length > 0 && <span className="flutter-briefing-sources">{updates.map((item, index) => <i key={`${item.source}-${index}`} title={item.source}><ConnectorLogo name={item.source} size={16} /></i>)}</span>}
  </button>;
}

function briefingData(message: AgentMessage): Record<string, unknown> {
  if (typeof message.content === "string" || !message.content?.data || typeof message.content.data !== "object" || Array.isArray(message.content.data)) return {};
  return message.content.data as Record<string, unknown>;
}

function stringValue(value: unknown): string { return typeof value === "string" ? value : typeof value === "number" ? String(value) : ""; }

function initials(value: string): string { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CU"; }
function relativeTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function initialView(): ViewKey {
  if (typeof window === "undefined") return "inbox";
  const requested = new URLSearchParams(window.location.search).get("view") as ViewKey | null;
  return requested && ["overview", "inbox", "agents", "connectors", "settings", "feedback"].includes(requested)
    ? requested
    : "inbox";
}

function initialAgentId(): string {
  return typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("agent") ?? "";
}
