import Link from 'next/link'
import { Logo } from './Navbar'

export default function Footer() {
  return (
    <footer className="border-t border-[var(--rule)] py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 sm:flex-row sm:px-8">
        <div className="flex flex-col items-center gap-1.5 sm:items-start">
          <Logo size="sm" />
          <p className="text-[11px] text-[var(--ink-faint)]">
            Work gets done. You get a message.
          </p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-[var(--ink-faint)]">
          <Link href="/" className="transition-colors duration-200 hover:text-[var(--ink)]">
            Product
          </Link>
          <Link href="/about" className="transition-colors duration-200 hover:text-[var(--ink)]">
            About Us
          </Link>
          <Link href="/blog" className="transition-colors duration-200 hover:text-[var(--ink)]">
            Blog
          </Link>
          <Link href="/privacy" className="transition-colors duration-200 hover:text-[var(--ink)]">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors duration-200 hover:text-[var(--ink)]">
            Terms
          </Link>
        </nav>
        <p className="text-[11px] text-[var(--ink-faint)]">© 2026 Cuppet</p>
      </div>
    </footer>
  )
}
