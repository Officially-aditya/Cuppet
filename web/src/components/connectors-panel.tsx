"use client";

import { AlertCircle, Circle, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { Connector } from "@/lib/types";
import { ConnectorLogo, getConnectorLogoPath } from "./connector-logo";

export function ConnectorsPanel({
  connectors,
  onConnect,
  onDisconnect
}: {
  connectors: Connector[];
  onConnect: (connector: Connector) => Promise<void>;
  onDisconnect: (connector: Connector) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

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

  return <section className="content-panel flutter-destination-panel">
    <header className="flutter-workspace-header destination-header">
      <div className="flutter-header-copy">
        <p className="flutter-eyebrow">Workspace setup</p>
        <div className="flutter-brand-title"><h1>Connect your tools</h1></div>
        <p className="flutter-subtitle">Choose which services Cuppet can connect to.</p>
      </div>
    </header>

    <div className="flutter-destination-list">
      <div className="flutter-section-label"><b>AVAILABLE SERVICES</b></div>
      {error && <p className="form-message error connector-error">{error}</p>}
      <div className="flutter-connector-list">
        {connectors.map((connector) => <article className="flutter-workspace-card flutter-connector-card" key={connector.id}>
          <div className="flutter-connector-heading">
            <ConnectorArtwork connector={connector} />
            <span><b>{connector.name}</b><small>{connector.description}</small></span>
          </div>
          <div className={`flutter-connector-status ${connector.status}`}>
            {busy === connector.id ? <LoaderCircle className="spin" size={18} /> : connector.status === "connected" ? <span className="radio-status active" /> : connector.status === "action_required" ? <AlertCircle size={18} /> : <Circle size={18} />}
            <b>{busy === connector.id ? "CONNECTING" : connector.status === "connected" ? "CONNECTED" : connector.status === "action_required" ? "RECONNECT REQUIRED" : "DISCONNECTED"}</b>
            <button className={`flutter-switch ${connector.status === "connected" ? "on" : ""}`} aria-label={`${connector.name} connector`} aria-pressed={connector.status === "connected"} disabled={busy === connector.id || connector.auth_configured === false} onClick={() => void toggle(connector)}><span /></button>
          </div>
        </article>)}
      </div>

      <aside className="flutter-privacy-panel"><span><ShieldCheck size={18} /></span><div><b>Access &amp; privacy</b><p>Cuppet only uses the access you approve. Connector tokens stay encrypted on Cuppet&apos;s backend, and agents stay within each connector&apos;s granted scopes.</p></div></aside>
    </div>
  </section>;
}

function ConnectorArtwork({ connector }: { connector: Connector }) {
  const logoPath = getConnectorLogoPath(connector.id, connector.provider_id, connector.name);
  return <span className={`flutter-connector-art ${logoPath ? "" : "fallback"}`}>
    <ConnectorLogo id={connector.id} providerId={connector.provider_id} name={connector.name} iconName={connector.icon_name} size={28} />
  </span>;
}
