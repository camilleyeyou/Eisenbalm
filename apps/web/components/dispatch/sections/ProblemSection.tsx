import type { PortableTextBlock } from '@portabletext/react'
import { NumberedSection } from '../NumberedSection'
import { PortableTextRenderer } from '@/components/issue/PortableTextRenderer'
import { sectionMeta } from '@/lib/dispatch/copy'
import type { StatTile } from '@/lib/dispatch/derive'
import '../sections.css'

export function ProblemSection({
  headline,
  body,
  tiles,
  pdfUrl,
}: {
  headline: string | null | undefined
  body: PortableTextBlock[] | null | undefined
  tiles: StatTile[]
  pdfUrl: string | null
}) {
  const m = sectionMeta('problem')
  return (
    <NumberedSection id="problem" number={m.number} label={m.label} title={headline}>
      {tiles.length > 0 && (
        <div className="d-stats">
          {tiles.map((t, i) => (
            <div key={i} className="d-stat">
              {t.figure ? (
                <>
                  <p className="d-heading d-stat-figure">{t.figure}</p>
                  <p className="d-body d-stat-caption">{t.caption}</p>
                </>
              ) : (
                <p className="d-body d-stat-caption d-stat-caption--solo">{t.caption}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {body && body.length > 0 ? <PortableTextRenderer value={body} className="d-prose" /> : null}
      {pdfUrl && (
        <a
          href={pdfUrl}
          className="d-pill d-pill--paper d-pill--compact d-problem-pdf"
          aria-label="Download the Problem Statement Deck as PDF"
        >
          ↓ Download the Problem Statement Deck (PDF)
        </a>
      )}
    </NumberedSection>
  )
}
