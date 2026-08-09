'use client'

import { useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  Clock,
  ClipboardList,
  FileText,
  Globe,
  MessageCircle,
  MoreVertical,
  Plus,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Zap,
} from 'lucide-react'
import { FaSlack } from 'react-icons/fa'
import { SiGmail, SiGoogledrive, SiNotion } from 'react-icons/si'

/* ---------- shared bits ---------- */

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--forest-mid)]">
      {children}
    </p>
  )
}

function Pill({ tone = 'default', children }: { tone?: 'default' | 'dark'; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-medium ${
        tone === 'dark'
          ? 'bg-[var(--forest)] text-[var(--paper)]'
          : 'bg-[var(--paper-3)] text-[var(--forest)]'
      }`}
    >
      {children}
    </span>
  )
}

/* ---------- Screen 1: Connect your tools ---------- */

const SERVICES = [
  {
    name: 'Web Search',
    desc: 'Search the web without a user login',
    defaultConnected: true,
    iconBg: '#e7f0ea',
    foreground: '#0f6b4d',
    icon: <Globe size={16} />,
  },
  {
    name: 'Gmail',
    desc: 'Read approved Gmail context and prepare summaries',
    defaultConnected: false,
    iconBg: '#ffffff',
    foreground: '#ea4335',
    icon: <SiGmail size={15} />,
  },
  {
    name: 'Slack',
    desc: 'Read selected channels and prepare updates',
    defaultConnected: false,
    iconBg: '#ffffff',
    foreground: '#4a154b',
    icon: <FaSlack size={14} />,
  },
  {
    name: 'Google Drive',
    desc: 'Read selected files and summarize documents',
    defaultConnected: false,
    iconBg: '#ffffff',
    foreground: '#0f9d58',
    icon: <SiGoogledrive size={15} />,
  },
  {
    name: 'Notion',
    desc: 'Read selected workspace pages and summarize recent changes',
    defaultConnected: false,
    iconBg: '#ffffff',
    foreground: '#171a17',
    icon: <SiNotion size={15} />,
  },
]

export function ConnectScreen() {
  const [connected, setConnected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SERVICES.map((s) => [s.name, s.defaultConnected])),
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-3 pt-5">
        <Eyebrow>Workspace setup</Eyebrow>
        <h3 className="mt-1 text-[21px] font-semibold leading-tight text-[var(--ink)]">
          <span className="scroll-title-content">Connect your tools</span>
        </h3>
        <p className="mt-1 text-[11.5px] leading-5 text-[var(--ink-soft)]">
          Choose which services Cuppet can connect to.
        </p>

        <div className="mt-5">
          <Eyebrow>Available services</Eyebrow>
        </div>

        <div className="mt-2.5 flex flex-col gap-2.5">
          {SERVICES.map((s) => {
            const isConnected = connected[s.name]
            return (
              <div key={s.name} className="rounded-2xl border border-[var(--rule-strong)] bg-white p-3.5">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm"
                    style={{ background: s.iconBg }}
                  >
                    <span style={{ color: s.foreground }}>{s.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-[var(--ink)]">{s.name}</p>
                    <p className="mt-0.5 text-[10.5px] leading-4 text-[var(--ink-soft)]">{s.desc}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[var(--rule)] pt-2.5">
                  <span
                    className={`flex items-center gap-1.5 text-[10px] font-semibold tracking-wide ${
                      isConnected ? 'text-[var(--forest)]' : 'text-[var(--ink-faint)]'
                    }`}
                  >
                    <span
                      className={`h-3 w-3 rounded-full border-[3px] ${
                        isConnected ? 'border-[var(--forest)]' : 'border-[var(--ink-faint)]'
                      }`}
                    />
                    {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isConnected}
                    aria-label={`${isConnected ? 'Disconnect' : 'Connect'} ${s.name}`}
                    onClick={() =>
                      setConnected((prev) => ({ ...prev, [s.name]: !prev[s.name] }))
                    }
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                      isConnected ? 'bg-[var(--forest)]' : 'bg-[var(--paper-3)]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        isConnected ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-around border-t border-[var(--rule)] bg-[var(--paper)] px-2 py-2.5">
        <TabItem icon={<MessageCircle size={17} />} label="Inbox" />
        <TabItem icon={<Globe size={17} />} label="Connectors" active />
        <TabItem icon={<Settings size={17} />} label="Settings" />
      </div>
    </div>
  )
}

function TabItem({ icon, label, active }: { icon: ReactNode; label: string; active?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-medium ${
        active ? 'text-[var(--forest)]' : 'text-[var(--ink-faint)]'
      }`}
    >
      {icon}
      {label}
    </div>
  )
}

/* ---------- Screen 2: Confirm your agent ---------- */

