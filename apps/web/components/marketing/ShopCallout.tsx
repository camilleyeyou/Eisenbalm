import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * ShopCallout — rendered at the bottom of /issue/[slug] (Plan 02-06).
 *
 * UI-SPEC rules (non-negotiable):
 *   - One sentence. One button. NEVER a banner. NEVER a modal.
 *   - No urgency language. No exclamation marks.
 *   - Button uses shadcn <Button asChild size="lg"> wrapping <Link>.
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
      className="mt-16 border-t border-[color:var(--color-border)] pt-8 print:hidden"
      aria-label="Shop callout"
    >
      <p className="font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
        {sentence}
      </p>
      <Button asChild size="lg" className="mt-4">
        <Link href="/shop">Buy the lip balm</Link>
      </Button>
    </aside>
  )
}
