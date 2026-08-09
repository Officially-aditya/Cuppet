import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import Blog from '@/views/Blog'

export const metadata: Metadata = createMetadata({
  title: 'Blog',
  description:
    'Ideas from Cuppet about selected intelligence, connected tools, trustworthy AI, and designing for attention.',
  path: '/blog',
})

export default function Page() {
  return <Blog />
}