export function ConfirmScreen() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-3 pt-5">
        <Eyebrow>Final review</Eyebrow>
        <h3 className="mt-1 text-[21px] font-semibold leading-tight text-[var(--ink)]">
          <span className="scroll-title-content">Confirm your agent</span>
        </h3>
        <p className="mt-1 text-[11.5px] leading-5 text-[var(--ink-soft)]">
          Review what it will do, when it will run, and which services it needs.
        </p>

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[var(--rule-strong)] bg-[var(--paper)] p-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--paper-3)] text-[13px] font-semibold text-[var(--forest)]">
            C
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-[var(--ink)]">News agent</p>
            <p className="mt-0.5 text-[10.5px] leading-4 text-[var(--ink-soft)]">
              Create a News agent. Researches and ranks a balanced current-news briefing. Run it
              every day at 6:00 AM.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <Eyebrow>Agent details</Eyebrow>
        </div>

        <div className="mt-2.5 flex flex-col gap-2.5">
          <DetailCard icon={<ClipboardList size={16} />} title="What it does">
            <p className="text-[11px] leading-4 text-[var(--ink-soft)]">
              Researches and ranks a balanced current-news briefing.
            </p>
          </DetailCard>

          <DetailCard icon={<Clock size={16} />} title="When it runs">
            <p className="text-[11px] leading-4 text-[var(--ink-soft)]">Daily at 6:00 AM · Asia/Calcutta</p>
          </DetailCard>

          <DetailCard icon={<SlidersHorizontal size={16} />} title="Preferences">
            <div className="flex flex-col gap-2 text-[11px]">
              <div>
                <p className="text-[var(--ink-faint)]">Topics</p>
                <div className="mt-1">
                  <Pill>top stories</Pill>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--rule)] pt-2">
                <span className="text-[var(--ink-faint)]">Geography</span>
                <span className="font-medium text-[var(--ink)]">local and global</span>
              </div>
              <div className="border-t border-[var(--rule)] pt-2">
                <p className="text-[var(--ink-faint)]">Categories</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {['World', 'Business', 'Technology', 'Policy', 'Science'].map((c) => (
                    <Pill key={c}>{c}</Pill>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--rule)] pt-2">
                <span className="text-[var(--ink-faint)]">Freshness</span>
                <span className="font-medium text-[var(--ink)]">48 Hours</span>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--rule)] pt-2">
                <span className="text-[var(--ink-faint)]">Balance</span>
                <span className="font-medium text-[var(--ink)]">Balanced</span>
              </div>
            </div>
          </DetailCard>

          <DetailCard icon={<ArrowUpRight size={16} />} title="Output layout">
            <p className="text-[11px] leading-4 text-[var(--ink-soft)]">
              A summarized brief of recent articles
            </p>
          </DetailCard>

          <DetailCard icon={<ShieldCheck size={16} />} title="Connected tools required">
            <Pill>🔍 Web search (no login needed)</Pill>
          </DetailCard>
        </div>
      </div>

      <div className="flex gap-2 border-t border-[var(--rule)] bg-[var(--paper)] px-4 py-3">
        <button
          type="button"
          className="flex-1 rounded-full border border-[var(--rule-strong)] py-2.5 text-[12px] font-semibold text-[var(--ink)]"
        >
          Back
        </button>
        <button
          type="button"
          className="flex-1 rounded-full bg-[var(--forest)] py-2.5 text-[12px] font-semibold text-[var(--paper)]"
        >
          Create Agent
        </button>
      </div>
    </div>
  )
}

function DetailCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--rule-strong)] bg-[var(--paper)] p-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--paper-2)] text-[var(--forest)]">
          {icon}
        </div>
        <p className="text-[12px] font-semibold text-[var(--ink)]">{title}</p>
      </div>
      <div className="mt-2.5 pl-11">{children}</div>
    </div>
  )
}

/* ---------- Screen 3: News agent thread ---------- */

const STORIES = [
  {
    title: 'EU AI Act Transparency Rules Take Effect Today',
    tags: ['TOP STORY', 'TECHNOLOGY'],
    detail:
      "Starting August 2, 2026, the European Union's AI Act begins its first phase of formal enforcement. Organizations are now legally required to disclose when users are interacting with AI and must provide clear, machine-readable labeling for AI-generated synthetic content, including deepfakes.",
    source: 'European Commission',
  },
  {
    title: 'Google Withdraws AI Tool After Misinformation Concerns',
    tags: ['TECHNOLOGY'],
    detail:
      'Google retracted a feature for Google Earth that allowed users to generate AI-based imagery of global locations. The company pulled the tool within 24 hours after critics demonstrated it could be used to create convincing, fraudulent visuals of sensitive sites, highlighting ongoing risks regarding AI-generated misinformation.',
    source: 'News Writer',
  },
  {
    title: 'Open-Source AI Advances Spark US Tech Tensions',
    tags: ['TECHNOLOGY'],
    detail:
      "The emergence of powerful open-source AI models from China, such as Moonshot AI’s Kimi K3, is causing internal divisions within the U.S. tech sector and the White House. While some companies view these models as a competitive alternative to dominant proprietary labs, others warn of security risks, sparking debates over potential sanctions.",
    source: 'News Writer',
  },
]

