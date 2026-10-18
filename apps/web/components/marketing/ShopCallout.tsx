import Link from 'next/link'

/**
 * ShopCallout — rendered at the bottom of /issue/[slug] (Plan 02-06).
 *
 * UI-SPEC rules (non-negotiable):
 *   - One sentence. One button. NEVER a banner. NEVER a modal.
 *   - No urgency language. No exclamation marks.
 *   - The CTA is a Dispatch .d-pill link.
 *   - Print stylesheet hides this component (@media print).
 *
 * Copy is locked by the UI-SPEC Copywriting Contract. Do not rephrase.
 *
 * charityName: if provided, renders the specific charity callout sentence.
 *              if omitted, renders the generic fallback sentence.
 */
interface ShopCalloutProps {
  charityName?: string | null
}

export function ShopCallout({ charityName }: ShopCalloutProps) {
  const sentence = charityName
    ? `This week's proceeds benefit ${charityName}.`
    : 'Proceeds go to our featured charity each week.'

  return (
    <aside
      className="mt-16 border-t-2 border-current pt-8 print:hidden"
      aria-label="Shop callout"
    >
      <p className="d-body">
        {sentence}
      </p>
      <Link href="/shop" className="d-pill d-pill--ink mt-4">
        Buy the lip balm
      </Link>
    </aside>
  )
}
