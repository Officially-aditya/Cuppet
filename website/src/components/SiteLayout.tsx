import type { ReactNode } from 'react'
import Navbar from '../sections/Navbar'
import Footer from '../sections/Footer'

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--paper)] text-[var(--ink)]">
      <Navbar />
      {children}
      <Footer />
    </div>
  )
}