function StoryCard({
  story,
  isExpanded,
  onToggle,
  detailId,
}: {
  story: (typeof STORIES)[number]
  isExpanded: boolean
  onToggle: () => void
  detailId: string
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border transition-colors ${
        isExpanded
          ? 'border-[var(--forest-mid)]/35 bg-[var(--paper)]'
          : 'border-[var(--rule)] bg-[var(--paper)]'
      }`}
    >
      <button
        type="button"
        aria-controls={detailId}
        aria-expanded={isExpanded}
        onClick={onToggle}
        className="flex w-full items-start gap-2.5 p-2.5 text-left transition-colors hover:bg-[var(--paper-2)]"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--paper-2)] text-[var(--forest)]">
          <FileText size={13} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10.5px] font-semibold leading-4 text-[var(--ink)]">
            {story.title}
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1">
            {story.tags.map((tag) => (
              <Pill key={tag} tone={tag === 'TOP STORY' ? 'dark' : 'default'}>
                {tag}
              </Pill>
            ))}
          </span>
        </span>
        <ChevronDown
          size={13}
          className={`mt-1 shrink-0 text-[var(--ink-faint)] transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isExpanded && (
        <div id={detailId} className="border-t border-[var(--rule)] px-2.5 pb-2.5 pt-2.5">
          <p className="text-[10.5px] leading-[1.55] text-[var(--ink-soft)]">{story.detail}</p>
          <p className="mt-2.5 text-[9.5px] text-[var(--ink-soft)]">
            Source:{' '}
            <span className="font-medium text-[var(--forest-mid)] underline decoration-[var(--forest-mid)]/35 underline-offset-2">
              {story.source}
            </span>
          </p>
          <span className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-[var(--forest-mid)]">
            <ArrowUpRight size={11} aria-hidden="true" />
            Explore more
          </span>
        </div>
      )}
    </div>
  )
}

export function ThreadScreen() {
  const [expandedStory, setExpandedStory] = useState<string | null>(null)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-black/[0.08] bg-[#efede8] px-3.5 py-3">
        <ArrowLeft size={15} className="text-[var(--ink)]" />
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--paper-2)] text-[10px] font-semibold text-[var(--forest)]">
          NA
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-[var(--ink)]">News agent</p>
          <p className="flex items-center gap-1 text-[9.5px] font-semibold tracking-wide text-[var(--forest-mid)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--forest-mid)]" />
            SCHEDULED AT 6AM
          </p>
        </div>
        <MoreVertical size={15} className="text-[var(--ink-faint)]" />
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 py-4">
        <div className="mb-3 flex justify-center">
          <span className="rounded-full bg-[var(--paper-2)] px-3 py-1 text-[9.5px] font-medium text-[var(--ink-soft)]">
            TODAY
          </span>
        </div>

        <div className="rounded-2xl border border-[var(--rule-strong)] bg-[var(--paper)] p-3.5 surface-elevated">
          <p className="text-[12px] leading-5 text-[var(--ink)]">Here&rsquo;s your 6am tech &amp; AI news brief.</p>
          <div className="mt-2.5 rounded-xl border border-[var(--rule)] bg-[var(--paper-2)] p-3">
            <p className="flex items-center gap-1 text-[10px] font-semibold text-[var(--forest)]">
              <Zap size={11} /> TL;DR
            </p>
            <ul className="mt-1.5 space-y-1.5 text-[10.5px] leading-4 text-[var(--ink-soft)]">
              <li>The EU&rsquo;s AI Act begins formal enforcement today, centering on transparency requirements.</li>
              <li>Google rolled back a new Earth AI feature after concerns about misuse.</li>
              <li>Open-source AI models from China are creating friction in the US tech industry.</li>
            </ul>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--rule-strong)] bg-[var(--paper)] p-3.5 surface-elevated">
          <p className="text-[11px] font-semibold text-[var(--ink)]">Detailed coverage</p>
          <div className="mt-2.5 flex flex-col gap-2">
            {STORIES.map((story, index) => (
              <StoryCard
                key={story.title}
                story={story}
                isExpanded={expandedStory === story.title}
                onToggle={() =>
                  setExpandedStory((current) => (current === story.title ? null : story.title))
                }
                detailId={`story-detail-${index}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--rule)] bg-[var(--paper)] px-3.5 py-2.5">
        <Plus size={16} className="shrink-0 text-[var(--ink-faint)]" />
        <div className="flex-1 rounded-full bg-[var(--paper-2)] px-3 py-2 text-[11px] text-[var(--ink-faint)]">
          Message agent
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--forest)] text-[var(--paper)]">
          <Send size={13} />
        </span>
      </div>
    </div>
  )
}
