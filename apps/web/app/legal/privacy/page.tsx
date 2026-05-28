import type { Metadata } from 'next'

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
    <article className="mx-auto max-w-[720px] px-4 md:px-6 lg:px-8 py-16">
      <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
        Legal
      </p>
      <h1 className="mt-3 font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">
        Privacy
      </h1>

      <div className="mt-8 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)] space-y-6">
        <p>
          The Eisenbalm Dispatch collects the minimum data needed to ship lip
          balm and to acknowledge receipt of payment. We use Stripe to process
          payments; Stripe receives the data necessary to complete the
          transaction, including your name, email, billing address, shipping
          address, and payment details.
        </p>
        <p>
          We do not maintain marketing email lists. We do not sell or share
          your information with third parties beyond Stripe and the postal
          carrier required to deliver your order.
        </p>
        <p>
          For questions about your data, contact{' '}
          <a
            href="mailto:hello@eisenbalm.com"
            className="text-[color:var(--color-accent)] underline-offset-4 hover:underline"
          >
            hello@eisenbalm.com
          </a>
          .
        </p>
        <p className="font-ui text-[14px] text-[color:var(--color-text-muted)]">
          Last updated: placeholder pending Andrew&apos;s review.
        </p>
      </div>
    </article>
  )
}
