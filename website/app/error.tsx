'use client'

export default function Error({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-[#F5F3EE] px-6 py-20 text-[#171a17]">
      <h1 className="text-2xl font-semibold">
        <span className="scroll-title-content">Something went wrong</span>
      </h1>
      <p className="mt-3 max-w-xl text-sm text-black/60">{error.message}</p>
      <button
        type="button"
        className="mt-6 rounded-full bg-[#173c2a] px-4 py-2 text-sm font-semibold text-[#F5F3EE]"
        onClick={() => window.location.assign('/')}
      >
        Reload home
      </button>
    </div>
  )
}
