"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Database,
  Download,
  ExternalLink,
  LoaderCircle,
  LogOut,
  Save,
  Shield,
  Trash2,
  UserRound
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { disablePushNotifications, enablePushNotifications, pushConfigured } from "@/lib/notifications";
import type { CurrentUserResponse } from "@/lib/types";
import { DataSettingsPanel } from "./data-settings";
import { PersonalizationSettingsPanel } from "./personalization-settings";

type SettingsTab = "profile" | "notifications" | "data" | "personalization";

export function SettingsPanel({ me, demo, onExitDemo, onOpenConnectors }: { me: CurrentUserResponse; demo: boolean; onExitDemo?: () => void; onOpenConnectors: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<SettingsTab | null>(null);
  const [pushEnabled, setPushEnabled] = useState(() => typeof window !== "undefined" && Boolean(window.localStorage.getItem("cuppet-push-token")));
  const [pushBusy, setPushBusy] = useState(false);
  const [followDevice, setFollowDevice] = useState(me.preferences.follow_device_time_zone);
  const [timezoneBusy, setTimezoneBusy] = useState(false);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (demo) setPushEnabled((value) => !value);
      else if (pushEnabled) { await disablePushNotifications(); setPushEnabled(false); }
      else { await enablePushNotifications(); setPushEnabled(true); }
    } finally { setPushBusy(false); }
  };

  const toggleTimeZone = async () => {
    const next = !followDevice;
    setFollowDevice(next);
    setTimezoneBusy(true);
    try {
      if (!demo) await api.updatePreferences({ time_zone: next ? Intl.DateTimeFormat().resolvedOptions().timeZone : me.preferences.time_zone, follow_device_time_zone: next });
    } catch { setFollowDevice(!next); }
    finally { setTimezoneBusy(false); }
  };

  const signOut = async () => {
    if (demo) { onExitDemo?.(); return; }
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  };

  if (tab) return <section className="content-panel settings-panel flutter-settings-detail">
    <header className="flutter-detail-header"><button onClick={() => setTab(null)} aria-label="Back to settings"><ArrowLeft size={20} /></button><h1>{tab === "profile" ? "Profile" : tab === "notifications" ? "Notifications" : "Data & privacy"}</h1></header>
    <div className="settings-content">{tab === "profile" && <ProfileSettings key={`${me.user.name}-${me.preferences.time_zone}-${me.preferences.follow_device_time_zone}`} me={me} demo={demo} onExitDemo={onExitDemo} />}{tab === "notifications" && <NotificationSettings demo={demo} />}{tab === "data" && <DataSettingsPanel demo={demo} onOpenPersonalization={() => setTab("personalization")} />}{tab === "personalization" && <PersonalizationSettingsPanel demo={demo} />}</div>
  </section>;

  return <section className="content-panel settings-panel flutter-destination-panel">
    <header className="flutter-workspace-header destination-header"><div className="flutter-header-copy"><p className="flutter-eyebrow">Your account</p><div className="flutter-brand-title"><h1>Settings</h1></div><p className="flutter-subtitle">Preferences, security and scheduling.</p></div></header>
    <div className="flutter-settings-list">
      <SettingsGroupLabel label="Profile" />
      <button className="flutter-workspace-card flutter-profile-card" onClick={() => setTab("profile")}><span className="large-avatar">{initials(me.user.name || me.user.email)}</span><span><b>{me.user.name || "Cuppet User"}</b><small>{me.user.email}</small></span><ChevronRight size={20} /></button>

      <SettingsGroup label="Preferences">
        <SettingsTile icon="notification" title="Push notifications" description={pushEnabled ? "Message and agent status alerts are active." : "Enable message and agent status alerts."} trailing={<button className={`flutter-switch ${pushEnabled ? "on" : ""}`} disabled={pushBusy || (!pushConfigured() && !demo)} onClick={(event) => { event.stopPropagation(); void togglePush(); }} aria-pressed={pushEnabled}>{pushBusy ? <LoaderCircle className="spin" size={15} /> : <span />}</button>} />
        <SettingsTile icon="timezone" title={followDevice ? "Automatic time zone" : "Fixed time zone"} description={`${me.preferences.time_zone} · ${followDevice ? "Follows this device when it changes." : "Turn on automatic to follow this device."}`} trailing={<button className={`flutter-switch ${followDevice ? "on" : ""}`} disabled={timezoneBusy} onClick={(event) => { event.stopPropagation(); void toggleTimeZone(); }} aria-pressed={followDevice}>{timezoneBusy ? <LoaderCircle className="spin" size={15} /> : <span />}</button>} />
        <SettingsTile icon="memory" title="Memory" description="Review confirmed details remembered by Assistant." onClick={() => setTab("data")} />
        <SettingsTile icon="personalization" title="Personalization" description="Choose what Cuppet may learn to make fewer, more useful suggestions." onClick={() => setTab("personalization")} />
        <SettingsTile icon="storage" title="Storage" description="Manage 30-day history and Google Drive archives." onClick={() => setTab("data")} />
      </SettingsGroup>

      <SettingsGroup label="Security"><SettingsTile icon="connectors" title="Connectors" description="Review accounts approved for backend access." onClick={onOpenConnectors} /></SettingsGroup>
      <SettingsGroup label="Privacy"><SettingsTile icon="session" title="Session storage" description="Cuppet stores only your session token on this device. No browser fingerprints or passive scripts are injected." /></SettingsGroup>
      <button className="flutter-signout" onClick={() => void signOut()}><LogOut size={18} />Sign out</button>
    </div>
  </section>;
}

