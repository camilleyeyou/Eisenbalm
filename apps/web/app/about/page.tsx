import type { Metadata } from 'next'
import { SITE_NAME, getSiteUrl } from '@/lib/site'

export const metadata: Metadata = {
  title: 'About',
  description: 'Jesse A. Eisenbalm. One charity per week. One product.',
  alternates: { canonical: `${getSiteUrl()}/about` },
  openGraph: {
    type: 'website',
    title: `About — ${SITE_NAME}`,
    description: 'Jesse A. Eisenbalm. One charity per week. One product.',
    url: '/about',
    images: ['/og-default.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: `About — ${SITE_NAME}`,
    description: 'Jesse A. Eisenbalm. One charity per week. One product.',
    images: ['/og-default.png'],
  },
}

/**
 * Static about page. Placeholder copy locked by UI-SPEC Copywriting Contract.
 * Andrew supplies real copy in a later phase; developer can inline it here
 * or extract to an MDX file — both options remain open.
 */
export default function AboutPage() {
  return (
    <article className="mx-auto max-w-[680px] px-4 md:px-6 lg:px-8 py-16">
      <h1 className="font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">
        About
      </h1>
      <p className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
        The Eisenbalm Dispatch publishes weekly. This page is being written.
      </p>
    </article>
  )
}
