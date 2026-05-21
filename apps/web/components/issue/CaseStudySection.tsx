/**
 * Case study section. UI-SPEC §3.
 * Anchor ID: #case-study.
 *
 * Phase 9 restyle: adopted the dark §-label editorial treatment matching
 * EditorialSection. Headline upgraded to clamp(38px,5vw,64px) display font,
 * weight 400. The .metadata-block dl panel (DES-05) retains its --color-accent
 * left border + tabular-nums footnote-style treatment.
 *
 * LOCKED constraints:
 *   - id="case-study" — canonical anchor; AnchorCopyButton + SectionNavigator links.
 *   - .metadata-block class preserved for DES-05 typography test assertions.
 *   - No <main>. This is a <section>.
 */
import type { PortableTextBlock } from '@portabletext/react'
import { PortableTextRenderer } from './PortableTextRenderer'
import { AnchorCopyButton } from '@/components/AnchorCopyButton'

interface CaseStudySectionProps {
  subjectName?: string | null
  headline?: string | null
  body?: PortableTextBlock[] | null
}

export function CaseStudySection({ subjectName, headline, body }: CaseStudySectionProps) {
  return (
    <section id="case-study" className="prose-measure">
      {/* Section ornament divider (DES-04) */}
      <div className="ornament-divider" aria-hidden="true" />

      {/* Label row: § glyph in --color-accent + label text in --color-text-mute */}
      <div className="mb-6 flex items-center gap-2">
        <div className="flex items-center gap-[0.6em]">
          <span
            className="font-ui text-[14px] leading-[1.5] text-[color:var(--color-accent)]"
            aria-hidden="true"
          >
            §
          </span>
          <span className="font-ui text-[11px] uppercase leading-[1.5] tracking-[0.18em] text-[color:var(--color-text-mute)]">
            CASE STUDY
          </span>
        </div>
        <AnchorCopyButton sectionId="case-study" />
      </div>

      {/* Section headline — display font, clamp(38px,5vw,64px), weight 400, --color-primary */}
      <h2 className="mt-3 mb-8 font-display text-[clamp(38px,5vw,64px)] font-normal leading-[1.05] tracking-[-0.015em] text-[color:var(--color-primary)]">
        {headline ?? 'Untitled Section'}
      </h2>

      {/* Structured metadata block (DES-05) — footnote-style sidebar
          rendered ONLY when subjectName is populated. --color-accent left border
          and tabular-nums per metadata-block utility. */}
      {subjectName != null && (
        <dl className="metadata-block" aria-label="Case study metadata">
          <dt>Subject</dt>
          <dd>{subjectName}</dd>
        </dl>
      )}

      {/* Body prose */}
      <PortableTextRenderer value={body} />

      <div className="mt-10" aria-hidden="true" />
    </section>
  )
}
