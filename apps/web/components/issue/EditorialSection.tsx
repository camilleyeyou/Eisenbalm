/**
 * Reusable editorial prose section. UI-SPEC §2.
 *
 * Phase 10: refactored to consume .eyebrow, .prose-measure, .ornament-divider
 * utilities from globals.css. lead prop opts into .drop-cap on the body.
 * DES-02, DES-03, DES-04.
 *
 * Renders:
 *   - .ornament-divider (FLEURON U+2766) above the section
 *   - .eyebrow label + <AnchorCopyButton>
 *   - Headline (Display, 32/44px, weight 600, --color-primary)
 *   - Section body via <PortableTextRenderer> (wrapped in .drop-cap when lead)
 *
 * Used for: originStory, problemStatement, founderBio.
 * id prop sets the <section> element's id for anchor links.
 */
import type { PortableTextBlock } from '@portabletext/react'
import { PortableTextRenderer } from './PortableTextRenderer'
import { AnchorCopyButton } from '@/components/AnchorCopyButton'

interface EditorialSectionProps {
  /** Section anchor ID (no '#' prefix). */
  id: string
  /** Uppercase section label text, e.g., "ORIGIN STORY". */
  label: string
  /** Section headline. Renders "Untitled Section" fallback if absent. */
  headline?: string | null
  /** Portable Text body blocks. */
  body?: PortableTextBlock[] | null
  /** Additional className for the section element. */
  className?: string
  /** When true, applies the .drop-cap container to the body, giving the first
   *  paragraph's first letter a 3.5em drop cap. Set on the first prose section
   *  of an issue (typically Origin Story). DES-02. */
  lead?: boolean
}

export function EditorialSection({
  id,
  label,
  headline,
  body,
  className,
  lead = false,
}: EditorialSectionProps) {
  return (
    <section
      id={id}
      className={['prose-measure', className ?? ''].join(' ').trim()}
    >
      {/* Section ornament divider (DES-04) */}
      <div className="ornament-divider" aria-hidden="true" />

      {/* Label row */}
      <div className="mb-4 flex items-center gap-2">
        <span className="eyebrow">{label}</span>
        <AnchorCopyButton sectionId={id} />
      </div>

      {/* Headline */}
      <h2 className="mt-3 mb-8 font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.005em] text-[color:var(--color-primary)] sm:text-[44px]">
        {headline ?? 'Untitled Section'}
      </h2>

      {/* Body prose — lead section wraps in .drop-cap so the PortableTextRenderer's
          first <p> is a direct child of the .drop-cap container (selector match). */}
      <PortableTextRenderer value={body} className={lead ? 'drop-cap' : undefined} />

      {/* Bottom breathing room */}
      <div className="mt-8" aria-hidden="true" />
    </section>
  )
}
