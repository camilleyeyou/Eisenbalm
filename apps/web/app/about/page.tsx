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
 * Static about page. Interim Jesse-voice copy lives below; it will be
 * replaced with Andrew's approved wording when the editorial gate closes.
 * See the TODO(Andrew) comment for the replacement target.
 */
export default function AboutPage() {
  return (
    <article className="mx-auto max-w-[680px] px-4 md:px-6 lg:px-8 py-16">
      <h1 className="font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">
        About
      </h1>

      {/* TODO(Andrew): Replace the interim paragraphs below with your approved /about copy. Voice: Jesse — dry, precise, no irony signaling, no exclamation marks. Max 3-4 paragraphs. */}

      <p className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
        The Eisenbalm Dispatch is a weekly editorial publication. Each issue selects one
        overlooked charitable organization, produces an eight-section editorial examination
        of it, and donates one hundred percent of Jesse A. Eisenbalm lip balm proceeds to
        that organization for the duration of the issue.
      </p>

      <p className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
        The editorial posture is fixed. Every featured organization is treated with the
        gravity ordinarily reserved for a Fortune 500 company. The central question each
        issue answers is why the organization deserves to exist. The answer is given without
        sentiment.
      </p>

      <p className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
        A new issue ships every Thursday, following editorial review. The shop carries one
        product. The proceeds go entirely to the charity on the cover.
      </p>
    </article>
  )
}
