import type { Metadata } from 'next'
import { SitePage } from '@/components/dispatch/SitePage'

/**
 * /legal/privacy — placeholder privacy policy.
 *
 * CMR-07: the page must exist with no 404. Content is a documented
 * placeholder until Andrew commissions reviewed copy.
 *
 * TODO(Andrew): replace placeholder text with reviewed privacy copy
 * covering: data we collect (Stripe customer details, shipping address),
 * data we share (Stripe processes payments), retention period, EU/UK/CA
 * subject rights, contact email.
 */

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'Privacy practices for The Eisenbalm Dispatch.',
}

export default function PrivacyPage() {
  return (
    <SitePage eyebrow="Legal" title="Privacy" tone="blue" narrow>
      <article className="d-page-copy">
          <p className="d-body">
            The Eisenbalm Dispatch collects the minimum data needed to ship lip
            balm and to acknowledge receipt of payment. We use Stripe to process
            payments; Stripe receives the data necessary to complete the
            transaction, including your name, email, billing address, shipping
            address, and payment details.
          </p>
          <p className="d-body">
            We do not maintain marketing email lists. We do not sell or share
            your information with third parties beyond Stripe and the postal
            carrier required to deliver your order.
          </p>
          <p className="d-body">
            For questions about your data, contact{' '}
            <a
              href="mailto:hello@eisenbalm.com"
            >
              hello@eisenbalm.com
            </a>
            .
          </p>
          <p className="d-label d-muted">
            Last updated: placeholder pending Andrew&apos;s review.
          </p>
      </article>
    </SitePage>
  )
}
