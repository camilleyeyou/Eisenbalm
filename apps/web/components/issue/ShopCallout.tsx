/**
 * Shop callout. UI-SPEC §ShopCallout.
 * Full-width surface. Pinned at the bottom of issue content, above footer.
 *
 * Phase 9 restyle: dark shop band with --color-surface background and
 * --color-primary CTA button (UI-SPEC accent-reserved: primary CTAs use
 * --color-primary bg with --color-bg text). print:hidden preserved.
 *
 * Voice rules (UI-SPEC copywriting contract — exact, no edits):
 *   - Sentence: "Jesse A. Eisenbalm lip balm. 100% of proceeds go to this week's featured charity."
 *   - Button: "Buy the lip balm"
 *
 * Anti-patterns to avoid:
 *   - Never a banner (UI-SPEC §"The shop callout is a footnote, not a CTA")
 *   - Never an urgency mechanic
 *   - Never more than one sentence + one link
 */

interface ShopCalloutProps {
  /** Stripe checkout URL — Phase 8 populates this. Pass null for Phase 2. */
  shopUrl?: string | null
}

export function ShopCallout({ shopUrl }: ShopCalloutProps) {
  const href = shopUrl ?? '/shop'

  return (
    <aside className="w-full border-t border-[color:var(--color-line-strong)] bg-[color:var(--color-surface)] px-4 py-16 sm:px-6 lg:px-8 print:hidden">
      <div className="mx-auto flex w-full max-w-[860px] flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
          Jesse A. Eisenbalm lip balm. 100% of proceeds go to this week&apos;s featured charity.
        </p>
        <a
          href={href}
          className="inline-flex min-h-[44px] flex-shrink-0 items-center justify-center px-8 py-3 font-ui text-[12px] font-medium uppercase tracking-[0.08em] leading-[1.5] text-[color:var(--color-bg)] [background-color:var(--color-primary)] transition-[background,box-shadow,transform] hover:[background-color:var(--color-primary-bright)] hover:shadow-[0_0_50px_-10px_var(--color-primary)] hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]"
        >
          Buy the lip balm
        </a>
      </div>
    </aside>
  )
}
