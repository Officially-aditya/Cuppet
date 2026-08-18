import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import AccountDeletion from '@/views/AccountDeletion'

export const metadata: Metadata = createMetadata({
  title: 'Delete your account',
  description: 'Request deletion of your Cuppet account and associated data.',
  path: '/profile/delete',
})

export default function Page() {
  return <AccountDeletion />
}
