import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { DM_Sans, Instrument_Serif } from 'next/font/google'
import { SITE_URL } from '@/lib/metadata'
import '../src/index.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-body',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-display',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Cuppet',
  description:
    'Create persistent agents in one sentence. Cuppet works across your connected accounts, keeps the schedule, and sends the result to your inbox.',
  icons: {
    icon: '/cuppet-icon-full-color.svg',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Cuppet',
    description:
      'Create persistent agents in one sentence. Cuppet works across your connected accounts, keeps the schedule, and sends the result to your inbox.',
    url: SITE_URL,
    siteName: 'Cuppet',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Cuppet — Persistent AI Agents',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cuppet',
    description:
      'Create persistent agents in one sentence. Cuppet works across your connected accounts, keeps the schedule, and sends the result to your inbox.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F5F3EE',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${instrumentSerif.variable}`}>
      <body>
        {children}
      </body>
    </html>
  )
}
