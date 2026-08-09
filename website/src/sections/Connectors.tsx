'use client'

import { useEffect, useRef, useState } from 'react'
import { Grid2X2, X } from 'lucide-react'
import { BiLogoMicrosoftTeams } from 'react-icons/bi'
import { FaLinkedin, FaSalesforce, FaSlack } from 'react-icons/fa'
import type { IconType } from 'react-icons'
import {
  SiAirtable,
  SiAsana,
  SiBox,
  SiClickup,
  SiConfluence,
  SiDiscord,
  SiDropbox,
  SiFigma,
  SiGithub,
  SiGitlab,
  SiGmail,
  SiGooglecalendar,
  SiGoogledocs,
  SiGoogledrive,
  SiGooglesheets,
  SiHubspot,
  SiIntercom,
  SiJira,
  SiLinear,
  SiNotion,
  SiShopify,
  SiStripe,
  SiTodoist,
  SiTrello,
  SiZendesk,
  SiZoom,
} from 'react-icons/si'
import SectionHeading from '../components/SectionHeading'

type Connector = {
  name: string
  color: string
  Icon: IconType
  description: string
}

const CONNECTOR_CATALOG: Connector[] = [
  {
    name: 'Gmail',
    color: '#ea4335',
    Icon: SiGmail,
    description: 'Read threads, draft replies, and move work forward from your inbox.',
  },
  {
    name: 'Google Calendar',
    color: '#4285f4',
    Icon: SiGooglecalendar,
    description:
      "See what's free and update events. Scheduled work fits around the rest of your calendar.",
  },
  {
    name: 'Google Drive',
    color: '#0f9d58',
    Icon: SiGoogledrive,
    description:
      'Find the right files, work from their contents, and save results where your team expects them.',
  },
  {
    name: 'Google Docs',
    color: '#4285f4',
    Icon: SiGoogledocs,
    description: 'Draft new documents and keep existing ones up to date.',
  },
  {
    name: 'Google Sheets',
    color: '#0f9d58',
    Icon: SiGooglesheets,
    description: 'Read key metrics, update rows, and keep operational sheets accurate.',
  },
  {
    name: 'Notion',
    color: '#1c1a17',
    Icon: SiNotion,
    description: 'Reference pages, update databases, and keep shared notes current.',
  },
  {
    name: 'Slack',
    color: '#4a154b',
    Icon: FaSlack,
    description: 'Read channels and post updates so your team can follow the work in Slack.',
  },
  {
    name: 'Discord',
    color: '#5865f2',
    Icon: SiDiscord,
    description: 'Share progress, collect feedback, and route important messages.',
  },
  {
    name: 'Microsoft Teams',
    color: '#6264a7',
    Icon: BiLogoMicrosoftTeams,
    description: 'Bring chats and meetings into the routines you schedule for work.',
  },
  {
    name: 'Zoom',
    color: '#2d8cff',
    Icon: SiZoom,
    description: 'Prepare for meetings and capture the follow-ups after each call.',
  },
  {
    name: 'GitHub',
    color: '#1c1a17',
    Icon: SiGithub,
    description: 'Follow issues, pull requests, and repository changes without manual check-ins.',
  },
  {
    name: 'GitLab',
    color: '#fc6d26',
    Icon: SiGitlab,
    description: 'Include merge requests and pipeline status in your regular delivery checks.',
  },
  {
    name: 'Linear',
    color: '#5e6ad2',
    Icon: SiLinear,
    description: 'Triage issues and update their status as product work moves forward.',
  },
  {
    name: 'Jira',
    color: '#0052cc',
    Icon: SiJira,
    description: 'Track tickets, update fields, and surface blockers.',
  },
  {
    name: 'Confluence',
    color: '#172b4d',
    Icon: SiConfluence,
    description: 'Find and summarize runbooks or docs, then keep them up to date.',
  },
  {
    name: 'Asana',
    color: '#f06a6a',
    Icon: SiAsana,
    description: 'Update tasks, flag blockers, and keep recurring projects on track.',
  },
  {
    name: 'Trello',
    color: '#0052cc',
    Icon: SiTrello,
    description: 'Move cards and keep simple project boards up to date.',
  },
  {
    name: 'ClickUp',
    color: '#7b68ee',
    Icon: SiClickup,
    description: 'Coordinate tasks and docs in workspaces shared across teams.',
  },
  {
    name: 'Todoist',
    color: '#e44332',
    Icon: SiTodoist,
    description: 'Capture and prioritize to-dos, then mark them done on time.',
  },
  {
    name: 'Dropbox',
    color: '#0061ff',
    Icon: SiDropbox,
    description: 'Locate shared files and keep deliverables organized.',
  },
  {
    name: 'Box',
    color: '#0061d5',
    Icon: SiBox,
    description: 'Keep enterprise files searchable, organized, and ready when your team needs them.',
  },
  {
    name: 'Figma',
    color: '#f24e1e',
    Icon: SiFigma,
    description: 'Bring design details into product and marketing handoffs.',
  },
  {
    name: 'Airtable',
    color: '#18bfff',
    Icon: SiAirtable,
    description: 'Keep Airtable bases, views, and records aligned with day-to-day work.',
  },
  {
    name: 'HubSpot',
    color: '#ff7a59',
    Icon: SiHubspot,
    description: "Update contacts and pipelines so follow-ups don't fall behind.",
  },
  {
    name: 'Salesforce',
    color: '#00a1e0',
    Icon: FaSalesforce,
    description: 'Keep opportunities and next steps accurate across the sales cycle.',
  },
  {
    name: 'Stripe',
    color: '#635bff',
    Icon: SiStripe,
    description: 'Include charges, invoices, and other billing events in recurring revenue work.',
  },
  {
    name: 'Shopify',
    color: '#96bf48',
    Icon: SiShopify,
    description: 'Track orders and inventory changes as part of regular store operations.',
  },
  {
    name: 'Intercom',
    color: '#1f8ded',
    Icon: SiIntercom,
    description: 'Handle common support questions with full conversation context.',
  },
  {
    name: 'Zendesk',
    color: '#03363d',
    Icon: SiZendesk,
    description: 'Triage tickets, summarize issues, and route them with their history intact.',
  },
  {
    name: 'LinkedIn',
    color: '#0a66c2',
    Icon: FaLinkedin,
    description: 'Handle routine outreach and updates without starting from scratch each day.',
  },
]

