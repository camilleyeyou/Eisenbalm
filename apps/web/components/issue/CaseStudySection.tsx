/**
 * CaseStudySection — restyled for Phase 19 Dispatch magazine layout.
 * UI-SPEC §Section 7 Article Sections (Case Study variant).
 *
 * PRESERVED:
 *   - id="case" — canonical anchor for SectionRail (changed from "case-study")
 *   - All prop names (subjectName, headline, body) unchanged (Stage B compat)
 *   - No <main>. This is a <section>.
 *
 * Phase 19 changes:
 *   - id changes from "case-study" to "case" (SectionRail tracks #case)
 *   - Subject card: surface bg + line border, label 9px muted, value Fraunces 18px
 *   - Drop cap via .body.lead (DES-02 — all 4 editorial sections get lead)
 *   - .sec-label with §-prefix eyebrow
 *   - .metadata-block class preserved for backward-compat tripwires
 */
import type { PortableTextBlock } from '@portabletext/react'
import { PortableTextRenderer } from './PortableTextRenderer'
import { ScrollReveal } from './ScrollReveal'
import { AnchorCopyButton } from '@/components/AnchorCopyButton'

interface CaseStudySectionProps {
  subjectName?: string | null
  headline?: string | null
  body?: PortableTextBlock[] | null
}

export function CaseStudySection({ subjectName, headline, body }: CaseStudySectionProps) {
  return (
    <div className="article-wrap">
      <ScrollReveal>
        <section id="case" className="sec">
          {/* Section label (eyebrow) */}
          <div className="sec-label">
            CASE STUDY
            <AnchorCopyButton sectionId="case" />
          </div>

          {/* h2 — Fraunces clamp(30px,4vw,46px) weight 400 */}
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(30px,4vw,46px)',
              fontWeight: 400,
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
              marginBottom: '30px',
            }}
          >
            {headline ?? 'Untitled Section'}
          </h2>

          {/* Subject card — surface bg, line border, label + value (DES-05) */}
          {subjectName != null && (
            <div
              className="metadata-block"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-line)',
                padding: '14px 18px',
                marginBottom: '28px',
                display: 'flex',
                alignItems: 'baseline',
                gap: '14px',
                // Override metadata-block left-border from globals.css
                borderLeft: '1px solid var(--color-line)',
              }}
              aria-label="Case study subject"
            >
              <span
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  color: 'var(--color-text-mute)',
                }}
              >
                Subject
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '18px',
                  color: 'var(--color-text)',
                }}
              >
                {subjectName}
              </span>
            </div>
          )}

          {/* Body prose — .body.lead applies drop cap */}
          <PortableTextRenderer value={body} className="body lead" />
        </section>
      </ScrollReveal>
    </div>
  )
}