function SettingsGroupLabel({ label }: { label: string }) { return <div className="flutter-section-label settings-group-label"><b>{label.toUpperCase()}</b></div>; }

function SettingsGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <section className="flutter-settings-group"><SettingsGroupLabel label={label} /><div className="flutter-workspace-card flutter-settings-group-card">{children}</div></section>;
}

function SettingsTile({ icon, title, description, trailing, onClick }: { icon: string; title: string; description: string; trailing?: React.ReactNode; onClick?: () => void }) {
  const content = <><span className={`flutter-settings-icon settings-icon-${icon}`} /><span className="flutter-settings-copy"><b>{title}</b><small>{description}</small></span>{trailing ?? (onClick ? <ChevronRight size={20} /> : null)}</>;
  return onClick ? <button className="flutter-settings-tile" onClick={onClick}>{content}</button> : <div className="flutter-settings-tile">{content}</div>;
}

function ProfileSettings({ me, demo, onExitDemo }: { me: CurrentUserResponse; demo: boolean; onExitDemo?: () => void }) {
  const router = useRouter();
  const client = useQueryClient();
  const [name, setName] = useState(me.user.name ?? "");
  const [avatar, setAvatar] = useState(me.user.avatar ?? 1);
  const [timeZone, setTimeZone] = useState(me.preferences.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [followDevice, setFollowDevice] = useState(me.preferences.follow_device_time_zone);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setMessage("");
    try {
      if (!demo) { await Promise.all([api.updateMe({ name, avatar }), api.updatePreferences({ time_zone: timeZone, follow_device_time_zone: followDevice })]); await client.invalidateQueries({ queryKey: ["me"] }); }
      setMessage("Settings saved.");
    } catch (caught) { setError(errorMessage(caught)); }
  };
  const signOut = async () => { if (demo) { onExitDemo?.(); return; } await authClient.signOut(); router.replace("/"); router.refresh(); };
  return <form className="settings-section" onSubmit={save}><div className="settings-title"><span><UserRound size={20} /></span><div><h2>Your profile</h2><p>How you appear across your Cuppet workspace.</p></div></div><div className="profile-editor"><AvatarChoice value={avatar} label={initials(name || me.user.email)} selected /><div><b>{name || "Cuppet user"}</b><small>{me.user.email}</small></div></div><label><span>Display name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} /></label><div className="profile-avatar-section"><span className="profile-field-label">Choose avatar</span><div className="avatar-choice-grid">{Array.from({ length: 9 }, (_, index) => index + 1).map((value) => <button type="button" key={value} className={`avatar-choice-button ${avatar === value ? "selected" : ""}`} onClick={() => setAvatar(value)} aria-label={`Choose avatar ${value}`}><AvatarChoice value={value} label={avatarLabel(value)} selected={avatar === value} /></button>)}</div><small>Avatar choices are saved to your account and appear wherever your profile is shown.</small></div><div className="settings-rule" /><div className="settings-title compact"><span><Database size={18} /></span><div><h2>Time zone</h2><p>Scheduled agents use this time zone.</p></div></div><label className="switch-row"><span><b>Follow this device</b><small>Use {Intl.DateTimeFormat().resolvedOptions().timeZone} while you’re here.</small></span><input type="checkbox" checked={followDevice} onChange={(event) => { setFollowDevice(event.target.checked); if (event.target.checked) setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone); }} /></label><label><span>Workspace time zone</span><input value={timeZone} onChange={(event) => setTimeZone(event.target.value)} disabled={followDevice} placeholder="Asia/Kolkata" /></label>{message && <p className="form-message success">{message}</p>}{error && <p className="form-message error">{error}</p>}<div className="settings-form-actions"><button type="button" className="secondary-button" onClick={signOut}><LogOut size={15} />{demo ? "Exit demo" : "Sign out"}</button><button className="primary-button"><Save size={15} />Save changes</button></div></form>;
}

function avatarLabel(value: number): string { return ["CU", "A", "B", "C", "D", "E", "F", "G", "H"][value - 1] ?? "CU"; }

function AvatarChoice({ value, label, selected }: { value: number; label: string; selected?: boolean }) { return <span className={`avatar-choice avatar-choice-${value} ${selected ? "selected" : ""}`}>{label}</span>; }