const ENABLED_CONNECTOR_NAMES = [
  'Gmail',
  'Google Calendar',
  'Google Drive',
  'GitHub',
  'Slack',
  'Notion',
] as const

const CONNECTORS = ENABLED_CONNECTOR_NAMES.map((name) => {
  const connector = CONNECTOR_CATALOG.find((candidate) => candidate.name === name)
  if (!connector) throw new Error(`Missing connector: ${name}`)
  return connector
})

function ConnectorCard({
  connector,
  onOpen,
  tabIndex,
}: {
  connector: Connector
  onOpen: (connector: Connector) => void
  tabIndex?: number
}) {
  return (
    <button
      type="button"
      tabIndex={tabIndex}
      onClick={() => onOpen(connector)}
      className="group grid h-[82px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-[var(--rule)] bg-[var(--paper)]/85 p-4 text-left shadow-[0_14px_35px_-30px_rgba(12,25,17,0.5)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--rule-strong)] hover:bg-[#e0e9df] hover:shadow-[0_18px_35px_-26px_rgba(12,25,17,0.38)]"
    >
      <span
        className="flex h-9 w-9 items-center justify-center text-[28px] transition-transform duration-200 group-hover:scale-110"
        style={{ color: connector.color }}
      >
        <connector.Icon aria-hidden="true" focusable="false" />
      </span>
      <span className="text-[13px] font-semibold leading-5 tracking-[-0.01em] text-[var(--ink)]">
        {connector.name}
      </span>
    </button>
  )
}

