import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import Terms from '@/views/Terms'

export const metadata: Metadata = createMetadata({
  title: 'Terms and Conditions',
  description: 'Terms and Conditions governing access to and use of the Cuppet service.',
  path: '/terms',
})

export default function Page() {
  return <Terms />
}
