import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { SITE_URL } from '../lib/metadata'

export type BreadcrumbItem = {
  label: string
  href?: string
}

export default function Breadcrumb({
  items,
  className = '',
}: {
  items: BreadcrumbItem[]
  className?: string
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: item.href.startsWith('http') ? item.href : `${SITE_URL}${item.href}` } : {}),
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <nav
        aria-label="Breadcrumb"
        className={`flex flex-wrap items-center gap-1.5 text-[12px] font-medium text-[var(--ink-faint)] ${className}`}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <Fragment key={index}>
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-[var(--ink-faint)] opacity-60" />}
              {isLast || !item.href ? (
                <span className="text-[var(--ink)] font-semibold truncate max-w-[280px] sm:max-w-md" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="transition-colors duration-200 hover:text-[var(--forest-mid)]"
                >
                  {item.label}
                </Link>
              )}
            </Fragment>
          )
        })}
      </nav>
    </>
  )
}