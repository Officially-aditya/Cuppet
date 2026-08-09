'use client'

import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'

export default function CTA() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)

  const submit = () => {
    if (/^\S+@\S+\.\S+$/.test(email)) setDone(true)
  }

  return (
    <section id="cta" className="border-t border-[var(--rule)]">
      <div className="beta-geometry relative mx-auto w-full max-w-6xl overflow-hidden bg-[var(--ink)] px-5 py-14 text-center sm:px-10 sm:py-24 md:my-8 md:rounded-[var(--radius-surface)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(245,243,238,0.6)]">
          Private beta
        </p>
        <h2
          data-scroll-tone="dark"
          className="mx-auto mt-5 max-w-2xl font-display text-[clamp(2.25rem,11vw,4rem)] font-normal leading-[0.98] tracking-[-0.03em] text-[var(--paper)]"
        >
          <span className="scroll-title-content">Your next status update should arrive on its own.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-md text-sm leading-6 text-[rgba(245,243,238,0.65)]">
          Join the early group shaping Cuppet for iOS and Android. We’ll only write when there is
          something useful to share.
        </p>

        {done ? (
          <div className="mx-auto mt-9 flex w-full max-w-md items-start gap-2.5 rounded-2xl border border-[rgba(245,243,238,0.15)] bg-[rgba(245,243,238,0.05)] px-4 py-3.5 text-left text-sm leading-5 text-[rgba(245,243,238,0.75)] sm:w-fit sm:items-center sm:rounded-full sm:px-6">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#92bf9d]">
              <Check className="h-3 w-3 text-[var(--forest)]" strokeWidth={3} />
            </span>
            {"You're on the list — we'll message you. Naturally."}
          </div>
        ) : (
          <div className="mx-auto mt-9 flex w-full max-w-md flex-col gap-2 rounded-2xl border border-[rgba(245,243,238,0.15)] bg-[rgba(245,243,238,0.05)] p-1.5 sm:flex-row sm:rounded-full">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="you@example.com"
              className="w-full min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-[var(--paper)] outline-none placeholder:text-[rgba(245,243,238,0.65)] sm:px-5"
            />
            <button
              onClick={submit}
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--paper)] px-5 py-3 text-sm font-semibold text-[var(--forest)] transition-opacity duration-200 hover:opacity-90 sm:w-auto"
            >
              Get early access
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <p className="mt-5 px-2 text-[10px] leading-4 text-[rgba(245,243,238,0.65)]">
          No spam · Early access is free · Leave anytime
        </p>
      </div>
    </section>
  )
}