function NotificationSettings({ demo }: { demo: boolean }) {
  const [enabled, setEnabled] = useState(() => typeof window !== "undefined" && Boolean(window.localStorage.getItem("cuppet-push-token")));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const toggle = async () => { setBusy(true); setMessage(""); try { if (demo) { setEnabled(!enabled); return; } if (enabled) { await disablePushNotifications(); setEnabled(false); } else { await enablePushNotifications(); setEnabled(true); } } catch (caught) { setMessage(errorMessage(caught)); } finally { setBusy(false); } };
  return <div className="settings-section"><div className="settings-title"><span><Bell size={20} /></span><div><h2>Browser notifications</h2><p>Get an update when an agent has something genuinely useful.</p></div></div><div className="setting-card"><div><b>Push notifications</b><p>{pushConfigured() || demo ? "Delivered by this browser, even when Cuppet isn’t open." : "Add Firebase web credentials to enable push on this deployment."}</p></div><button className={`switch-button ${enabled ? "on" : ""}`} onClick={() => void toggle()} disabled={busy || (!pushConfigured() && !demo)} aria-pressed={enabled}>{busy ? <LoaderCircle className="spin" size={15} /> : <span />}</button></div><div className="setting-card"><div><b>Agent-level controls</b><p>Mute or resume notifications from each agent’s thread menu.</p></div><span className="quiet-pill"><Check size={13} />Available per agent</span></div>{message && <p className="form-message error">{message}</p>}<div className="privacy-callout"><Shield size={18} /><p>Cuppet only sends a notification after an agent produces an update. Notification content follows your browser privacy settings.</p></div></div>;
}

function LegacyDataSettings({ demo }: { demo: boolean }) {
  const router = useRouter();
  const client = useQueryClient();
  const memories = useQuery({ queryKey: ["memories"], queryFn: api.memories, enabled: !demo });
  const archive = useQuery({ queryKey: ["archive"], queryFn: api.archiveState, enabled: !demo });
  const [archiveDemo, setArchiveDemo] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const toggleArchive = async () => { setBusy("archive"); setMessage(""); try { if (demo) { setArchiveDemo(!archiveDemo); return; } const result = await api.updateArchive(!archive.data?.enabled); if (result.authorization?.auth_url) window.open(result.authorization.auth_url, "cuppet-oauth", "popup,width=620,height=760"); await client.invalidateQueries({ queryKey: ["archive"] }); } catch (caught) { setMessage(errorMessage(caught)); } finally { setBusy(""); } };
  const clearMemories = async () => { if (!window.confirm("Forget all confirmed Assistant memories?")) return; setBusy("memories"); try { if (!demo) await api.deleteMemories(); await client.invalidateQueries({ queryKey: ["memories"] }); } finally { setBusy(""); } };
  const deleteAccount = async () => { setBusy("account"); try { if (!demo) { await api.deleteAccount(); await authClient.signOut(); } router.replace("/"); router.refresh(); } catch (caught) { setMessage(errorMessage(caught)); setBusy(""); } };
  const memoryCount = demo ? 3 : memories.data?.memories.length ?? 0;
  const archiveEnabled = demo ? archiveDemo : archive.data?.enabled ?? false;
  return <div className="settings-section"><div className="settings-title"><span><Shield size={20} /></span><div><h2>Data & privacy</h2><p>Review what Cuppet remembers and where messages are stored.</p></div></div><div className="setting-card stacked"><div><b>Assistant memory</b><p>{memoryCount ? `${memoryCount} confirmed ${memoryCount === 1 ? "memory" : "memories"} help Cuppet personalize useful responses.` : "The Assistant has no confirmed memories yet."}</p></div><button className="secondary-button" disabled={!memoryCount || busy === "memories"} onClick={() => void clearMemories()}><Trash2 size={14} />Forget all</button></div><div className="setting-card stacked"><div><b>Google Drive message archive</b><p>Optionally keep an export of agent messages in a Drive folder you control.</p>{archive.data?.folder_link && <a href={archive.data.folder_link} target="_blank" rel="noreferrer">Open archive folder <ExternalLink size={12} /></a>}</div><button className={`switch-button ${archiveEnabled ? "on" : ""}`} onClick={() => void toggleArchive()} disabled={busy === "archive"}>{busy === "archive" ? <LoaderCircle className="spin" size={15} /> : <span />}</button></div><div className="setting-card stacked"><div><b>Export preference profile</b><p>Download the portable preferences Cuppet has learned from explicit feedback.</p></div><a className="secondary-button" href={demo ? "#" : "/api/users/me/preference-profile/export"} download><Download size={14} />Export JSON</a></div><div className="danger-zone account-danger"><div><b>Delete Cuppet account</b><p>Permanently removes agents, messages, connections, and account data.</p></div>{!confirmDelete ? <button onClick={() => setConfirmDelete(true)}><Trash2 size={15} />Delete account</button> : <div className="delete-confirm"><span>Are you sure?</span><button className="secondary-button" onClick={() => setConfirmDelete(false)}>Cancel</button><button onClick={() => void deleteAccount()} disabled={busy === "account"}>{busy === "account" ? "Deleting…" : "Delete permanently"}</button></div>}</div>{message && <p className="form-message error">{message}</p>}</div>;
}

void LegacyDataSettings;

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CU";
}
