import { ArrowUpRight, Check, Mail, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import Breadcrumb from '../components/Breadcrumb'
import SiteLayout from '../components/SiteLayout'

const deletionEmail = 'info@cuppet.in'
const deletionRequestHref = `mailto:${deletionEmail}?subject=${encodeURIComponent(
  'Cuppet account deletion request',
)}&body=${encodeURIComponent(
  [
    'Hello Cuppet team,',
    '',
    'Please delete my Cuppet account.',
    '',
    'Account email:',
    '',
    'I understand that this request permanently removes my Cuppet account and associated data.',
    '',
    'Thank you.',
  ].join('\n'),
)}`

const removedItems = [
  'Your Cuppet account and profile information',
  'Agents, schedules, conversations, and Assistant memories',
  'Saved preferences and personalization records',
  'Connector credentials and active notification tokens',
]

export default function AccountDeletion() {
  return (
    <SiteLayout>
      <main>
        <section className="relative overflow-hidden border-b border-[var(--rule)] px-5 pb-16 pt-36 sm:px-8 sm:pb-24 sm:pt-44">
          <div className="pointer-events-none absolute inset-0 grid-bg opacity-45" />
          <div className="relative mx-auto max-w-6xl">
            <Breadcrumb
              items={[{ label: 'Home', href: '/' }, { label: 'Delete account' }]}
              className="mb-10"
            />

            <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-end lg:gap-20">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                  Account deletion
                </p>
                <h1 className="mt-6 max-w-3xl font-display text-[3.6rem] font-normal leading-[0.92] tracking-[-0.04em] text-[var(--ink)] sm:text-[6rem]">
                  Delete your Cuppet account.
                </h1>
                <p className="mt-8 max-w-2xl text-base leading-7 text-[var(--ink-soft)] sm:text-lg">
                  You can delete your account from the app at any time. If you cannot
                  access the app, start a deletion request here and we will verify it
                  before removing the account.
                </p>
              </div>

              <aside className="rounded-[1.75rem] border border-[var(--rule-strong)] bg-white/65 p-6 shadow-[0_24px_70px_-48px_rgba(12,25,17,0.45)] backdrop-blur-sm sm:p-8">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--paper-3)] text-[var(--forest)]">
                  <Mail className="h-5 w-5" />
                </div>
                <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                  Start a request
                </p>
                <h2 className="mt-3 font-display text-3xl leading-none tracking-[-0.03em] text-[var(--ink)]">
                  Send it from your account email.
                </h2>
                <p className="mt-4 text-sm leading-6 text-[var(--ink-soft)]">
                  This lets us verify that the request comes from the account owner.
                  We will confirm the request before completing deletion.
                </p>
                <a
                  href={deletionRequestHref}
                  className="btn-primary mt-7 w-full"
                >
                  Email deletion request
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <p className="mt-4 break-words text-[11px] leading-5 text-[var(--ink-faint)]">
                  Or email{' '}
                  <a
                    href={`mailto:${deletionEmail}`}
                    className="text-[var(--forest-mid)] underline decoration-[var(--forest-mid)]/25 underline-offset-4"
                  >
                    {deletionEmail}
                  </a>
                  .
                </p>
              </aside>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-24">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
              Already signed in?
            </p>
            <h2 className="mt-5 max-w-md font-display text-4xl leading-[0.98] tracking-[-0.035em] text-[var(--ink)] sm:text-5xl">
              Delete it in a few taps.
            </h2>
            <p className="mt-6 max-w-md text-sm leading-6 text-[var(--ink-soft)]">
              In Cuppet, open Settings, choose your Profile, and select Delete my
              account. Confirm the two prompts to permanently delete the account.
            </p>
            <div className="mt-8 flex items-start gap-3 border-t border-[var(--rule)] pt-5 text-[12px] leading-5 text-[var(--ink-faint)]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--forest-mid)]" />
              <p>
                We verify requests before deletion. Removing the Cuppet account does
                not delete information held independently by connected providers.
              </p>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-[var(--rule)] bg-[var(--paper-2)]/55 p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              What will be removed
            </p>
            <ul className="mt-6 space-y-4">
              {removedItems.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-6 text-[var(--ink-soft)]">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--forest)] text-[var(--paper)]">
                    <Check className="h-3 w-3" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 border-t border-[var(--rule)] pt-6 text-[12px] leading-5 text-[var(--ink-faint)]">
              <p>
                Provider-owned data, files in your own Google Drive, legally required
                records, and encrypted backups may follow the retention rules of the
                relevant provider or policy.
              </p>
              <Link
                href="/privacy#17-account-deletion"
                className="mt-4 inline-flex items-center gap-1.5 font-semibold text-[var(--forest-mid)] underline decoration-[var(--forest-mid)]/25 underline-offset-4"
              >
                Read the Privacy Policy
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </SiteLayout>
  )
}
