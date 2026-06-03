/**
 * EditorialSection — restyled for Phase 19 Dispatch magazine layout.
 * UI-SPEC §Section 7 Article Sections.
 *
 * PRESERVED:
 *   - id prop sets <section id> — canonical set for SectionRail
 *   - lead prop opts into .body.lead for drop-cap via globals.css
 *   - No <main>. This is a <section>.
 *   - All prop names (id, label, headline, body, lead) unchanged (Stage B compat)
 *
 * Section label (eyebrow): IBM Plex Mono 11px uppercase, §-prefix via CSS ::before.
 * NAMED PROTOTYPE EXCEPTION: .sec-label has margin-bottom 22px (from globals.css).
 * h2: Fraunces clamp(30px,4vw,46px) weight 400, em child italic accent.
 * Body: PortableTextRenderer with .body class (19.5px Newsreader weight 300, color prose).
 * Drop cap: .body.lead applies via globals.css .body.lead > p:first-of-type::first-letter.
 * Pull-quote: .pq class applied by PortableTextRenderer blockquote output (globals.css).
 *
 * Phase 19 replaces: ornament-divider, old eyebrow/drop-cap classes, old .prose-measure.
 */
import type { PortableTextBlock } from '@portabletext/react'
import { PortableTextRenderer } from './PortableTextRenderer'
import { ScrollReveal } from './ScrollReveal'
import { AnchorCopyButton } from '@/components/AnchorCopyButton'

interface EditorialSectionProps {
  /** Section anchor ID (no '#' prefix). Must match SectionRail tracked ids. */
  id: string
  /** Uppercase section label text, e.g., "ORIGIN STORY". */
  label: string
  /** Section headline. Renders "Untitled Section" fallback if absent. */
  headline?: string | null
  /** Portable Text body blocks. Blockquotes render as .pq pull-quotes. */
  body?: PortableTextBlock[] | null
  /** Additional className for the section element. */
  className?: string
  /** When true, applies .body.lead so the first paragraph gets a drop cap. */
  lead?: boolean
  /**
   * Optional PDF URL — when present, renders a "↓ Download the Problem
   * Statement Deck (PDF)" link-button below the body (UI-SPEC §7).
   * Min-height 44px for accessible touch target (WEB-09-adjacent).
   */
  pdfUrl?: string
}

export function EditorialSection({
  id,
  label,
  headline,
  body,
  className,
  lead = false,
  pdfUrl,
}: EditorialSectionProps) {
  return (
    <div className="article-wrap">
      <ScrollReveal>
        <section
          id={id}
          className={['sec', className ?? ''].join(' ').trim()}
        >
          {/* Section label (eyebrow) — .sec-label provides §-prefix via CSS ::before */}
          <div className="sec-label">
            {label}
            <AnchorCopyButton sectionId={id} />
          </div>

          {/* Section h2 — Fraunces clamp(30px,4vw,46px) weight 400, color var(--color-text) */}
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(30px,4vw,46px)',
              fontWeight: 400,
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
              marginBottom: '30px',
              color: 'var(--color-text)',
            }}
          >
            {headline ?? 'Untitled Section'}
          </h2>

          {/* Body prose — .body class for 19.5px Newsreader 300; .lead for drop cap */}
          <PortableTextRenderer
            value={body}
            className={lead ? 'body lead' : 'body'}
          />

          {/* PDF download button — UI-SPEC §7; rendered only when pdfUrl is set */}
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: '44px',
                marginTop: '28px',
                padding: '10px 20px',
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-accent)',
                border: '1px solid var(--color-accent)',
                textDecoration: 'none',
                borderRadius: '2px',
              }}
              aria-label="Download the Problem Statement Deck as PDF"
            >
              ↓&nbsp;&nbsp;Download the Problem Statement Deck (PDF)
            </a>
          )}
        </section>
      </ScrollReveal>
    </div>
  )
}
