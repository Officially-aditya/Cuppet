import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import SiteLayout from '../components/SiteLayout'

export default function NotFound() {
  return (
    <SiteLayout>
      <main className="flex min-h-[78vh] items-center px-5 pb-20 pt-32 sm:px-8">
        <div className="mx-auto w-full max-w-6xl border-y border-black/10 py-20 text-center">
          <p className="font-mono text-[10px] text-black/30">404 / NOT FOUND</p>
          <h1 className="mt-6 font-display text-[4rem] font-normal leading-none tracking-[-0.04em] text-[#171a17] sm:text-[6rem]">
            <span className="scroll-title-content">
              Nothing to see <span className="italic text-[#2c6042]">here.</span>
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-md text-sm leading-6 text-black/50">
            This page may have moved, or the address may be incorrect.
          </p>
          <Link
            href="/"
            className="group mt-9 inline-flex items-center gap-2 rounded-full bg-[#173c2a] px-5 py-3 text-sm font-semibold text-[#F5F3EE]"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Product
          </Link>
        </div>
      </main>
    </SiteLayout>
  )
}
