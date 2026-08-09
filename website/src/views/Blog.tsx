import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import Breadcrumb from '../components/Breadcrumb'
import EditorialVisual from '../components/EditorialVisual'
import SiteLayout from '../components/SiteLayout'
import { blogPosts } from '../data/blog'
import CTA from '../sections/CTA'

export default function Blog() {
  const [featured, ...rest] = blogPosts

  return (
    <SiteLayout>
      <main>
        <section className="relative border-b border-[var(--rule)] px-5 pb-16 pt-36 sm:px-8 sm:pb-24 sm:pt-44">
          <div className="pointer-events-none absolute inset-0 grid-bg opacity-50" />
          <div className="relative mx-auto max-w-6xl">
            <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Blog' }]} className="mb-6" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
              Blog
            </p>
            <div className="mt-5 grid items-end gap-8 lg:grid-cols-[1.15fr_0.85fr]">
              <h1 className="max-w-3xl font-display text-[3.5rem] font-normal leading-[0.92] tracking-[-0.04em] text-[var(--ink)] sm:text-[5.5rem]">
                <span className="scroll-title-content">Ideas for quieter, more useful AI.</span>
              </h1>
              <p className="max-w-md pb-1 text-[15px] leading-7 text-[var(--ink-soft)] lg:ml-auto">
                Notes on attention, connected work, product judgment, and building AI that knows
                when not to interrupt.
              </p>
            </div>
          </div>
        </section>

        {featured && (
          <section className="border-b border-[var(--rule)] px-5 py-14 sm:px-8 sm:py-20">
            <article className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
              <Link href={`/blog/${featured.slug}`} aria-label={`Read ${featured.title}`}>
                <EditorialVisual variant={featured.visual} />
              </Link>
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[var(--ink-faint)]">
                  <span className="rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--forest-mid)]">
                    {featured.category}
                  </span>
                  <time dateTime={featured.published}>{featured.displayDate}</time>
                  <span aria-hidden="true">·</span>
                  <span>{featured.readingTime}</span>
                </div>
                <h2 className="mt-5 max-w-xl font-display text-[2.4rem] font-normal leading-[0.98] tracking-[-0.03em] text-[var(--ink)] sm:text-[3.1rem]">
                  <span className="scroll-title-content">
                    <Link
                      href={`/blog/${featured.slug}`}
                      className="transition-colors duration-200 hover:text-[var(--forest-mid)]"
                    >
                      {featured.title}
                    </Link>
                  </span>
                </h2>
                <p className="mt-5 max-w-lg text-[15px] leading-7 text-[var(--ink-soft)]">
                  {featured.excerpt}
                </p>
                <Link
                  href={`/blog/${featured.slug}`}
                  className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--forest)]"
                >
                  Read article
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </div>
            </article>
          </section>
        )}

        {rest.length > 0 && (
          <section className="px-5 py-16 sm:px-8 sm:py-24">
            <div className="mx-auto max-w-6xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                More writing
              </p>
              <div className="mt-8 overflow-hidden rounded-[var(--radius-surface)] border border-[var(--rule)]">
                {rest.map((post) => (
                  <article
                    key={post.slug}
                    className="grid gap-6 border-b border-[var(--rule)] bg-[var(--paper)] p-5 last:border-b-0 transition-colors duration-200 hover:bg-[var(--paper-2)] sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center sm:gap-10 sm:p-7"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--ink-faint)]">
                        <span className="font-semibold text-[var(--forest-mid)]">{post.category}</span>
                        <time dateTime={post.published}>{post.displayDate}</time>
                        <span aria-hidden="true">·</span>
                        <span>{post.readingTime}</span>
                      </div>
                      <h2 className="mt-3 max-w-xl text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--ink)] sm:text-[1.5rem]">
                        <span className="scroll-title-content">
                          <Link
                            href={`/blog/${post.slug}`}
                            className="transition-colors duration-200 hover:text-[var(--forest-mid)]"
                          >
                            {post.title}
                          </Link>
                        </span>
                      </h2>
                      <p className="mt-3 max-w-xl text-[14px] leading-6 text-[var(--ink-soft)]">
                        {post.excerpt}
                      </p>
                      <Link
                        href={`/blog/${post.slug}`}
                        className="group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--forest)]"
                      >
                        Read article
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                      </Link>
                    </div>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="hidden sm:block"
                      aria-label={`Read ${post.title}`}
                    >
                      <EditorialVisual variant={post.visual} compact />
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        <CTA />
      </main>
    </SiteLayout>
  )
}
