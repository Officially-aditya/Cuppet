import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import Breadcrumb from '../components/Breadcrumb'
import EditorialVisual from '../components/EditorialVisual'
import SiteLayout from '../components/SiteLayout'
import { blogPosts, getBlogPost } from '../data/blog'

export default function BlogPost({ slug }: { slug: string }) {
  const post = getBlogPost(slug)

  if (!post) return null

  const currentIndex = blogPosts.findIndex((item) => item.slug === post.slug)
  const nextPost = blogPosts[(currentIndex + 1) % blogPosts.length]
  return (
    <SiteLayout>
      <main>
        <article>
          <header className="px-5 pb-14 pt-32 sm:px-8 sm:pb-16 sm:pt-40">
            <div className="mx-auto max-w-3xl">
              <Breadcrumb
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Blog', href: '/blog' },
                  { label: post.title },
                ]}
                className="mb-8"
              />

              <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-[var(--ink-faint)]">
                <span className="rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--forest-mid)]">
                  {post.category}
                </span>
                <time dateTime={post.published}>{post.displayDate}</time>
                <span aria-hidden="true">·</span>
                <span>{post.readingTime}</span>
              </div>

              <h1 className="mt-6 max-w-3xl font-display text-[2.9rem] font-normal leading-[0.95] tracking-[-0.035em] text-[var(--ink)] sm:text-[4.25rem]">
                <span className="scroll-title-content">{post.title}</span>
              </h1>
              <p className="mt-7 max-w-2xl text-[17px] leading-8 text-[var(--ink-soft)] sm:text-[19px]">
                {post.dek}
              </p>

              <div className="mt-9 flex items-center gap-3 border-t border-[var(--rule)] pt-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--forest)] text-[11px] font-bold text-[var(--paper)]">
                  C
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-[var(--ink)]">Cuppet team</p>
                  <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">Product and research</p>
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-4xl px-5 sm:px-8">
            <EditorialVisual variant={post.visual} />
          </div>

          <div className="mx-auto max-w-[720px] px-5 py-16 sm:px-8 sm:py-24">
            {post.sections.map((section, index) => (
              <section key={section.heading} className={index === 0 ? '' : 'mt-14'}>
                <h2 className="font-display text-[2rem] font-normal leading-[1.05] tracking-[-0.025em] text-[var(--ink)] sm:text-[2.4rem]">
                  <span className="scroll-title-content">{section.heading}</span>
                </h2>
                <div className="mt-6 space-y-5">
                  {section.paragraphs.map((paragraph) => (
                    <p
                      key={paragraph.slice(0, 48)}
                      className="text-[16px] leading-8 text-[var(--ink-soft)]"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>

        <aside className="border-y border-[var(--rule)] bg-[var(--paper-2)] px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[0.85fr_1.15fr] md:gap-14">
            <EditorialVisual variant={nextPost.visual} compact />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                Read next
              </p>
              <h3 className="mt-4 max-w-xl font-display text-[2.4rem] font-normal leading-[0.98] tracking-[-0.03em] text-[var(--ink)] sm:text-[3.1rem]">
                <span className="scroll-title-content">
                  <Link
                    href={`/blog/${nextPost.slug}`}
                    className="transition-colors duration-200 hover:text-[var(--forest-mid)]"
                  >
                    {nextPost.title}
                  </Link>
                </span>
              </h3>
              <p className="mt-4 max-w-lg text-sm leading-6 text-[var(--ink-soft)]">
                {nextPost.excerpt}
              </p>
              <Link
                href={`/blog/${nextPost.slug}`}
                className="group mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[var(--forest)] transition-colors duration-200 hover:text-[var(--forest-mid)]"
              >
                Continue reading
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </aside>
      </main>
    </SiteLayout>
  )
}
