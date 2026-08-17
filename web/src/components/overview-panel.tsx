"use client";

import {
  Activity,
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Plus,
  Sparkles,
  Zap
} from "lucide-react";
import type { Agent, AgentMessage } from "@/lib/types";
import { AgentIcon, agentTone } from "./agent-icon";
import { messageText } from "./message-renderer";

export function OverviewPanel({
  agents,
  briefings,
  firstName,
  onSelectAgent,
  onCreateAgent
}: {
  agents: Agent[];
  briefings: AgentMessage[];
  firstName: string;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent: () => void;
}) {
  const active = agents.filter((agent) => !agent.is_assistant && agent.status === "active");
  const unread = agents.reduce((sum, agent) => sum + (agent.unread_count ?? 0), 0);
  const scheduled = active.filter((agent) => Boolean(agent.schedule_cron));
  const recent = agents.filter((agent) => !agent.is_assistant).slice(0, 4);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <section className="content-panel overview-panel">
      <header className="content-header overview-header">
        <div><p className="eyebrow">Overview</p><h1>{greeting}{firstName ? `, ${firstName}` : ""}.</h1><p>Your agents are keeping an eye on the work you care about.</p></div>
        <button className="primary-button" onClick={onCreateAgent}><Plus size={17} />New agent</button>
      </header>

      <div className="overview-body">
        <div className="overview-metrics">
          <Metric icon={Bot} label="Active agents" value={active.length} note={`${agents.length - 1} total in your workspace`} tone="coral" />
          <Metric icon={Zap} label="Unread updates" value={unread} note={unread ? "Ready when you are" : "You’re all caught up"} tone="blue" />
          <Metric icon={CalendarClock} label="On a schedule" value={scheduled.length} note="Running quietly in the background" tone="sage" />
        </div>

        <div className="overview-columns">
          <section className="overview-card focus-card">
            <div className="card-heading"><div><p className="eyebrow">Today’s focus</p><h2>What deserves a look</h2></div><Sparkles size={20} /></div>
            {recent.length ? <div className="focus-list">{recent.slice(0, 3).map((agent, index) => <button key={agent.id} onClick={() => onSelectAgent(agent.id)}><span className="focus-number">0{index + 1}</span><span className={`agent-avatar ${agentTone(agent.id)}`}><AgentIcon name={agent.avatar} /></span><span><b>{agent.name}</b><small>{agent.last_message_preview || agent.description || "Ready for an update"}</small></span><ArrowRight size={16} /></button>)}</div> : <EmptyAgents onCreate={onCreateAgent} />}
          </section>

          <section className="overview-card activity-card">
            <div className="card-heading"><div><p className="eyebrow">Workspace pulse</p><h2>Agent activity</h2></div><Activity size={20} /></div>
            <div className="activity-list">
              {active.slice(0, 4).map((agent) => <div key={agent.id}><span className={`activity-status ${agent.status}`}><CheckCircle2 size={14} /></span><span><b>{agent.name}</b><small>{relativeTime(agent.latest_message_at || agent.updated_at)} · {agent.schedule_cron ? "Scheduled" : "On demand"}</small></span></div>)}
              {active.length === 0 && <p className="muted-copy">Resume an agent to see its activity here.</p>}
            </div>
          </section>
        </div>

        <section className="overview-card briefing-strip">
          <div className="card-heading"><div><p className="eyebrow">Latest briefings</p><h2>Useful updates, in one place</h2></div></div>
          <div className="briefing-cards">{(briefings.length ? briefings : recent.map((agent) => ({ id: `fallback-${agent.id}`, agent_id: agent.id, role: "agent" as const, created_at: agent.latest_message_at || new Date().toISOString(), content: { template: "plain_text", data: { body: agent.last_message_preview || agent.description } } }))).slice(0, 3).map((briefing) => { const agent = agents.find((item) => item.id === briefing.agent_id); return <button key={briefing.id} onClick={() => onSelectAgent(briefing.agent_id)}><span className={`agent-avatar ${agentTone(briefing.agent_id)}`}><AgentIcon name={agent?.avatar} /></span><span><small>{agent?.name ?? "Briefing"}</small><b>{messageText(briefing.content)}</b><time>{relativeTime(briefing.created_at)}</time></span><ArrowRight size={16} /></button>; })}</div>
        </section>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value, note, tone }: { icon: typeof Bot; label: string; value: number; note: string; tone: string }) {
  return <div className="overview-metric"><span className={`metric-icon ${tone}`}><Icon size={20} /></span><span><small>{label}</small><strong>{value}</strong><p>{note}</p></span></div>;
}

function EmptyAgents({ onCreate }: { onCreate: () => void }) {
  return <div className="panel-empty"><span><Bot size={22} /></span><h3>Create your first useful agent</h3><p>Describe a recurring task and Cuppet will shape it with you.</p><button className="text-button" onClick={onCreate}>Create an agent <ArrowRight size={14} /></button></div>;
}

function relativeTime(value?: string): string {
  if (!value) return "No recent activity";
  const delta = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(delta)) return "Recently";
  const minutes = Math.max(0, Math.floor(delta / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
