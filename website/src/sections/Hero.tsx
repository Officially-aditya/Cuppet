import { ArrowRight, Check, LockKeyhole } from 'lucide-react'
import PhoneMockup from '../components/PhoneMockup'

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-24">
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
        <div className="min-w-0 text-center lg:text-left">
          <h1 className="font-display text-[3.55rem] font-normal leading-[0.91] tracking-[-0.035em] text-[var(--ink)] sm:text-[5rem] lg:text-[5.25rem]">
            <span className="scroll-title-content">Work gets done.</span>
            <span className="scroll-title-content mt-1 block font-display-italic text-[var(--forest-mid)]">
              You get a message.
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-[34rem] text-[16px] leading-7 text-[var(--ink-soft)] sm:text-[17px] lg:mx-0">
            Create an agent in one sentence. It works across your connected accounts, keeps its
            schedule, and sends the result to your inbox. No dashboards to babysit.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <a href="#cta" className="btn-primary w-full sm:w-auto">
              Join private beta
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#how" className="btn-ghost w-full sm:w-auto">
              See how it works
              <span aria-hidden="true" className="ml-0.5">
                ↓
              </span>
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[11px] font-medium text-[var(--ink-faint)] lg:justify-start">
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-[var(--forest-mid)]" />
              No workflow builder
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-[var(--forest-mid)]" />
              Cancel anytime
            </span>
            <span className="flex items-center gap-1.5">
              <LockKeyhole className="h-3.5 w-3.5 text-[var(--forest-mid)]" />
              Read-first access
            </span>
          </div>
        </div>

        <figure className="flex w-full min-w-0 justify-center lg:justify-end">
          <div className="w-full max-w-[390px]">
            <PhoneMockup />
            <figcaption className="sr-only">
              Product demo: scheduled tech news agent delivering a morning digest in chat.
            </figcaption>
          </div>
        </figure>
      </div>
    </section>
  )
}
