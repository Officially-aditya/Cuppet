import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import NotFound from '@/views/NotFound'

export const metadata: Metadata = createMetadata({
  title: 'Page Not Found',
  description: 'The page you requested could not be found.',
  path: '/404',
  noIndex: true,
})

export default function NotFoundRoute() {
  return <NotFound />
}
