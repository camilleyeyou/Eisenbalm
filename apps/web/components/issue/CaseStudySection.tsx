/**
 * Case study section. UI-SPEC §3.
 * Anchor ID: #case-study.
 *
 * Phase 10: structured metadata (subject) renders in a .metadata-block dl panel —
 * footnote-style sidebar visually distinct from running prose. DES-05.
 *
 * Extends the editorial-section pattern with a .metadata-block <dl> panel
 * (Subject → subjectName) rendered between the headline and the body. The
 * panel uses --color-accent for its left border and tabular-nums for any
 * numeric data. When the Sanity schema grows additional fields (e.g.
 * founded, AUM, focus area), they slot into the dl trivially.
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

      {/* Label row */}
      <div className="mb-4 flex items-center gap-2">
        <span className="eyebrow">CASE STUDY</span>
        <AnchorCopyButton sectionId="case-study" />
      </div>

      {/* Headline */}
      <h2 className="mt-3 mb-6 font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.005em] text-[color:var(--color-primary)] sm:text-[44px]">
        {headline ?? 'Untitled Section'}
      </h2>

      {/* Structured metadata block (DES-05) — footnote-style sidebar
          rendered ONLY when subjectName is populated. Additional structured
          fields (founded, AUM, focus area) can be appended to this dl as the
          Sanity schema grows. */}
      {subjectName != null && (
        <dl className="metadata-block" aria-label="Case study metadata">
          <dt>Subject</dt>
          <dd>{subjectName}</dd>
        </dl>
      )}

      {/* Body prose */}
      <PortableTextRenderer value={body} />

      <div className="mt-8" aria-hidden="true" />
    </section>
  )
}
