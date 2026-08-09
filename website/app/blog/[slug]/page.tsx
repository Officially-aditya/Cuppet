import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { blogPosts, getBlogPost } from '@/data/blog'
import { createMetadata, SITE_URL } from '@/lib/metadata'
import BlogPost from '@/views/BlogPost'

type BlogPostRouteProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return blogPosts.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: BlogPostRouteProps): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)

  if (!post) {
    return createMetadata({
      title: 'Page not found',
      description: 'The page you requested could not be found.',
      path: `/blog/${slug}`,
      noIndex: true,
    })
  }

  return createMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    type: 'article',
    published: post.published,
  })
}

export default async function Page({ params }: BlogPostRouteProps) {
  const { slug } = await params
  const post = getBlogPost(slug)

  if (!post) notFound()

  const canonicalPath = `/blog/${post.slug}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.published,
    dateModified: post.published,
    author: { '@type': 'Organization', name: 'Cuppet team' },
    publisher: { '@type': 'Organization', name: 'Cuppet' },
    mainEntityOfPage: `${SITE_URL}${canonicalPath}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <BlogPost slug={slug} />
    </>
  )
}
