export default function NotFoundVisual({ requestedPath = '/somewhere/else' }: { requestedPath?: string }) {
  return (
    <div className="relative mx-auto w-full max-w-[30rem] overflow-hidden rounded-[1.75rem] border border-[var(--forest)]/[0.12] bg-[var(--paper-2)] p-3 shadow-[0_32px_80px_-36px_rgba(12,25,17,0.42)] sm:p-4">
      <svg
        aria-label="Origami messenger bird searching for a missing route"
        className="h-auto w-full"
        role="img"
        viewBox="0 0 520 520"
      >
        <defs>
          <linearGradient id="not-found-coral" x1="37" y1="13" x2="76" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ff9a7f" />
            <stop offset="1" stopColor="#c94f66" />
          </linearGradient>
          <linearGradient id="not-found-indigo" x1="38" y1="52" x2="109" y2="81" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#5d579d" />
            <stop offset="1" stopColor="#29264f" />
          </linearGradient>
          <linearGradient id="not-found-teal" x1="30" y1="110" x2="75" y2="75" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0b625b" />
            <stop offset="1" stopColor="#2ba898" />
          </linearGradient>
          <linearGradient id="not-found-amber" x1="78" y1="38" x2="112" y2="66" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#f4c66d" />
            <stop offset="1" stopColor="#db8833" />
          </linearGradient>
          <filter id="not-found-shadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#173c2a" floodOpacity="0.14" />
          </filter>
        </defs>

        <rect width="520" height="520" fill="#f5f3ee" />
        <rect x="20" y="20" width="480" height="480" rx="24" fill="#f5f3ee" stroke="#173c2a" strokeOpacity="0.12" />
        <circle cx="382" cy="224" r="164" fill="#e0e9df" opacity="0.7" />

        <g fill="none" stroke="#173c2a" strokeOpacity="0.12">
          <path d="M40 110h440M40 410h440M110 40v440M410 40v440" />
          <path d="M80 300c0-130 98-224 220-224s220 94 220 224-98 224-220 224S80 430 80 300Z" strokeDasharray="3 8" />
          <path d="M118 264c46-92 160-138 260-85 100 52 112 168 43 246" strokeDasharray="2 7" />
        </g>

        <g>
          <circle cx="108" cy="166" r="7" fill="#e56b61" />
          <circle cx="408" cy="108" r="6" fill="#f4b554" />
          <circle cx="444" cy="350" r="7" fill="#48a6ad" />
          <circle cx="118" cy="386" r="5" fill="#8db77b" />
        </g>

        <g fill="#173c2a" fontFamily="DM Sans, system-ui, sans-serif" fontSize="10" letterSpacing="2">
          <text x="52" y="65">MESSAGE ROUTE</text>
          <text x="468" y="65" textAnchor="end" fillOpacity="0.5">404</text>
        </g>

        <g filter="url(#not-found-shadow)" transform="translate(146 128) scale(2.08)">
          <g strokeLinejoin="round">
            <path d="m13 47 35 9-7 16-28-8 17-7Z" fill="#55508f" />
            <path d="m13 88 28-16 8 8-26 21 7-18Z" fill="#e56b61" />
            <path d="m47 57-10-44 42 26Z" fill="url(#not-found-coral)" />
            <path d="m41 71-12 43 44-31Z" fill="url(#not-found-teal)" />
            <path d="m45 56 34-18 31 24-38 22-31-13Z" fill="url(#not-found-indigo)" />
            <path d="m45 56 34-18-7 46-31-13Z" fill="#f5f3ee" />
            <path d="m79 38 25 9 9 14-5 7-18-9Z" fill="url(#not-found-amber)" />
            <path d="m108 55 17 7-18 6Z" fill="#f58a73" />
            <path d="m72 84 18-25 18 9Z" fill="#3f356d" opacity=".65" />
          </g>
          <circle cx="101" cy="53" r="3" fill="#17201c" />
        </g>

        <g transform="translate(52 426)">
          <rect width="416" height="48" rx="12" fill="#ebe9e2" stroke="#173c2a" strokeOpacity="0.1" />
          <text x="16" y="19" fill="#173c2a" fillOpacity="0.48" fontFamily="DM Sans, system-ui, sans-serif" fontSize="9" fontWeight="600" letterSpacing="1.4">
            NO RESULT
          </text>
          <text x="16" y="36" fill="#171a17" fillOpacity="0.78" fontFamily="DM Sans, system-ui, sans-serif" fontSize="12">
            {requestedPath}
          </text>
        </g>
      </svg>
    </div>
  )
}
