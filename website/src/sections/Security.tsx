import { Eye, Lock, Smartphone } from 'lucide-react'
import SectionHeading from '../components/SectionHeading'

const ITEMS = [
  {
    Icon: Eye,
    title: 'Read-first connectors',
    body: 'Connected services start with the narrowest permissions needed for the job.',
  },
  {
    Icon: Lock,
    title: 'Tokens stay in the vault',
    body: 'OAuth credentials are encrypted on the backend and never travel to your phone.',
  },
  {
    Icon: Smartphone,
    title: 'Revoke access anytime',
    body: 'Disconnect an account without rebuilding agents or changing your device setup.',
  },
]

export default function Security() {
  return (
    <section id="security" className="bg-[var(--forest-deep)] py-20 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Security"
          title={<>Useful access. Nothing more.</>}
          sub="Cuppet is designed around a simple boundary: agents can read what they need, while your credentials remain out of reach."
          align="left"
          tone="dark"
        />

        <p className="mt-4 max-w-2xl text-sm leading-6 text-[rgba(245,243,238,0.65)]">
          No procurement, no IT ticket, no admin approval. You connect your own accounts, on your
          own call, and you can disconnect them the same way.
        </p>

        <div className="mt-14 grid border-y border-[rgba(245,243,238,0.14)] sm:grid-cols-3">
          {ITEMS.map((item, i) => (
            <div
              key={item.title}
              className={`py-7 sm:px-7 ${
                i > 0 ? 'border-t border-[rgba(245,243,238,0.14)] sm:border-l sm:border-t-0' : ''
              }`}
            >
              <item.Icon className="h-4 w-4 text-[#a8ceb2]" strokeWidth={1.5} />
              <h3
                data-scroll-tone="dark"
                className="mt-7 text-sm font-semibold text-[rgba(245,243,238,0.9)]"
              >
                <span className="scroll-title-content">{item.title}</span>
              </h3>
              <p className="mt-2 text-xs leading-5 text-[rgba(245,243,238,0.65)]">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
