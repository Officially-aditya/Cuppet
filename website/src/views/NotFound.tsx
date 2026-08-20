import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import NotFoundVisual from '../components/NotFoundVisual'
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
              <p className="font-mono text-lg font-bold uppercase tracking-[0.14em] text-[var(--forest-mid)] sm:text-xl">
                404 / ROUTE NOT FOUND
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

          <NotFoundVisual />
        </div>
      </main>
    </SiteLayout>
  )
}
