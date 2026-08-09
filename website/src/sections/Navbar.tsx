'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react'
import { Menu, X, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { label: 'Product', href: '/', end: true },
  { label: 'About Us', href: '/about', end: false },
  { label: 'Blog', href: '/blog', end: false },
]

export function Logo({
  size = 'md',
  onNavigate,
}: {
  size?: 'md' | 'sm'
  onNavigate?: () => void
}) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className="group flex items-center gap-2.5"
      aria-label="Cuppet home"
    >
      <img
        src="/cuppet-icon-full-color.svg"
        alt=""
        width={size === 'md' ? 32 : 28}
        height={size === 'md' ? 32 : 28}
        className={`shrink-0 object-contain transition-transform duration-300 group-hover:-rotate-6 ${
          size === 'md' ? 'h-8 w-8' : 'h-7 w-7'
        }`}
      />
      <span className="font-body text-[16px] tracking-[-0.03em] text-[var(--ink)] font-semibold">
        Cuppet
      </span>
    </Link>
  )
}

export default function Navbar() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  const isActive = (href: string, end: boolean) =>
    end ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <header className="fixed top-0 inset-x-0 z-50 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 sm:pt-[max(1rem,env(safe-area-inset-top))]">
      <nav
        className={`mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 rounded-full px-3 sm:px-4 transition-[background-color,box-shadow,border-color] duration-300 ${
          scrolled || open
            ? 'border border-[var(--rule)] bg-[rgba(245,243,238,0.88)] shadow-[0_12px_40px_-24px_rgba(12,25,17,0.35)] backdrop-blur-xl'
            : 'border border-transparent bg-transparent'
        }`}
      >
        <Logo onNavigate={() => setOpen(false)} />

        <div className="hidden md:flex items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors duration-200 ${
                  isActive(l.href, l.end)
                    ? 'bg-[var(--paper-3)] text-[var(--forest)]'
                    : 'text-[var(--ink-soft)] hover:bg-black/[0.04] hover:text-[var(--ink)]'
                }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/#cta"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[var(--forest)] px-4 py-2 text-[13px] font-semibold text-[var(--paper)] transition-colors duration-200 hover:bg-[#102e20]"
          >
            Join private beta
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden flex h-11 w-11 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--paper)]/70 text-[var(--ink)]"
            aria-label="Toggle menu"
            aria-expanded={open}
            aria-controls="mobile-navigation"
          >
            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </nav>

      {open && (
        <div
          id="mobile-navigation"
          className="mx-auto mt-2 max-w-5xl overflow-hidden rounded-2xl border border-[var(--rule)] bg-[rgba(245,243,238,0.96)] px-3 py-3 shadow-[0_16px_48px_-28px_rgba(12,25,17,0.4)] backdrop-blur-xl md:hidden"
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`block rounded-xl px-3 py-3 text-sm transition-colors ${
                  isActive(l.href, l.end)
                    ? 'bg-[var(--paper-3)] font-semibold text-[var(--forest)]'
                    : 'text-[var(--ink-soft)] hover:bg-black/[0.03] hover:text-[var(--ink)]'
                }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/#cta"
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-[var(--forest)] px-4 py-2.5 text-sm font-semibold text-[var(--paper)]"
          >
            Join private beta
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </header>
  )
}
