"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
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

type SettingsTab = "profile" | "notifications" | "data";

export function SettingsPanel({ me, demo, onExitDemo }: { me: CurrentUserResponse; demo: boolean; onExitDemo?: () => void }) {
  const [tab, setTab] = useState<SettingsTab>("profile");
  return <section className="content-panel settings-panel"><header className="content-header"><div><p className="eyebrow">Account</p><h1>Settings</h1><p>Profile, notifications, privacy, and workspace data.</p></div></header><div className="settings-layout"><nav className="settings-nav"><button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><UserRound size={17} />Profile</button><button className={tab === "notifications" ? "active" : ""} onClick={() => setTab("notifications")}><Bell size={17} />Notifications</button><button className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}><Shield size={17} />Data & privacy</button></nav><div className="settings-content">{tab === "profile" && <ProfileSettings key={`${me.user.name}-${me.preferences.time_zone}-${me.preferences.follow_device_time_zone}`} me={me} demo={demo} onExitDemo={onExitDemo} />}{tab === "notifications" && <NotificationSettings demo={demo} />}{tab === "data" && <DataSettings demo={demo} />}</div></div></section>;
}

function ProfileSettings({ me, demo, onExitDemo }: { me: CurrentUserResponse; demo: boolean; onExitDemo?: () => void }) {
  const router = useRouter();
  const client = useQueryClient();
  const [name, setName] = useState(me.user.name ?? "");
  const [timeZone, setTimeZone] = useState(me.preferences.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [followDevice, setFollowDevice] = useState(me.preferences.follow_device_time_zone);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const save = async (event: FormEvent) => { event.preventDefault(); setError(""); setMessage(""); try { if (!demo) { await Promise.all([api.updateMe({ name }), api.updatePreferences({ time_zone: timeZone, follow_device_time_zone: followDevice })]); await client.invalidateQueries({ queryKey: ["me"] }); } setMessage("Settings saved."); } catch (caught) { setError(errorMessage(caught)); } };
  const signOut = async () => { if (demo) { onExitDemo?.(); return; } await authClient.signOut(); router.replace("/"); router.refresh(); };
  return <form className="settings-section" onSubmit={save}><div className="settings-title"><span><UserRound size={20} /></span><div><h2>Your profile</h2><p>How you appear across your Cuppet workspace.</p></div></div><div className="profile-editor"><span className="large-avatar">{initials(name || me.user.email)}</span><div><b>{name || "Cuppet user"}</b><small>{me.user.email}</small></div></div><label><span>Display name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} /></label><div className="settings-rule" /><div className="settings-title compact"><span><Database size={18} /></span><div><h2>Time zone</h2><p>Scheduled agents use this time zone.</p></div></div><label className="switch-row"><span><b>Follow this device</b><small>Use {Intl.DateTimeFormat().resolvedOptions().timeZone} while you’re here.</small></span><input type="checkbox" checked={followDevice} onChange={(event) => { setFollowDevice(event.target.checked); if (event.target.checked) setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone); }} /></label><label><span>Workspace time zone</span><input value={timeZone} onChange={(event) => setTimeZone(event.target.value)} disabled={followDevice} placeholder="Asia/Kolkata" /></label>{message && <p className="form-message success">{message}</p>}{error && <p className="form-message error">{error}</p>}<div className="settings-form-actions"><button type="button" className="secondary-button" onClick={signOut}><LogOut size={15} />{demo ? "Exit demo" : "Sign out"}</button><button className="primary-button"><Save size={15} />Save changes</button></div></form>;
}

function NotificationSettings({ demo }: { demo: boolean }) {
  const [enabled, setEnabled] = useState(() => typeof window !== "undefined" && Boolean(window.localStorage.getItem("cuppet-push-token")));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const toggle = async () => { setBusy(true); setMessage(""); try { if (demo) { setEnabled(!enabled); return; } if (enabled) { await disablePushNotifications(); setEnabled(false); } else { await enablePushNotifications(); setEnabled(true); } } catch (caught) { setMessage(errorMessage(caught)); } finally { setBusy(false); } };
  return <div className="settings-section"><div className="settings-title"><span><Bell size={20} /></span><div><h2>Browser notifications</h2><p>Get an update when an agent has something genuinely useful.</p></div></div><div className="setting-card"><div><b>Push notifications</b><p>{pushConfigured() || demo ? "Delivered by this browser, even when Cuppet isn’t open." : "Add Firebase web credentials to enable push on this deployment."}</p></div><button className={`switch-button ${enabled ? "on" : ""}`} onClick={() => void toggle()} disabled={busy || (!pushConfigured() && !demo)} aria-pressed={enabled}>{busy ? <LoaderCircle className="spin" size={15} /> : <span />}</button></div><div className="setting-card"><div><b>Agent-level controls</b><p>Mute or resume notifications from each agent’s thread menu.</p></div><span className="quiet-pill"><Check size={13} />Available per agent</span></div>{message && <p className="form-message error">{message}</p>}<div className="privacy-callout"><Shield size={18} /><p>Cuppet only sends a notification after an agent produces an update. Notification content follows your browser privacy settings.</p></div></div>;
}

function DataSettings({ demo }: { demo: boolean }) {
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

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CU";
}
