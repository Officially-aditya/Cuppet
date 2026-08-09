import type { ReactNode } from 'react'

export default function SectionHeading({
  eyebrow,
  title,
  sub,
  align = 'center',
  tone = 'light',
}: {
  eyebrow: string
  title: ReactNode
  sub?: string
  align?: 'center' | 'left'
  tone?: 'light' | 'dark'
}) {
  const dark = tone === 'dark'
  return (
    <div className={`max-w-3xl ${align === 'center' ? 'mx-auto text-center' : ''}`}>
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
          dark ? 'text-[rgba(245,243,238,0.65)]' : 'text-[var(--ink-faint)]'
        }`}
      >
        {eyebrow}
      </p>
      <h2
        data-scroll-tone={dark ? 'dark' : undefined}
        className={`mt-4 font-display text-[2.4rem] font-normal leading-[0.98] tracking-[-0.03em] sm:text-[3.4rem] ${
          dark ? 'text-[var(--paper)]' : 'text-[var(--ink)]'
        }`}
      >
        <span className="scroll-title-content">{title}</span>
      </h2>
      {sub && (
        <p
          className={`mt-5 max-w-2xl text-[15px] leading-7 ${align === 'center' ? 'mx-auto' : ''} ${
            dark ? 'text-[rgba(245,243,238,0.65)]' : 'text-[var(--ink-soft)]'
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  )
}
