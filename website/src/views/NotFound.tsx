import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import SiteLayout from '../components/SiteLayout'

export default function NotFound() {
  return (
    <SiteLayout>
      <main className="relative isolate flex min-h-[calc(100vh-11rem)] items-center overflow-hidden px-5 pb-20 pt-32 sm:px-8">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-80" />
        <div className="pointer-events-none absolute -right-40 top-28 h-[30rem] w-[30rem] rounded-full border border-[var(--forest)]/[0.08] shadow-[0_0_0_2rem_rgba(23,60,42,0.025),0_0_0_5rem_rgba(23,60,42,0.018)]" />
        <div className="pointer-events-none absolute -bottom-48 -left-32 h-[28rem] w-[28rem] rotate-45 border border-[var(--forest)]/[0.07]" />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          <div>
            <div className="flex items-center gap-3">
              <span className="pulse-dot h-2 w-2 rounded-full bg-[var(--leaf)]" aria-hidden="true" />
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-faint)]">
                404 / route not found
              </p>
            </div>

            <h1 className="mt-7 max-w-2xl font-display text-[4rem] font-normal leading-[0.92] tracking-[-0.05em] text-[var(--ink)] sm:text-[6.5rem]">
              This page went <span className="italic text-[var(--forest-mid)]">off schedule.</span>
            </h1>

            <p className="mt-7 max-w-md text-[15px] leading-7 text-[var(--ink-soft)]">
              Cuppet could not find that address. It may have moved, or it may never have been on the run list.
            </p>

            <div className="mt-9 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <Link href="/" className="btn-primary group">
                <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
                Return home
              </Link>
              <Link href="/blog" className="btn-ghost group">
                Browse the journal
                <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:justify-self-end">
            <div className="absolute -inset-4 rounded-[2rem] border border-[var(--forest)]/[0.08]" />
            <div className="relative overflow-hidden rounded-[1.75rem] bg-[var(--forest)] p-5 text-[var(--paper)] shadow-[0_32px_80px_-36px_rgba(12,25,17,0.55)] sm:p-6">
              <div className="beta-geometry absolute inset-0 opacity-70" />

              <div className="relative z-10">
                <div className="flex items-center justify-between border-b border-[#92bf9d]/20 pb-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#dce9de]/65">
                    Agent route check
                  </p>
                  <span className="rounded-full border border-[#92bf9d]/25 px-2.5 py-1 font-mono text-[10px] text-[#dce9de]/75">
                    404
                  </span>
                </div>

                <div className="flex min-h-[15rem] items-center justify-center py-8">
                  <div className="relative flex h-44 w-44 items-center justify-center rounded-full border border-[#92bf9d]/25">
                    <div className="absolute inset-5 rounded-full border border-[#92bf9d]/20" />
                    <div className="absolute inset-11 rounded-full border border-[#92bf9d]/25" />
                    <div className="h-3 w-3 rounded-full bg-[#b7d4b9] shadow-[0_0_0_10px_rgba(183,212,185,0.1),0_0_32px_rgba(183,212,185,0.4)]" />
                    <span className="absolute bottom-3 rounded-full bg-[#dce9de]/10 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[#dce9de]/65">
                      no result
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#92bf9d]/20 bg-black/10 p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#dce9de]/50">Requested address</p>
                  <p className="mt-2 break-all font-mono text-xs text-[#dce9de]/80">/somewhere/else</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </SiteLayout>
  )
}
