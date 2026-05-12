/**
 * Reusable editorial prose section. UI-SPEC §2.
 * Container: editorial (680px).
 *
 * Renders:
 *   - Top divider (1px --color-border, 32px above/below)
 *   - Section label (UI, 14px, muted, uppercase, letter-spacing 0.1em) + <AnchorCopyButton>
 *   - Section headline (Display, 36px/28px mobile, weight 600, --color-primary)
 *   - Section body via <PortableTextRenderer>
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
}

export function EditorialSection({
  id,
  label,
  headline,
  body,
  className,
}: EditorialSectionProps) {
  return (
    <section
      id={id}
      className={[
        'mx-auto w-full max-w-[680px] px-4 sm:px-6 lg:px-8',
        className ?? '',
      ]
        .join(' ')
        .trim()}
    >
      {/* Top divider */}
      <div
        className="mb-8 h-px bg-[color:var(--color-text)]"
        style={{ opacity: 0.12 }}
        aria-hidden="true"
      />

      {/* Label row */}
      <div className="mb-4 flex items-center gap-2">
        <span className="font-ui text-[14px] uppercase leading-[1.5] tracking-[0.1em] text-[color:var(--color-text)] opacity-60">
          {label}
        </span>
        <AnchorCopyButton sectionId={id} />
      </div>

      {/* Headline */}
      <h2 className="mb-6 font-display text-[28px] font-semibold leading-[1.15] text-[color:var(--color-primary)] sm:text-[36px]">
        {headline ?? 'Untitled Section'}
      </h2>

      {/* Body prose */}
      <PortableTextRenderer value={body} />

      {/* Bottom breathing room */}
      <div className="mt-8" aria-hidden="true" />
    </section>
  )
}
