import type { Metadata } from 'next'

export const SITE_NAME = 'Cuppet'
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://cuppet-app.shatslabs.chatgpt.site'
export const DEFAULT_OG_IMAGE = '/og-image.png'

export type MetadataOptions = {
  title: string
  description: string
  path: string
  type?: 'website' | 'article'
  published?: string
  noIndex?: boolean
  image?: string
}

export function createMetadata({
  title,
  description,
  path,
  type = 'website',
  published,
  noIndex = false,
  image = DEFAULT_OG_IMAGE,
}: MetadataOptions): Metadata {
  const fullTitle = title === SITE_NAME ? title : `${title} — ${SITE_NAME}`
  const ogImages = [
    {
      url: image,
      width: 1200,
      height: 630,
      alt: fullTitle,
    },
  ]

  const sharedOpenGraph = {
    title: fullTitle,
    description,
    url: path,
    siteName: SITE_NAME,
    images: ogImages,
  }

  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: path },
    openGraph:
      type === 'article'
        ? { ...sharedOpenGraph, type: 'article', publishedTime: published }
        : { ...sharedOpenGraph, type: 'website' },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [image],
    },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
  }
}
