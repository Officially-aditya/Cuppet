"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, LoaderCircle, Pause, Play, RefreshCw, Save, Shield, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { api, defaultPersonalizationSettings, errorMessage } from "@/lib/api";
import type { PersonalizationConsent, PersonalizationResponse, PersonalizationSettings as PersonalizationSettingsType, PreferenceProfileItem } from "@/lib/types";

const consentDefinitions = [
  { purpose: "explicit_feedback", title: "Direct feedback", description: "Use Useful and Not useful choices to improve future suggestions." },
  { purpose: "cuppet_activity", title: "Cuppet activity", description: "Use the actions you take in Cuppet to make suggestions more relevant." },
  { purpose: "connected_content", title: "Connected content", description: "Learn from the connected accounts and sources you approve." },
  { purpose: "browser_activity", title: "Browser activity", description: "Use activity shared through your Cuppet browser connection." },
  { purpose: "cross_source", title: "Cross-source learning", description: "Connect signals across approved sources to spot useful patterns." }
] as const;

type ProfileData = PersonalizationResponse & { items: PreferenceProfileItem[] };

export function PersonalizationSettingsPanel({ demo }: { demo: boolean }) {
  const client = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["personalization-profile"], queryFn: api.preferenceProfile, enabled: !demo });
  const [localSettings, setLocalSettings] = useState<PersonalizationSettingsType>(defaultPersonalizationSettings);
  const [localConsents, setLocalConsents] = useState<PersonalizationConsent[]>([]);
  const [localItems, setLocalItems] = useState<PreferenceProfileItem[]>([]);
  const [localBrowserConnected, setLocalBrowserConnected] = useState(false);
  const [browserToken, setBrowserToken] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [exclusion, setExclusion] = useState("");

  const profile = profileQuery.data as ProfileData | undefined;
  const settings = demo ? localSettings : profile?.settings ?? localSettings;
  const consents = demo ? localConsents : profile?.consents ?? localConsents;
  const items = demo ? localItems : profile?.items ?? localItems;
  const browserConnected = demo ? localBrowserConnected : profile?.browser_connected === true || localBrowserConnected;
  const consentMap = useMemo(() => new Map(consents.map((consent) => [consent.purpose, consent.status === "granted"])), [consents]);
  const saving = Boolean(busy);

  const clearFeedback = () => { setMessage(""); setError(""); };

  const saveSettings = async (patch: Partial<PersonalizationSettingsType>) => {
    clearFeedback();
    const next = { ...settings, ...patch };
    setLocalSettings(next);
    setBusy("settings");
    try {
      if (!demo) await api.updatePersonalization(patch);
      setMessage("Personalization settings saved.");
      await client.invalidateQueries({ queryKey: ["personalization"] });
      await client.invalidateQueries({ queryKey: ["personalization-profile"] });
    } catch (caught) {
      setLocalSettings(settings);
      setError(errorMessage(caught));
    } finally { setBusy(""); }
  };

  const toggleConsent = async (purpose: string, enabled: boolean) => {
    clearFeedback();
    setBusy(`consent:${purpose}`);
    try {
      if (!demo) {
        const result = enabled ? await api.grantPersonalizationConsent(purpose) : await api.revokePersonalizationConsent(purpose);
        setLocalConsents((current) => [...current.filter((item) => item.purpose !== purpose), result.consent]);
      }
      setMessage(`${enabled ? "Enabled" : "Disabled"} ${consentDefinitions.find((item) => item.purpose === purpose)?.title ?? "permission"}.`);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  };

  const connectBrowser = async () => {
    clearFeedback();
    setBusy("browser");
    try {
      if (demo) { setBrowserToken("demo-browser-connection-token"); setLocalBrowserConnected(true); }
      else {
        const response = await api.connectBrowserActivity();
        setBrowserToken(response.connection.token);
      }
      setLocalBrowserConnected(true);
      setMessage("Browser connection created. Copy the token into the Cuppet browser extension.");
      await client.invalidateQueries({ queryKey: ["personalization-profile"] });
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  };

  const disconnectBrowser = async () => {
    clearFeedback();
    setBusy("browser");
    try {
      if (!demo) await api.disconnectBrowserActivity();
      setLocalBrowserConnected(false);
      setBrowserToken("");
      setMessage("Browser activity disconnected.");
      await client.invalidateQueries({ queryKey: ["personalization-profile"] });
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  };

  const updateItem = async (item: PreferenceProfileItem) => {
    const nextKey = window.prompt("Update this preference", item.key)?.trim();
    if (!nextKey || nextKey === item.key) return;
    clearFeedback();
    setBusy(`item:${item.id}`);
    try {
      if (!demo) {
        const result = await api.updatePreferenceItem(item.id, { key: nextKey });
        setLocalItems((current) => current.map((candidate) => candidate.id === item.id ? result.item : candidate));
      } else setLocalItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, key: nextKey } : candidate));
      setMessage("Preference updated.");
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  };

  const deleteItem = async (item: PreferenceProfileItem) => {
    if (!window.confirm(`Remove “${item.key}” from the learned profile?`)) return;
    clearFeedback();
    setBusy(`item:${item.id}`);
    try {
      if (!demo) await api.deletePreferenceItem(item.id);
      setLocalItems((current) => current.filter((candidate) => candidate.id !== item.id));
      setMessage("Preference removed.");
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  };

  const addExclusion = async (event: FormEvent) => {
    event.preventDefault();
    const subjectKey = exclusion.trim();
    if (!subjectKey) return;
    clearFeedback();
    setBusy("exclusion");
    try {
      if (!demo) await api.createPreferenceExclusion({ subject_type: "topic", subject_key: subjectKey });
      setExclusion("");
      setMessage("Exclusion saved.");
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  };

  const resetProfile = async () => {
    if (!window.confirm("Reset learned preferences and exclusions?")) return;
    clearFeedback();
    setBusy("reset");
    try {
      if (!demo) await api.resetPreferenceProfile();
      setLocalItems([]);
      setMessage("Learned preferences reset.");
      await client.invalidateQueries({ queryKey: ["personalization-profile"] });
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  };

  const exportProfile = async () => {
    clearFeedback();
    setBusy("export");
    try {
      const data = demo ? { settings, consents, items } : await api.exportPreferenceProfile();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cuppet-preference-profile.json";
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Preference profile exported.");
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  };

  return <div className="settings-section personalization-settings">
    <div className="settings-title"><span><Shield size={20} /></span><div><h2>Personalization</h2><p>Choose what Cuppet may learn and when it may offer suggestions.</p></div></div>

    <div className="setting-card stacked personalization-primary-card">
      <div><b>Personalization</b><p>When enabled, Cuppet can learn from approved signals and explicit feedback.</p></div>
      <button className={`switch-button ${settings.enabled ? "on" : ""}`} disabled={saving} aria-pressed={settings.enabled} onClick={() => void saveSettings({ enabled: !settings.enabled })}><span /></button>
    </div>
    <div className="setting-card stacked">
      <div><b>{settings.learning_paused ? "Learning is paused" : "Learning is active"}</b><p>Pause learning without deleting the profile already saved.</p></div>
      <button className="secondary-button" disabled={saving} onClick={() => void saveSettings({ learning_paused: !settings.learning_paused })}>{settings.learning_paused ? <><Play size={14} />Resume</> : <><Pause size={14} />Pause</>}</button>
    </div>

    <div className="settings-subsection"><div className="settings-subsection-heading"><b>Permissions</b><small>Each permission is stored separately and can be revoked at any time.</small></div>{consentDefinitions.map((definition) => { const enabled = consentMap.get(definition.purpose) === true; return <div className="setting-card" key={definition.purpose}><div><b>{definition.title}</b><p>{definition.description}</p></div><button className={`switch-button ${enabled ? "on" : ""}`} disabled={busy === `consent:${definition.purpose}`} aria-pressed={enabled} onClick={() => void toggleConsent(definition.purpose, !enabled)}>{busy === `consent:${definition.purpose}` ? <LoaderCircle className="spin" size={15} /> : <span />}</button></div>; })}</div>

    <div className="settings-subsection"><div className="settings-subsection-heading"><b>Suggestion delivery</b><small>Control how often suggestions appear and when they stay quiet.</small></div>
      <div className="setting-card stacked"><div><b>Frequency</b><p>Choose how much proactive learning Cuppet should offer.</p></div><select value={settings.frequency} disabled={saving} onChange={(event) => void saveSettings({ frequency: event.target.value })}><option value="low">Low</option><option value="balanced">Balanced</option><option value="high">High</option></select></div>
      {([['in_chat', 'In chat', 'Show suggestions inside conversations.'], ['proactive', 'Proactive suggestions', 'Allow Cuppet to surface useful suggestions without a prompt.'], ['push', 'Push suggestions', 'Allow approved suggestions to arrive as browser notifications.']] as const).map(([key, title, description]) => <div className="setting-card" key={key}><div><b>{title}</b><p>{description}</p></div><button className={`switch-button ${settings[key] ? "on" : ""}`} disabled={saving} aria-pressed={settings[key]} onClick={() => void saveSettings({ [key]: !settings[key] })}><span /></button></div>)}
      <div className="setting-card quiet-hours-card"><div><b>Quiet hours</b><p>Suggestions stay quiet during this local time window.</p></div><div className="time-range"><label><span>From</span><input type="time" value={settings.quiet_hours_start} onChange={(event) => setLocalSettings((current) => ({ ...current, quiet_hours_start: event.target.value }))} onBlur={() => void saveSettings({ quiet_hours_start: settings.quiet_hours_start })} /></label><label><span>To</span><input type="time" value={settings.quiet_hours_end} onChange={(event) => setLocalSettings((current) => ({ ...current, quiet_hours_end: event.target.value }))} onBlur={() => void saveSettings({ quiet_hours_end: settings.quiet_hours_end })} /></label></div></div>
    </div>

    <div className="settings-subsection"><div className="settings-subsection-heading"><b>Browser activity</b><small>Connect only the browser activity you deliberately share with Cuppet.</small></div><div className="setting-card stacked"><div><b>{browserConnected ? "Browser connection active" : "No browser connection"}</b><p>{browserConnected ? "Use the token below in the Cuppet browser extension. Generate a new token whenever you need one." : "Create a one-time connection token to share approved browser activity."}</p>{browserToken && <code className="connection-token">{browserToken}</code>}</div><div className="setting-actions">{browserConnected && <button className="secondary-button" disabled={busy === "browser"} onClick={() => void disconnectBrowser()}><X size={14} />Disconnect</button>}<button className="primary-button" disabled={busy === "browser"} onClick={() => void connectBrowser()}>{busy === "browser" ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}{browserConnected ? "New token" : "Connect"}</button></div></div></div>

    <div className="settings-subsection"><div className="settings-subsection-heading"><b>Learned profile</b><small>These are the preference signals Cuppet has inferred. Remove anything that is not useful.</small></div>{items.length === 0 ? <div className="setting-card"><p className="muted-copy">No learned preferences yet. Explicit feedback will appear here when it creates a durable signal.</p></div> : items.map((item) => <div className="setting-card profile-item-card" key={item.id}><div><b>{item.key}</b><p>{item.dimension || "Topic"} · {Math.round((item.confidence ?? 0) * 100)}% confidence · {item.evidence_count ?? 0} signals</p></div><div className="setting-actions"><button className="icon-button subtle" aria-label={`Edit ${item.key}`} disabled={busy === `item:${item.id}`} onClick={() => void updateItem(item)}><Save size={14} /></button><button className="icon-button subtle danger-icon" aria-label={`Remove ${item.key}`} disabled={busy === `item:${item.id}`} onClick={() => void deleteItem(item)}><Trash2 size={14} /></button></div></div>)}<form className="exclusion-form" onSubmit={addExclusion}><input value={exclusion} onChange={(event) => setExclusion(event.target.value)} placeholder="Exclude a topic, source, or subject" /><button className="secondary-button" disabled={busy === "exclusion" || !exclusion.trim()}>Add exclusion</button></form></div>

    <div className="settings-form-actions personalization-actions"><button className="secondary-button" disabled={busy === "export"} onClick={() => void exportProfile()}><Download size={14} />Export profile</button><button className="secondary-button" disabled={busy === "reset"} onClick={() => void resetProfile()}><Trash2 size={14} />Reset learned profile</button></div>
    {message && <p className="form-message success">{message}</p>}{error && <p className="form-message error">{error}</p>}
  </div>;
}
