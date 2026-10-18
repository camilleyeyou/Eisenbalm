import type { Metadata } from 'next'
import { SitePage } from '@/components/dispatch/SitePage'

/**
 * /legal/terms — placeholder terms of service.
 *
 * CMR-08: the page must exist with no 404. Content is a documented
 * placeholder until Andrew commissions reviewed copy.
 *
 * TODO(Andrew): replace placeholder text with reviewed terms covering:
 * refund/return policy, shipping policy, intellectual property notice,
 * limitation of liability, governing law, contact email.
 */

export const metadata: Metadata = {
  title: 'Terms',
  description: 'Terms of service for The Eisenbalm Dispatch.',
}

export default function TermsPage() {
  return (
    <SitePage eyebrow="Legal" title="Terms" tone="blue" narrow>
      <article className="d-page-copy">
          <p className="d-body">
            The Eisenbalm Dispatch is operated by Jesse A. Eisenbalm (the
            proprietor) and offers a single product: a tube of lip balm.
            100% of net proceeds from each weekly sale benefit the featured
            charity for that week.
          </p>
          <p className="d-body">
            Payments are processed by Stripe and are subject to Stripe&apos;s
            terms. Refunds for damaged or missing items may be requested by
            emailing{' '}
            <a
              href="mailto:hello@eisenbalm.com"
            >
              hello@eisenbalm.com
            </a>{' '}
            within 30 days of delivery.
          </p>
          <p className="d-body">
            Editorial content on this site is intended for general interest.
            It does not constitute professional advice and should not be relied
            upon for legal, medical, or financial decisions.
          </p>
          <p className="d-label d-muted">
            Last updated: placeholder pending Andrew&apos;s review.
          </p>
      </article>
    </SitePage>
  )
}
