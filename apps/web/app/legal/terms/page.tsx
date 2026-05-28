import type { Metadata } from 'next'

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
    <article className="mx-auto max-w-[720px] px-4 md:px-6 lg:px-8 py-16">
      <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
        Legal
      </p>
      <h1 className="mt-3 font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">
        Terms
      </h1>

      <div className="mt-8 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)] space-y-6">
        <p>
          The Eisenbalm Dispatch is operated by Jesse A. Eisenbalm (the
          proprietor) and offers a single product: a tube of lip balm.
          100% of net proceeds from each weekly sale benefit the featured
          charity for that week.
        </p>
        <p>
          Payments are processed by Stripe and are subject to Stripe&apos;s
          terms. Refunds for damaged or missing items may be requested by
          emailing{' '}
          <a
            href="mailto:hello@eisenbalm.com"
            className="text-[color:var(--color-accent)] underline-offset-4 hover:underline"
          >
            hello@eisenbalm.com
          </a>{' '}
          within 30 days of delivery.
        </p>
        <p>
          Editorial content on this site is intended for general interest.
          It does not constitute professional advice and should not be relied
          upon for legal, medical, or financial decisions.
        </p>
        <p className="font-ui text-[14px] text-[color:var(--color-text-muted)]">
          Last updated: placeholder pending Andrew&apos;s review.
        </p>
      </div>
    </article>
  )
}