export default function Connectors() {
  const [activeConnector, setActiveConnector] = useState<Connector | null>(null)
  const [browseOpen, setBrowseOpen] = useState(false)
  const detailCloseRef = useRef<HTMLButtonElement>(null)
  const browseCloseRef = useRef<HTMLButtonElement>(null)
  const exploreRef = useRef<HTMLButtonElement>(null)
  const blocked = browseOpen

  useEffect(() => {
    if (browseOpen) browseCloseRef.current?.focus()
  }, [browseOpen])

  useEffect(() => {
    if (!browseOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [browseOpen])

  const openConnector = (connector: Connector) => {
    setBrowseOpen(false)
    setActiveConnector(connector)
    requestAnimationFrame(() => detailCloseRef.current?.focus())
  }

  const closeConnector = () => {
    setActiveConnector(null)
    requestAnimationFrame(() => exploreRef.current?.focus())
  }

  const closeBrowse = () => {
    setBrowseOpen(false)
    requestAnimationFrame(() => exploreRef.current?.focus())
  }

  return (
    <section
      id="connectors"
      aria-label="Connectors"
      className="border-y border-[var(--rule)] bg-[var(--paper-2)] py-20 sm:py-28"
    >
      <div className="mx-auto grid max-w-6xl items-start gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-16">
        <div className="min-w-0">
          <SectionHeading
            eyebrow="Connectors"
            title={<>The tools you already open.</>}
            sub="Connect the apps you already use. Agents get the context they need, so you spend less time moving between tabs."
            align="left"
          />
        </div>

        <div className="min-w-0">
          {activeConnector ? (
            <div
              className="connector-dialog-in relative flex min-h-[270px] flex-col rounded-2xl border border-[var(--rule-strong)] bg-[var(--paper)] p-6 shadow-[0_20px_45px_-34px_rgba(12,25,17,0.48)] sm:p-7"
              aria-live="polite"
              aria-labelledby="connector-detail-title"
            >
              <button
                type="button"
                ref={detailCloseRef}
                tabIndex={blocked ? -1 : 0}
                aria-label="Close connector details"
                onClick={closeConnector}
                className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--paper)] text-[var(--ink-soft)] transition hover:bg-[var(--paper-3)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>

              <div className="flex items-center gap-4 pr-12">
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center text-[46px]"
                  style={{ color: activeConnector.color }}
                >
                  <activeConnector.Icon aria-hidden="true" focusable="false" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                    Connector
                  </p>
                  <h3
                    id="connector-detail-title"
                    className="mt-1 font-display text-[2rem] font-normal leading-none tracking-[-0.03em] text-[var(--ink)]"
                  >
                    <span className="scroll-title-content">{activeConnector.name}</span>
                  </h3>
                </div>
              </div>

              <p className="mt-6 max-w-[32rem] text-[15px] leading-7 text-[var(--ink-soft)]">
                {activeConnector.description}
              </p>
              <p className="mt-auto pt-5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                Choose another connector below
              </p>
            </div>
          ) : (
            <div
              className="grid grid-cols-2 gap-2.5 sm:gap-3"
              aria-hidden={blocked || undefined}
            >
              {CONNECTORS.slice(0, 6).map((connector) => (
                <ConnectorCard
                  key={connector.name}
                  connector={connector}
                  onOpen={openConnector}
                  tabIndex={blocked ? -1 : 0}
                />
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {activeConnector &&
              CONNECTORS.slice(0, 6).map((connector) => {
                const active = connector.name === activeConnector.name
                return (
                  <button
                    key={connector.name}
                    type="button"
                    tabIndex={blocked ? -1 : 0}
                    aria-label={`Show ${connector.name} connector`}
                    aria-pressed={active}
                    title={connector.name}
                    onClick={() => setActiveConnector(connector)}
                    className={`flex h-11 w-11 items-center justify-center rounded-full border bg-[var(--paper)] text-[21px] transition hover:-translate-y-0.5 hover:bg-[var(--paper-3)] ${
                      active
                        ? 'border-[var(--forest-mid)] shadow-[0_0_0_2px_rgba(36,88,59,0.12)]'
                        : 'border-[var(--rule)]'
                    }`}
                    style={{ color: connector.color }}
                  >
                    <connector.Icon aria-hidden="true" focusable="false" />
                  </button>
                )
              })}

            <button
              type="button"
              ref={exploreRef}
              tabIndex={blocked ? -1 : 0}
              aria-haspopup="dialog"
              aria-expanded={browseOpen}
              onClick={() => setBrowseOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--forest)] px-5 text-[13px] font-semibold text-[var(--paper)] transition-colors hover:bg-[#102e20]"
            >
              <Grid2X2 className="h-4 w-4" aria-hidden="true" />
              Explore more
            </button>
          </div>
        </div>
      </div>

      {browseOpen && (
        <div
          className="connector-dialog-in fixed inset-0 z-[70] grid place-items-center bg-black/25 p-4 backdrop-blur-[6px] sm:p-8"
          onClick={closeBrowse}
          onKeyDown={(event) => {
            if (event.key === 'Escape') closeBrowse()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="connector-browse-title"
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[min(84vh,680px)] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-[var(--rule-strong)] bg-[var(--paper)] shadow-[0_28px_72px_rgba(12,25,17,0.2)]"
          >
            <div className="relative flex shrink-0 items-start justify-between gap-4 border-b border-[var(--rule)] px-5 py-5 sm:px-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                  All connectors
                </p>
                <h3
                  id="connector-browse-title"
                  className="mt-2 font-display text-[2rem] font-normal leading-none tracking-[-0.03em] text-[var(--ink)]"
                >
                  <span className="scroll-title-content">Browse integrations</span>
                </h3>
              </div>
              <button
                type="button"
                ref={browseCloseRef}
                aria-label="Close connector list"
                onClick={closeBrowse}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--paper)] text-[var(--ink-soft)] transition hover:bg-[var(--paper-3)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                {CONNECTORS.map((connector) => (
                  <ConnectorCard
                    key={connector.name}
                    connector={connector}
                    onOpen={openConnector}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
