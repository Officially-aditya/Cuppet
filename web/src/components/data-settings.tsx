"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Download, ExternalLink, LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import type { ArchiveState, AssistantMemory, CompactedMemory } from "@/lib/types";

type DataTab = "memory" | "storage";

export function DataSettingsPanel({ demo }: { demo: boolean }) {
  const [tab, setTab] = useState<DataTab>("memory");
  return <div className="settings-section data-settings-panel"><div className="settings-title"><span><Database size={20} /></span><div><h2>{tab === "memory" ? "Memory" : "Storage"}</h2><p>{tab === "memory" ? "Review confirmed details remembered by Assistant." : "Manage 30-day history and Google Drive archives."}</p></div></div><div className="settings-subnav" role="tablist" aria-label="Data settings"><button className={tab === "memory" ? "active" : ""} role="tab" aria-selected={tab === "memory"} onClick={() => setTab("memory")}>Memory</button><button className={tab === "storage" ? "active" : ""} role="tab" aria-selected={tab === "storage"} onClick={() => setTab("storage")}>Storage</button></div>{tab === "memory" ? <MemorySettings demo={demo} /> : <StorageSettings demo={demo} />}</div>;
}

function MemorySettings({ demo }: { demo: boolean }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["memories"], queryFn: api.memories, enabled: !demo });
  const [localMemories, setLocalMemories] = useState<AssistantMemory[]>([]);
  const [localCompacted, setLocalCompacted] = useState<CompactedMemory | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const memories = demo ? localMemories : query.data?.memories ?? localMemories;
  const compacted = demo ? localCompacted : query.data?.compacted_memory ?? localCompacted;

  const removeMemory = async (memory: AssistantMemory) => {
    if (!window.confirm("Forget this confirmed memory?")) return;
    setBusy(memory.id); setError(""); setMessage("");
    try {
      if (!demo) await api.deleteMemory(memory.id);
      setLocalMemories((current) => current.filter((candidate) => candidate.id !== memory.id));
      setMessage("Memory removed.");
      await client.invalidateQueries({ queryKey: ["memories"] });
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  };

  const removeCompacted = async () => {
    if (!window.confirm("Forget the compacted Assistant memory?")) return;
    setBusy("compacted"); setError(""); setMessage("");
    try {
      if (!demo) await api.deleteCompactedMemory();
      setLocalCompacted(null); setMessage("Compacted memory removed.");
      await client.invalidateQueries({ queryKey: ["memories"] });
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  };

  const removeAll = async () => {
    if (!memories.length && !compacted) return;
    if (!window.confirm("Forget all confirmed Assistant memories?")) return;
    setBusy("all"); setError(""); setMessage("");
    try {
      if (!demo) await api.deleteMemories();
      setLocalMemories([]); setLocalCompacted(null); setMessage("All memories removed.");
      await client.invalidateQueries({ queryKey: ["memories"] });
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  };

  return <div className="data-subsection"><div className="setting-card stacked"><div><b>{memories.length ? `${memories.length} confirmed ${memories.length === 1 ? "memory" : "memories"}` : "No confirmed memories"}</b><p>Only details explicitly saved by Assistant appear here. Remove individual entries whenever they stop being useful.</p></div><button className="secondary-button" disabled={busy === "all" || (!memories.length && !compacted)} onClick={() => void removeAll()}><Trash2 size={14} />Forget all</button></div>{compacted && <div className="memory-card compacted-memory"><div><b>Compacted memory</b><p>{compacted.content || compacted.text || "A summarized profile used to keep Assistant context concise."}</p></div><button className="icon-button subtle danger-icon" aria-label="Delete compacted memory" disabled={busy === "compacted"} onClick={() => void removeCompacted()}>{busy === "compacted" ? <LoaderCircle className="spin" size={14} /> : <Trash2 size={14} />}</button></div>}<div className="memory-list">{memories.length ? memories.map((memory) => <article className="memory-card" key={memory.id}><div><b>{memory.content || memory.text || "Saved Assistant memory"}</b><small>{memory.created_at ? `Saved ${formatDate(memory.created_at)}` : "Confirmed memory"}{memory.source ? ` · ${memory.source}` : ""}</small></div><button className="icon-button subtle danger-icon" aria-label="Delete memory" disabled={busy === memory.id} onClick={() => void removeMemory(memory)}>{busy === memory.id ? <LoaderCircle className="spin" size={14} /> : <Trash2 size={14} />}</button></article>) : <div className="setting-card"><p className="muted-copy">Cuppet has not saved any confirmed memories yet.</p></div>}</div>{message && <p className="form-message success">{message}</p>}{error && <p className="form-message error">{error}</p>}</div>;
}

function StorageSettings({ demo }: { demo: boolean }) {
  const client = useQueryClient();
  const router = useRouter();
  const archiveQuery = useQuery({ queryKey: ["archive"], queryFn: api.archiveState, enabled: !demo });
  const [demoArchive, setDemoArchive] = useState<ArchiveState>({ enabled: false, status: "disabled", folder_link: null });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const archive = demo ? demoArchive : archiveQuery.data;

  const toggleArchive = async () => {
    setBusy("archive"); setError(""); setMessage("");
    try {
      if (demo) setDemoArchive((current) => ({ ...current, enabled: !current.enabled, status: current.enabled ? "disabled" : "connected" }));
      else {
        const result = await api.updateArchive(!archive?.enabled);
        if (result.authorization?.auth_url) {
          const popup = window.open(result.authorization.auth_url, "cuppet-archive-oauth", "popup,width=620,height=760");
          if (!popup) window.location.assign(result.authorization.auth_url);
        }
        await client.invalidateQueries({ queryKey: ["archive"] });
      }
      setMessage(archive?.enabled ? "Drive archive disabled." : "Drive archive connection started.");
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  };

  const deleteArchives = async () => {
    if (!window.confirm("Delete all archived conversation files from Google Drive?")) return;
    setBusy("files"); setError(""); setMessage("");
    try {
      if (!demo) await api.deleteArchives();
      setMessage("Archived conversation files deleted.");
      await client.invalidateQueries({ queryKey: ["archive"] });
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  };

  const deleteAccount = async () => {
    setBusy("account"); setError("");
    try {
      if (!demo) { await api.deleteAccount(); await authClient.signOut(); }
      router.replace("/"); router.refresh();
    } catch (caught) { setError(errorMessage(caught)); setBusy(""); }
  };

  return <div className="data-subsection"><div className="storage-explanation"><b>Conversation history</b><p>Cuppet keeps recent messages available in the workspace for 30 days. Older messages can be stored in a Google Drive folder you control.</p></div><div className="setting-card stacked"><div><b>Google Drive message archive</b><p>{archive?.enabled ? `Archive is ${archive.status || "connected"}.` : "Optional. Keep an export of agent messages in a Drive folder you control."}{archive?.last_success_at && ` Last saved ${formatDate(archive.last_success_at)}.`}</p>{archive?.folder_link && <a href={archive.folder_link} target="_blank" rel="noreferrer">Open archive folder <ExternalLink size={12} /></a>}{archive?.action_required && <small className="storage-warning">Drive needs attention before new archives can be saved.</small>}</div><div className="setting-actions"><button className="secondary-button" disabled={busy === "files" || !archive?.enabled} onClick={() => void deleteArchives()}><Trash2 size={14} />Delete files</button><button className={`switch-button ${archive?.enabled ? "on" : ""}`} aria-pressed={archive?.enabled} disabled={busy === "archive"} onClick={() => void toggleArchive()}>{busy === "archive" ? <LoaderCircle className="spin" size={15} /> : <span />}</button></div></div><div className="setting-card stacked"><div><b>Preference export</b><p>Download a copy of your personalization profile from the Personalization section.</p></div><button className="secondary-button" onClick={() => router.replace(`${window.location.pathname}?view=settings&settings=personalization`)}><Download size={14} />Open personalization</button></div><div className="danger-zone account-danger"><div><b>Delete Cuppet account</b><p>Permanently removes agents, messages, connections, and account data.</p></div>{!confirmDelete ? <button onClick={() => setConfirmDelete(true)}><Trash2 size={15} />Delete account</button> : <div className="delete-confirm"><span>Are you sure?</span><button className="secondary-button" onClick={() => setConfirmDelete(false)}>Cancel</button><button onClick={() => void deleteAccount()} disabled={busy === "account"}>{busy === "account" ? "Deleting…" : "Delete permanently"}</button></div>}</div>{message && <p className="form-message success">{message}</p>}{error && <p className="form-message error">{error}</p>}</div>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
