'use client'

import { useState } from 'react'
import SectionHeading from '../components/SectionHeading'
import { ConnectScreen, ConfirmScreen, ThreadScreen } from '../components/AppScreens'

const CLAIMS = [
  {
    key: 'confirm',
    title: 'Create an agent',
    body: 'One sentence becomes a structured, scheduled agent \u2014 reviewed before it ever runs.',
    Screen: ConfirmScreen,
  },
  {
    key: 'thread',
    title: 'Watch it deliver',
    body: 'News arrives with a TL;DR up top, with full detail one tap away.',
    Screen: ThreadScreen,
  },
  {
    key: 'connect',
    title: 'Connect only what\u2019s required',
    body: 'Choose exactly which services an agent can use. Nothing is connected by default.',
    Screen: ConnectScreen,
  },
] as const

export default function Walkthrough() {
  const [active, setActive] = useState<(typeof CLAIMS)[number]['key']>('confirm')
  const activeClaim = CLAIMS.find((c) => c.key === active) ?? CLAIMS[0]
  const ActiveScreen = activeClaim.Screen

  return (
    <section id="how" className="border-t border-[var(--rule)] bg-[var(--paper)] py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-start gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
        <div className="min-w-0">
          <SectionHeading
            eyebrow="The product"
            title="Inside an agent, start to finish."
            sub="One phone, one thread — the same screens the app actually shows you."
            align="left"
          />

          <div className="mt-8 flex flex-col">
            {CLAIMS.map((claim, i) => (
              <button
                key={claim.key}
                type="button"
                onClick={() => setActive(claim.key)}
                className={`flex items-start gap-4 border-t border-[var(--rule)] px-0 py-4 text-left transition-colors last:border-b ${
                  active === claim.key ? 'rounded-2xl border-transparent bg-[var(--paper-2)] px-5 -mx-5' : ''
                }`}
              >
                <span
                  className={`w-7 shrink-0 font-display text-[19px] leading-none ${
                    active === claim.key ? 'text-[var(--forest)]' : 'text-[var(--ink-faint)]'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>
                  <span
                    className={`block text-[15px] font-semibold ${
                      active === claim.key ? 'text-[var(--forest)]' : 'text-[var(--ink)]'
                    }`}
                  >
                    {claim.title}
                  </span>
                  <span className="mt-1 block max-w-[42ch] text-[13.5px] leading-[1.55] text-[var(--ink-soft)]">
                    {claim.body}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex justify-center lg:justify-end">
          <div className="relative w-full max-w-[390px] select-none">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -left-3 -top-3 z-20 h-8 w-8 border-l border-t border-[var(--forest)]/70"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-3 -top-3 z-20 h-8 w-8 border-r border-t border-[var(--forest)]/70"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-3 -left-3 z-20 h-8 w-8 border-b border-l border-[var(--forest)]/70"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-3 -right-3 z-20 h-8 w-8 border-b border-r border-[var(--forest)]/70"
            />
            <div className="relative flex h-[600px] flex-col overflow-hidden border border-[var(--rule-strong)] bg-[var(--paper)] surface-elevated">
              <ActiveScreen />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
