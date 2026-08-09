import { Cable, Funnel, Radar, ShieldCheck } from 'lucide-react'
import type { BlogVisual } from '../data/blog'

const VISUALS = {
  signal: {
    Icon: Radar,
    label: 'Signal',
    title: 'Notice what changed.',
  },
  connections: {
    Icon: Cable,
    label: 'Context',
    title: 'Work where work lives.',
  },
  filter: {
    Icon: Funnel,
    label: 'Selection',
    title: 'Less, but more relevant.',
  },
  trust: {
    Icon: ShieldCheck,
    label: 'Trust',
    title: 'Read first. Act later.',
  },
} satisfies Record<BlogVisual, { Icon: typeof Radar; label: string; title: string }>

export default function EditorialVisual({
  variant,
  compact = false,
}: {
  variant: BlogVisual
  compact?: boolean
}) {
  const { Icon, label, title } = VISUALS[variant]

  return (
    <div
      className={`editorial-visual editorial-visual--${variant} relative overflow-hidden rounded-[var(--radius-surface)] border border-[var(--rule)] bg-[var(--paper-3)] ${
        compact ? 'min-h-[220px]' : 'min-h-[320px] sm:min-h-[400px]'
      }`}
      role="img"
      aria-label={`Abstract illustration: ${title}`}
    >
      <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-[var(--rule)] px-5 py-3.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
          {label}
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--leaf)]" />
      </div>

      <div className="absolute left-1/2 top-[52%] flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(23,60,42,0.18)] bg-[rgba(245,243,238,0.7)] sm:h-32 sm:w-32">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--forest)] sm:h-14 sm:w-14">
          <Icon className="h-5 w-5 text-[var(--paper)] sm:h-6 sm:w-6" strokeWidth={1.4} />
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-[var(--rule)] px-5 py-4">
        <p className="max-w-[14rem] font-display text-[1.35rem] leading-none tracking-[-0.02em] text-[var(--forest)] sm:text-[1.5rem]">
          {title}
        </p>
      </div>
    </div>
  )
}
