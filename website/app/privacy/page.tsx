import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import Privacy from '@/views/Privacy'

export const metadata: Metadata = createMetadata({
  title: 'Privacy Policy',
  description: 'How Cuppet collects, uses, stores, shares, and protects personal data.',
  path: '/privacy',
})

export default function Page() {
  return <Privacy />
}
