'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CheckCheck,
  ChevronLeft,
  MoreVertical,
  Sparkles,
  Newspaper,
  CalendarClock,
  Send,
  Plus,
  Mic,
} from 'lucide-react'

type Msg =
  | { kind: 'date'; text: string }
  | { kind: 'in'; text: string; time: string }
  | { kind: 'digest'; time: string }
  | { kind: 'out'; text: string; time: string }
  | { kind: 'typing' }
  | { kind: 'chip'; text: string; sub: string }

const SCRIPT: { delay: number; msg: Msg }[] = [
  { delay: 500, msg: { kind: 'date', text: 'Today' } },
  {
    delay: 900,
    msg: {
      kind: 'in',
      text: 'Good morning. Your 7:00 AM tech digest is ready — 3 stories worth your attention today.',
      time: '7:00 AM',
    },
  },
  { delay: 1400, msg: { kind: 'digest', time: '7:00 AM' } },
  { delay: 1600, msg: { kind: 'typing' } },
  {
    delay: 1800,
    msg: { kind: 'in', text: 'Want a deeper dive on any of these? Just reply here.', time: '7:01 AM' },
  },
  {
    delay: 2000,
    msg: { kind: 'out', text: 'Add a startups section from tomorrow', time: '7:12 AM' },
  },
  { delay: 1200, msg: { kind: 'typing' } },
  {
    delay: 1700,
    msg: {
      kind: 'in',
      text: 'Done. Your digest now includes a startups section — starting tomorrow, 7:00 AM sharp.',
      time: '7:12 AM',
    },
  },
  { delay: 1000, msg: { kind: 'chip', text: 'Next run', sub: 'Tomorrow · 7:00 AM' } },
]

const DIGEST = [
  { tag: 'AI', title: 'Open-weight models close the gap with frontier labs' },
  { tag: 'Chips', title: 'Next-gen accelerators push inference costs down 40%' },
  { tag: 'Dev', title: 'Agent frameworks become the default app backend' },
]

function DigestCard() {
  return (
    <div className="mt-1 overflow-hidden rounded-xl border border-black/[0.08] bg-[var(--paper)]">
      <div className="flex items-center gap-2 border-b border-black/[0.08] bg-[var(--paper-3)] px-3 py-2">
        <Newspaper className="h-3.5 w-3.5 text-[var(--forest-mid)]" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--forest-mid)]">
          Tech Digest · 3 stories
        </span>
      </div>
      <div className="divide-y divide-black/[0.06]">
        {DIGEST.map((it) => (
          <div key={it.title} className="px-3 py-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--forest-mid)]">
              {it.tag}
            </span>
            <p className="mt-0.5 text-[12px] leading-snug text-black/70">{it.title}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PhoneMockup() {
  const [step, setStep] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (step >= SCRIPT.length) {
      const t = window.setTimeout(() => setStep(0), 5200)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => setStep((s) => s + 1), SCRIPT[step].delay)
    return () => window.clearTimeout(t)
  }, [step])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [step])

  const visible = SCRIPT.slice(0, step)
    .map((s, idx) => ({ msg: s.msg, id: idx }))
    .filter(({ msg }, i, arr) => msg.kind !== 'typing' || i === arr.length - 1)

  return (
    <div className="relative w-full max-w-[390px] select-none">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-3 -top-3 z-20 h-8 w-8 border-l border-t border-[var(--forest)]/85"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-3 -top-3 z-20 h-8 w-8 border-r border-t border-[var(--forest)]/85"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-3 -left-3 z-20 h-8 w-8 border-b border-l border-[var(--forest)]/85"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-3 -right-3 z-20 h-8 w-8 border-b border-r border-[var(--forest)]/85"
      />
      <div className="relative flex h-[600px] flex-col overflow-hidden border border-[var(--rule-strong)] bg-[var(--paper)] surface-elevated">
        <div className="z-10 flex items-center gap-2.5 border-b border-black/[0.08] bg-[#efede8] px-3 py-3.5">
          <ChevronLeft className="h-5 w-5 -ml-0.5 text-black/40" />
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--forest-mid)]">
              <Sparkles className="h-4 w-4 text-[var(--paper)]" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#efede8] bg-[var(--leaf)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-tight text-[var(--ink)]">
              Tech News Agent
            </p>
            <p className="text-[10.5px] leading-tight text-[var(--forest-mid)]">
              scheduled · daily 7:00 AM
            </p>
          </div>
          <MoreVertical className="h-4 w-4 text-black/30" />
        </div>

        <div
          ref={scrollRef}
          className="scrollbar-none flex-1 space-y-2 overflow-y-auto px-3 py-3"
          style={{
            backgroundImage: 'radial-gradient(rgba(23,60,42,0.07) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        >
          {visible.map(({ msg: m, id }) => (
            <div
              key={id}
              className={
                m.kind === 'out'
                  ? 'flex justify-end'
                  : m.kind === 'date' || m.kind === 'chip'
                    ? 'flex justify-center'
                    : 'flex justify-start'
              }
            >
              {m.kind === 'date' && (
                <span className="rounded-full border border-black/[0.06] bg-[#e5e6e0] px-3 py-1 text-[10px] font-medium text-black/45">
                  {m.text}
                </span>
              )}
              {m.kind === 'in' && (
                <div className="max-w-[82%] rounded-2xl rounded-tl-sm bg-[#e7e8e2] px-3 py-2">
                  <p className="text-[13px] leading-snug text-black/70">{m.text}</p>
                  <p className="mt-1 text-right text-[9.5px] text-black/35">{m.time}</p>
                </div>
              )}
              {m.kind === 'digest' && (
                <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-[#e7e8e2] px-2.5 py-2">
                  <DigestCard />
                  <p className="mt-1 px-1 text-right text-[9.5px] text-black/35">{m.time}</p>
                </div>
              )}
              {m.kind === 'out' && (
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[var(--forest-mid)] px-3 py-2">
                  <p className="text-[13px] leading-snug text-[var(--paper)]">
                    {m.text}
                    <CheckCheck className="ml-1.5 inline h-3.5 w-3.5 align-middle text-[#b7d3bd]" />
                  </p>
                  <p className="mt-0.5 text-right text-[9.5px] text-[rgba(245,243,238,0.65)]">
                    {m.time}
                  </p>
                </div>
              )}
              {m.kind === 'typing' && (
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-[#e7e8e2] px-4 py-3">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="typing-dot h-1.5 w-1.5 rounded-full bg-black/30"
                      style={{ animationDelay: `${d * 0.18}s` }}
                    />
                  ))}
                </div>
              )}
              {m.kind === 'chip' && (
                <span className="flex items-center gap-2 rounded-full border border-[rgba(44,96,66,0.15)] bg-[var(--paper-3)] px-3.5 py-1.5 text-[10.5px] font-medium text-[var(--forest-mid)]">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {m.text}: <span className="font-semibold">{m.sub}</span>
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-black/[0.06] bg-[#efede8] px-2.5 pb-4 pt-2">
          <div className="flex flex-1 items-center gap-2 rounded-full bg-[#dedfd9] px-3.5 py-2.5">
            <Plus className="h-4 w-4 text-black/35" />
            <span className="flex-1 text-[12.5px] text-black/35">Message</span>
            <Mic className="h-4 w-4 text-black/35" />
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--forest-mid)]">
            <Send className="h-4 w-4 -ml-0.5 text-[var(--paper)]" />
          </div>
        </div>
      </div>
    </div>
  )
}
