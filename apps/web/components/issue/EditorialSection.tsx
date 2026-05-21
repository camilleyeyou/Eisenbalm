/**
 * Reusable editorial prose section. UI-SPEC §2.
 *
 * Phase 9 restyle: adopted the dark §-label editorial treatment per
 * UI-SPEC §Typography. The section label row now renders a `§` glyph
 * in --color-accent followed by the label text in --color-text-mute
 * ui font (replacing the plain .eyebrow class). Headline upgraded to
 * clamp(38px,5vw,64px) display font at weight 400 per UI-SPEC section
 * headline scale. Body prose via PortableTextRenderer (19px / 1.85 in
 * --color-text-dim). Drop-cap lead via .drop-cap on first prose section.
 * DES-02, DES-03, DES-04.
 *
 * LOCKED constraints:
 *   - id prop sets <section id> — canonical set (origin-story, problem,
 *     founder-bio) so AnchorCopyButton and SectionNavigator hrefs keep working.
 *   - lead prop opts into .drop-cap on the body wrapper.
 *   - No <main>. This is a <section>.
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
   *  paragraph's first letter a drop cap. Set on the first prose section
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

      {/* Label row: § glyph (accent) + label in eyebrow class + anchor button.
          The eyebrow class provides the ui font, uppercase, and tracking.
          The § pseudo-prefix uses --color-accent per UI-SPEC §-mark treatment. */}
      <div className="mb-6 flex items-center gap-2">
        <div className="flex items-center gap-[0.5em]">
          <span
            className="font-ui text-[14px] leading-[1] text-[color:var(--color-accent)]"
            aria-hidden="true"
          >
            §
          </span>
          <span className="eyebrow">{label}</span>
        </div>
        <AnchorCopyButton sectionId={id} />
      </div>

      {/* Section headline — display font, clamp(38px,5vw,64px), weight 400, --color-primary */}
      <h2 className="mt-3 mb-10 font-display text-[clamp(38px,5vw,64px)] font-normal leading-[1.05] tracking-[-0.015em] text-[color:var(--color-primary)]">
        {headline ?? 'Untitled Section'}
      </h2>

      {/* Body prose — lead section wraps in .drop-cap so PortableTextRenderer's
          first <p> is a direct child of .drop-cap and matches the selector. */}
      <PortableTextRenderer value={body} className={lead ? 'drop-cap' : undefined} />

      {/* Bottom breathing room */}
      <div className="mt-10" aria-hidden="true" />
    </section>
  )
}
