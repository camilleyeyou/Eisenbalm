/**
 * Shop callout. UI-SPEC §ShopCallout.
 * Full-width surface. Pinned at the bottom of issue content, above footer.
 *
 * Phase 2: static one-sentence + link styled as a button.
 * Phase 8 wires Stripe checkout URL.
 * Plan 02-09 upgrades this to use the shadcn <Button asChild> variant.
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
    <aside className="w-full bg-[color:var(--color-surface,var(--color-bg))] px-4 py-8 sm:px-6 lg:px-8 print:hidden">
      <div className="mx-auto flex w-full max-w-[860px] flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
          Jesse A. Eisenbalm lip balm. 100% of proceeds go to this week&apos;s featured charity.
        </p>
        <a
          href={href}
          className="inline-flex min-h-[44px] flex-shrink-0 items-center justify-center rounded px-4 py-2 font-ui text-[14px] font-semibold leading-[1.5] text-[color:var(--color-bg)] [background-color:var(--color-accent)] transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
        >
          Buy the lip balm
        </a>
      </div>
    </aside>
  )
}
