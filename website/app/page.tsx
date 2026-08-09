import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import Home from '@/views/Home'

export const metadata: Metadata = createMetadata({
  title: 'Cuppet',
  description:
    'Create persistent agents in one sentence. Cuppet works across your connected accounts, keeps the schedule, and sends the result to your inbox.',
  path: '/',
})

export default function Page() {
  return <Home />
}
