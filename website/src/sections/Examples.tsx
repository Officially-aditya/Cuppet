import { CalendarClock, Github, HardDrive, Inbox, Newspaper } from 'lucide-react'
import SectionHeading from '../components/SectionHeading'

const EXAMPLES = [
  {
    Icon: Newspaper,
    name: 'Morning brief',
    prompt: 'Send me the three tech stories worth reading every morning at 7.',
    schedule: 'Daily · 7:00 AM',
    result: 'A concise digest, already ranked.',
  },
  {
    Icon: Inbox,
    name: 'Inbox close',
    prompt: 'Summarize my inbox at 6 and flag anything that needs a reply.',
    schedule: 'Weekdays · 6:00 PM',
    result: 'The day’s loose ends in one message.',
  },
  {
    Icon: HardDrive,
    name: 'Project watch',
    prompt: 'Tell me what changed in the client folder every Friday.',
    schedule: 'Weekly · Friday',
    result: 'A change log without checking Drive.',
  },
  {
    Icon: Github,
    name: 'Standup digest',
    prompt: 'Summarize what shipped in GitHub and flag anything blocked, every weekday morning.',
    schedule: 'Weekdays · 8:00 AM',
    result: 'A living change log without opening the repo.',
  },
]

export default function Examples() {
  return (
    <section id="examples" className="py-20 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="In practice"
          title={<>The kind of work that should already be done.</>}
          sub="Start with a sentence. Refine the agent by replying to it like you would to a capable teammate."
          align="left"
        />

        <div className="mt-14 overflow-hidden rounded-[var(--radius-surface)] border border-[var(--rule)]">
          {EXAMPLES.map((ex) => (
            <article
              key={ex.name}
              className="grid gap-4 border-b border-[var(--rule)] bg-[var(--paper)] px-5 py-6 last:border-b-0 transition-colors duration-200 hover:bg-[var(--paper-2)] sm:grid-cols-[180px_minmax(0,1fr)_170px] sm:items-center sm:gap-8 sm:px-7"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--paper)]">
                  <ex.Icon className="h-4 w-4 text-[var(--forest-mid)]" strokeWidth={1.6} />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-[var(--ink)]">{ex.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[9px] uppercase tracking-[0.08em] text-[var(--ink-faint)]">
                    <CalendarClock className="h-2.5 w-2.5" />
                    {ex.schedule}
                  </p>
                </div>
              </div>
              <p className="text-[15px] leading-6 text-[var(--ink-soft)]">“{ex.prompt}”</p>
              <p className="text-xs leading-5 text-[var(--ink-faint)] sm:text-right">{ex.result}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
