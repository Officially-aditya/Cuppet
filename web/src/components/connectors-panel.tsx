"use client";

import {
  Check,
  ChevronDown,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  PlugZap,
  RefreshCw,
  Search,
  ShieldCheck,
  Unplug
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Connector } from "@/lib/types";
import { AgentIcon, agentTone } from "./agent-icon";

export function ConnectorsPanel({
  connectors,
  onConnect,
  onDisconnect
}: {
  connectors: Connector[];
  onConnect: (connector: Connector) => Promise<void>;
  onDisconnect: (connector: Connector) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const groups = useMemo(() => {
    const filtered = connectors.filter((connector) => `${connector.name} ${connector.description} ${connector.category}`.toLowerCase().includes(query.toLowerCase()));
    return Object.entries(filtered.reduce<Record<string, Connector[]>>((result, connector) => { const key = connector.category || "More tools"; (result[key] ??= []).push(connector); return result; }, {}));
  }, [connectors, query]);
  const connected = connectors.filter((connector) => connector.status === "connected").length;

  const toggle = async (connector: Connector) => {
    setBusy(connector.id); setError("");
    try { if (connector.status === "connected") await onDisconnect(connector); else await onConnect(connector); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update this connection."); }
    finally { setBusy(null); }
  };

  return <section className="content-panel connectors-panel">
    <header className="content-header"><div><p className="eyebrow">Access</p><h1>Connectors</h1><p>Choose what Cuppet can read. Every connection stays scoped and revocable.</p></div><div className="connection-summary"><span><ShieldCheck size={18} /></span><b>{connected} connected</b><small>Read-only by default</small></div></header>
    <div className="connectors-toolbar"><div className="search-input"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools and services" /></div><div className="privacy-note"><LockKeyhole size={15} />Credentials stay on the backend and are never exposed to agents.</div></div>
    {error && <p className="form-message error connector-error">{error}</p>}
    <div className="connector-groups">{groups.map(([category, items]) => <section key={category}><div className="connector-category"><span>{category}</span><small>{items.length}</small></div><div className="connector-list">{items.map((connector) => <article className={`connector-card ${connector.status}`} key={connector.id}><div className={`connector-icon ${agentTone(connector.id)}`}><AgentIcon name={connector.icon_name} size={21} /></div><div className="connector-copy"><div><h3>{connector.name}</h3><span className={`connection-pill ${connector.status}`}>{connector.status === "connected" ? <Check size={12} /> : connector.status === "action_required" ? <RefreshCw size={12} /> : null}{connector.status.replace("_", " ")}</span></div><p>{connector.description}</p><button className="scope-toggle" onClick={() => setExpanded(expanded === connector.id ? null : connector.id)}>What Cuppet can access <ChevronDown className={expanded === connector.id ? "rotated" : ""} size={14} /></button>{expanded === connector.id && <div className="scope-list">{(connector.required_scopes?.length ? connector.required_scopes : ["Only the data required by agents you create"]).map((scope) => <span key={scope}><Check size={12} />{scope}</span>)}</div>}</div><button className={`connector-action ${connector.status === "connected" ? "disconnect" : "connect"}`} disabled={busy === connector.id || connector.auth_configured === false} onClick={() => void toggle(connector)}>{busy === connector.id ? <LoaderCircle className="spin" size={16} /> : connector.status === "connected" ? <><Unplug size={15} />Disconnect</> : <><PlugZap size={15} />{connector.status === "action_required" ? "Reconnect" : "Connect"}</>}</button></article>)}</div></section>)}</div>
    <div className="connector-footer"><ShieldCheck size={18} /><div><b>You stay in control</b><p>Disconnecting a tool revokes Cuppet’s access. Agents using it will pause or ask you to reconnect.</p></div><a href="https://cuppet.ai/privacy" target="_blank" rel="noreferrer">Privacy details <ExternalLink size={13} /></a></div>
  </section>;
}
