import type { ReactNode } from 'react'
import Breadcrumb from './Breadcrumb'
import SiteLayout from './SiteLayout'

type LegalDocumentProps = {
  title: string
  effectiveDate: string
  lastUpdated: string
  content: string
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function renderInline(value: string): ReactNode[] {
  const parts = value.split(/(\[[A-Z][A-Z0-9 ,.:'/-]*\]|https?:\/\/[^\s)]+)/g)

  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith('http')) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="break-words text-[#24583b] underline decoration-[#24583b]/25 underline-offset-4 transition-colors hover:decoration-[#24583b]"
        >
          {part}
        </a>
      )
    }

    if (part.startsWith('[') && part.endsWith(']')) {
      return (
        <span
          key={`${part}-${index}`}
          className="rounded bg-[#e3e9df] px-1.5 py-0.5 font-mono text-[0.78em] font-medium text-[#24583b]"
        >
          {part}
        </span>
      )
    }

    return part
  })
}

function renderParagraph(block: string) {
  const lines = block.split('\n')
  return (
    <p>
      {lines.map((line, index) => (
        <span key={`${line}-${index}`}>
          {renderInline(line)}
          {index < lines.length - 1 && <br />}
        </span>
      ))}
    </p>
  )
}

function renderBlock(block: string, index: number) {
  if (block.startsWith('### ')) {
    const heading = block.slice(4)
    return (
      <h3 key={`${heading}-${index}`} id={slugify(heading)}>
        <span className="scroll-title-content">{heading}</span>
      </h3>
    )
  }

  if (block.startsWith('## ')) {
    const heading = block.slice(3)
    return (
      <h2 key={`${heading}-${index}`} id={slugify(heading)}>
        <span className="scroll-title-content">{heading}</span>
      </h2>
    )
  }

  const lines = block.split('\n')

  if (lines.every((line) => line.startsWith('- '))) {
    return (
      <ul key={`list-${index}`}>
        {lines.map((line) => (
          <li key={line}>{renderInline(line.slice(2))}</li>
        ))}
      </ul>
    )
  }

  if (lines.every((line) => /^\d+\.\s/.test(line))) {
    return (
      <ol key={`list-${index}`}>
        {lines.map((line) => (
          <li key={line}>{renderInline(line.replace(/^\d+\.\s/, ''))}</li>
        ))}
      </ol>
    )
  }

  if (lines.length >= 2 && lines.every((line) => line.startsWith('|'))) {
    const rows = lines
      .filter((line) => !/^\|[\s|-]+\|$/.test(line))
      .map((line) =>
        line
          .slice(1, -1)
          .split('|')
          .map((cell) => cell.trim()),
      )
    const [header, ...body] = rows

    return (
      <div key={`table-${index}`} className="legal-table-wrap">
        <table>
          <thead>
            <tr>
              {header.map((cell) => (
                <th key={cell}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row) => (
              <tr key={row.join('-')}>
                {row.map((cell) => (
                  <td key={cell}>{renderInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return <div key={`paragraph-${index}`}>{renderParagraph(block)}</div>
}

export default function LegalDocument({
  title,
  effectiveDate,
  lastUpdated,
  content,
}: LegalDocumentProps) {
  const blocks = content.trim().split(/\n\s*\n/)
  const headings = blocks
    .filter((block) => block.startsWith('## '))
    .map((block) => block.slice(3))

  return (
    <SiteLayout>
      <main>
        <header className="relative border-b border-[var(--rule)] px-5 pb-16 pt-36 sm:px-8 sm:pb-20 sm:pt-44">
          <div className="pointer-events-none absolute inset-0 grid-bg opacity-45" />
          <div className="relative mx-auto max-w-6xl">
            <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: title }]} className="mb-6" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
              Legal
            </p>
            <h1 className="mt-6 max-w-4xl font-display text-[3.4rem] font-normal leading-[0.92] tracking-[-0.04em] text-[var(--ink)] sm:text-[5.5rem]">
              <span className="scroll-title-content">{title}</span>
            </h1>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--rule)] pt-6 text-[11px] text-[var(--ink-faint)]">
              <p>
                <span className="mr-2 font-semibold uppercase tracking-[0.12em]">Effective</span>
                {renderInline(effectiveDate)}
              </p>
              <p>
                <span className="mr-2 font-semibold uppercase tracking-[0.12em]">Last updated</span>
                {renderInline(lastUpdated)}
              </p>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <details className="mb-12 border-y border-black/10 py-4 lg:hidden">
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50">
              On this page
            </summary>
            <nav className="mt-5 grid gap-3 sm:grid-cols-2" aria-label={`${title} sections`}>
              {headings.map((heading) => (
                <a
                  key={heading}
                  href={`#${slugify(heading)}`}
                  className="text-[12px] leading-5 text-black/50 transition-colors hover:text-[#24583b]"
                >
                  {heading}
                </a>
              ))}
            </nav>
          </details>

          <div className="grid gap-16 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-20">
            <aside className="hidden lg:block">
              <nav
                className="sticky top-28 max-h-[calc(100vh-9rem)] overflow-y-auto border-l border-black/10 pl-5 scrollbar-none"
                aria-label={`${title} sections`}
              >
                <p className="mb-5 text-[9px] font-semibold uppercase tracking-[0.18em] text-black/30">
                  On this page
                </p>
                <div className="space-y-3.5">
                  {headings.map((heading) => (
                    <a
                      key={heading}
                      href={`#${slugify(heading)}`}
                      className="block text-[11px] leading-4 text-black/42 transition-colors hover:text-[#24583b]"
                    >
                      {heading}
                    </a>
                  ))}
                </div>
              </nav>
            </aside>

            <article className="legal-copy min-w-0">
              {blocks.map((block, index) => renderBlock(block, index))}
            </article>
          </div>
        </div>
      </main>
    </SiteLayout>
  )
}
