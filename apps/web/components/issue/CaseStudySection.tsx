/**
 * Case study section. UI-SPEC §3.
 * Container: editorial (680px). Anchor ID: #case-study.
 *
 * Extends EditorialSection with an optional "Subject: {subjectName}" line
 * above the headline. If subjectName is null, renders the headline alone.
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
    <section
      id="case-study"
      className="mx-auto w-full max-w-[680px] px-4 sm:px-6 lg:px-8"
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
          CASE STUDY
        </span>
        <AnchorCopyButton sectionId="case-study" />
      </div>

      {/* Optional subject label — "Subject: {subjectName}" */}
      {subjectName != null && (
        <p className="mb-2 font-ui text-[14px] leading-[1.5] text-[color:var(--color-text)] opacity-60">
          Subject: {subjectName}
        </p>
      )}

      {/* Headline */}
      <h2 className="mb-6 font-display text-[28px] font-semibold leading-[1.15] text-[color:var(--color-primary)] sm:text-[36px]">
        {headline ?? 'Untitled Section'}
      </h2>

      {/* Body prose */}
      <PortableTextRenderer value={body} />

      <div className="mt-8" aria-hidden="true" />
    </section>
  )
}
