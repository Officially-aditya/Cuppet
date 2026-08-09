import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import About from '@/views/About'

export const metadata: Metadata = createMetadata({
  title: 'About Us',
  description:
    'Cuppet is building a better way to use AI: selected, relevant information from the tools you already use, delivered when it matters.',
  path: '/about',
})

export default function Page() {
  return <About />
}
