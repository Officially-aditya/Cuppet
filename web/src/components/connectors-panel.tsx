"use client";

import { AlertCircle, Circle, LoaderCircle, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { Connector } from "@/lib/types";
import { ConnectorLogo, getConnectorLogoPath } from "./connector-logo";

export function ConnectorsPanel({
  connectors,
  onConnect,
  onDisconnect,
  onCreateCustom,
  onDeleteCustom
}: {
  connectors: Connector[];
  onConnect: (connector: Connector) => Promise<void>;
  onDisconnect: (connector: Connector) => Promise<void>;
  onCreateCustom?: (value: { name: string; endpoint: string; description: string; capabilities: string[]; oauth_scopes: string[] }) => Promise<void>;
  onDeleteCustom?: (connector: Connector) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customBusy, setCustomBusy] = useState(false);
  const [customError, setCustomError] = useState("");
  const [custom, setCustom] = useState({ name: "", endpoint: "", description: "", capabilities: "read", oauth_scopes: "" });

  const visible = connectors;

  const toggle = async (connector: Connector) => {
    setBusy(connector.id);
    setError("");
    try {
      if (connector.status === "connected") await onDisconnect(connector);
      else await onConnect(connector);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update this connection.");
    } finally {
      setBusy(null);
    }
  };

  const submitCustom = async (event: FormEvent) => {
    event.preventDefault();
    setCustomBusy(true);
    const name = custom.name.trim();
    const endpoint = custom.endpoint.trim();
    const capabilities = custom.capabilities.split(",").map((item) => item.trim()).filter(Boolean);
    const oauthScopes = custom.oauth_scopes.split(",").map((item) => item.trim()).filter(Boolean);
    setCustomError("");
    try {
      const url = new URL(endpoint);
      if (!name || url.protocol !== "https:" || !capabilities.length) throw new Error("Enter a name, a public HTTPS endpoint, and at least one capability.");
      if (!onCreateCustom) await api.createCustomMcpProvider({ name, endpoint, description: custom.description.trim(), capabilities, oauth_scopes: oauthScopes });
      else await onCreateCustom({ name, endpoint, description: custom.description.trim(), capabilities, oauth_scopes: oauthScopes });
      setCustom({ name: "", endpoint: "", description: "", capabilities: "read", oauth_scopes: "" });
      setCustomOpen(false);
    } catch (caught) { setCustomError(errorMessage(caught)); }
    finally { setCustomBusy(false); }
  };

  const isCustom = (connector: Connector) => connector.id.startsWith("mcp.") || connector.category.toLowerCase().includes("custom");

  return <section className="content-panel flutter-destination-panel">
    <header className="flutter-workspace-header destination-header">
      <div className="flutter-header-copy">
        <p className="flutter-eyebrow">Workspace setup</p>
        <div className="flutter-brand-title"><h1>Connect your tools</h1></div>
        <p className="flutter-subtitle">Choose which services Cuppet can connect to.</p>
      </div>
      <button className="primary-button connector-custom-button" onClick={() => { setCustomOpen(true); setCustomError(""); }}><Plus size={15} />Custom MCP</button>
    </header>

    <div className="flutter-destination-list">
      <div className="flutter-section-label"><b>AVAILABLE SERVICES</b><span>{visible.length} available</span></div>
      {error && <p className="form-message error connector-error">{error}</p>}
      <div className="flutter-connector-list">
        {visible.map((connector) => <article className="flutter-workspace-card flutter-connector-card" key={connector.id}>
          <div className="flutter-connector-heading">
            <ConnectorArtwork connector={connector} />
            <span><b>{connector.name}</b><small>{connector.description}</small></span>
          </div>
          <div className={`flutter-connector-status ${connector.status}`}>
            {busy === connector.id ? <LoaderCircle className="spin" size={18} /> : connector.status === "connected" ? <span className="radio-status active" /> : connector.status === "action_required" ? <AlertCircle size={18} /> : <Circle size={18} />}
            <b>{busy === connector.id ? "CONNECTING" : connector.status === "connected" ? "CONNECTED" : connector.status === "action_required" ? "RECONNECT REQUIRED" : "DISCONNECTED"}</b>
            <button className={`flutter-switch ${connector.status === "connected" ? "on" : ""}`} aria-label={`${connector.name} connector`} aria-pressed={connector.status === "connected"} disabled={busy === connector.id || connector.auth_configured === false} onClick={() => void toggle(connector)}><span /></button>
            {isCustom(connector) && onDeleteCustom && <button className="icon-button subtle danger-icon" aria-label={`Remove ${connector.name}`} onClick={() => void onDeleteCustom(connector)}><Trash2 size={14} /></button>}
          </div>
        </article>)}
      </div>

      {visible.length === 0 && <div className="panel-empty"><span><Search size={20} /></span><h3>No connectors available</h3><p>Add a custom MCP provider to connect another service.</p></div>}

      <aside className="flutter-privacy-panel"><span><ShieldCheck size={18} /></span><div><b>Access &amp; privacy</b><p>Cuppet only uses the access you approve. Connector tokens stay encrypted on Cuppet&apos;s backend, and agents stay within each connector&apos;s granted scopes.</p></div></aside>
      {customOpen && <div className="dialog-backdrop" role="presentation"><section className="connector-dialog" role="dialog" aria-modal="true" aria-labelledby="custom-mcp-title"><header><div><p className="eyebrow">Workspace setup</p><h2 id="custom-mcp-title">Add custom MCP provider</h2></div><button className="icon-button" onClick={() => setCustomOpen(false)} aria-label="Close"><X size={18} /></button></header><form onSubmit={submitCustom}><p className="muted-copy">Connect a public HTTPS MCP endpoint. Cuppet will request only the capabilities and OAuth scopes you specify.</p><label><span>Provider name</span><input value={custom.name} onChange={(event) => setCustom((current) => ({ ...current, name: event.target.value }))} required placeholder="My MCP provider" /></label><label><span>Public HTTPS endpoint</span><input type="url" value={custom.endpoint} onChange={(event) => setCustom((current) => ({ ...current, endpoint: event.target.value }))} required placeholder="https://example.com/mcp" /></label><label><span>Description</span><textarea rows={3} value={custom.description} onChange={(event) => setCustom((current) => ({ ...current, description: event.target.value }))} placeholder="What this provider can do" /></label><label><span>Capabilities</span><input value={custom.capabilities} onChange={(event) => setCustom((current) => ({ ...current, capabilities: event.target.value }))} placeholder="read, search" /><small>Comma-separated capability names.</small></label><label><span>OAuth scopes <small>(optional)</small></span><input value={custom.oauth_scopes} onChange={(event) => setCustom((current) => ({ ...current, oauth_scopes: event.target.value }))} placeholder="profile, files.read" /></label>{customError && <p className="form-message error">{customError}</p>}<footer><button type="button" className="secondary-button" onClick={() => setCustomOpen(false)}>Cancel</button><button className="primary-button" disabled={customBusy}>{customBusy ? <LoaderCircle className="spin" size={14} /> : <Plus size={14} />}Add provider</button></footer></form></section></div>}
    </div>
  </section>;
}

function ConnectorArtwork({ connector }: { connector: Connector }) {
  const logoPath = getConnectorLogoPath(connector.id, connector.provider_id, connector.name);
  return <span className={`flutter-connector-art ${logoPath ? "" : "fallback"}`}>
    <ConnectorLogo id={connector.id} providerId={connector.provider_id} name={connector.name} iconName={connector.icon_name} size={28} />
  </span>;
}
