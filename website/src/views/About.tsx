import { ArrowDown, ArrowRight, CircleDotDashed } from 'lucide-react'
import Link from 'next/link'
import Breadcrumb from '../components/Breadcrumb'
import SiteLayout from '../components/SiteLayout'
import CTA from '../sections/CTA'

export default function About() {
  return (
    <SiteLayout>
      <main>
        <section className="relative border-b border-[var(--rule)] px-5 pb-20 pt-36 sm:px-8 sm:pb-28 sm:pt-44">
          <div className="pointer-events-none absolute inset-0 grid-bg opacity-60" />
          <div className="relative mx-auto max-w-6xl">
            <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'About' }]} className="mb-6" />
            <div className="max-w-4xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                About Cuppet
              </p>
              <h1 className="mt-6 max-w-4xl font-display text-[3.6rem] font-normal leading-[0.92] tracking-[-0.04em] text-[var(--ink)] sm:text-[6rem]">
                <span className="scroll-title-content">Make better use of AI.</span>
              </h1>
              <div className="mt-10 grid gap-7 border-t border-[var(--rule)] pt-7 md:grid-cols-[1fr_1.1fr]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                  Our point of view
                </p>
                <p className="max-w-xl text-[16px] leading-7 text-[var(--ink-soft)]">
                  AI should not ask for more of your attention. It should help you decide what
                  deserves it.
                </p>
              </div>
              <ArrowDown className="mt-14 h-5 w-5 text-[var(--forest-mid)]" strokeWidth={1.5} />
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 sm:py-32">
          <div className="mx-auto grid max-w-6xl gap-10 border-t border-[var(--rule)] pt-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
            <div>
              <h2 className="font-display text-[2.6rem] font-normal leading-none tracking-[-0.025em] text-[var(--ink)] sm:text-[3.25rem]">
                <span className="scroll-title-content">The problem</span>
              </h2>
            </div>
            <p className="max-w-3xl text-[17px] leading-8 text-[var(--ink-soft)] sm:text-[19px] sm:leading-9">
              Everyone knows that AI is good at research, coding, writing, planning, and dozens of
              other tasks. The technology can explain almost any topic and generate more information
              than any person could reasonably consume. Yet most of us still begin the day by
              opening the same inboxes, feeds, documents, calendars, project boards, and dashboards
              to work out what changed and what deserves a response. The problem is no longer access
              to information; it is the effort required to separate what is relevant from everything
              that is merely available. Today’s AI often adds another destination to that routine.
              We open a chatbot, collect context from several places, write the right prompt, and
              then evaluate a response that may be useful but knows little about the commitments
              already shaping our day. A perfect summary of everything is still too much when only
              two details require a decision. As information becomes easier to create, attention
              becomes more valuable. AI should not increase the number of things we need to check.
              It should reduce them.
            </p>
          </div>
        </section>

        <section className="border-y border-[var(--rule)] bg-[var(--paper-2)] px-5 py-20 sm:px-8 sm:py-32">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
            <div>
              <h2 className="font-display text-[2.6rem] font-normal leading-none tracking-[-0.025em] text-[var(--ink)] sm:text-[3.25rem]">
                <span className="scroll-title-content">The solution</span>
              </h2>
            </div>
            <div className="max-w-3xl">
              <p className="text-[17px] leading-8 text-[var(--ink-soft)] sm:text-[19px] sm:leading-9">
                We believe AI should become a quiet layer across the tools people already use.
                Instead of waiting for another prompt, it should remember the outcome you care
                about, read only the sources you deliberately connect, and select the small amount
                of information that matches your instructions. A daily industry brief should contain
                the three changes relevant to your work, not every headline published overnight. An
                inbox update should surface the messages that need your reply, not celebrate the
                number of emails it processed. A project monitor should stay silent until a
                meaningful decision, deadline, or file changes. And when something does deserve
                attention, the result should arrive through a familiar channel with a clear link
                back to the source. This is the idea behind Cuppet: persistent agents that work
                across your existing accounts, keep the schedule you set, and send a concise message
                when there is something worth knowing. Less searching, less context switching, and
                fewer dashboards to babysit. The value of AI is not measured by how much it can
                produce. It is measured by how clearly it helps you use the finite time and
                attention you already have.
              </p>
              <Link
                href="/"
                className="group mt-10 inline-flex items-center gap-2 text-sm font-semibold text-[var(--forest)]"
              >
                See the product
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden rounded-[var(--radius-surface)] border border-[var(--rule)] bg-[var(--paper-3)]">
              <span className="absolute inset-x-0 top-1/2 h-px bg-[rgba(23,60,42,0.15)]" />
              <span className="absolute inset-y-0 left-1/2 w-px bg-[rgba(23,60,42,0.15)]" />
              <span className="absolute h-48 w-48 rounded-full border border-[rgba(23,60,42,0.15)]" />
              <span className="absolute h-28 w-28 rounded-full border border-[rgba(23,60,42,0.2)]" />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[var(--forest)]">
                <CircleDotDashed className="h-7 w-7 text-[var(--paper)]" strokeWidth={1.3} />
              </span>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                Our measure
              </p>
              <h2 className="mt-5 max-w-lg font-display text-[2.8rem] font-normal leading-[0.97] tracking-[-0.03em] text-[var(--ink)] sm:text-[3.75rem]">
                <span className="scroll-title-content">More signal. Less software.</span>
              </h2>
              <p className="mt-6 max-w-lg text-[15px] leading-7 text-[var(--ink-soft)]">
                The best result is not more time spent inside Cuppet. It is fewer questions to
                remember, fewer places to check, and a clearer understanding of what matters next.
              </p>
            </div>
          </div>
        </section>

        <CTA />
      </main>
    </SiteLayout>
  )
}
