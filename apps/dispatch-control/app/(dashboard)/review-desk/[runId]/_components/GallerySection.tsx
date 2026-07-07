'use client'
/**
 * Phase 32 (GLY-01, GLY-02) — one galley section's native render.
 *
 * Renders a section's headline/deck plus its body as synthetic
 * PortableText (Plan 32-04 `toSyntheticBlocks`) so `@portabletext/react`'s
 * native `marks.annotation` component API can render (and stack)
 * severity-colored inline spans (Plan 32-05 `AnnotationMark`). Findings that
 * failed to anchor onto the draft's blocks render as section-end
 * `UnresolvedFindingCard`s (D-09) so nothing is ever silently dropped.
 *
 * Wrapped in `<section id="galley-{sectionId}">` so the chip jump-nav
 * (Plan 32-07) can `scrollIntoView` directly.
 */
import { PortableText, type PortableTextReactComponents } from '@portabletext/react'
import { toSyntheticBlocks } from '@/lib/galley/syntheticPortableText'
import type { ResolvedAnnotation, UnresolvedFinding } from '@/lib/galley/spanResolver'
import AnnotationMark from './AnnotationMark'
import UnresolvedFindingCard from './UnresolvedFindingCard'

export interface GallerySectionContentBlock {
  type: string
  text: string
}

interface GallerySectionProps {
  sectionId: string
  headline?: string
  deck?: string
  rows: GallerySectionContentBlock[]
  resolved: ResolvedAnnotation[]
  unresolved: UnresolvedFinding[]
}

const components: Partial<PortableTextReactComponents> = {
  block: {
    normal: ({ children }) => <p className="galley-body">{children}</p>,
    h2: ({ children }) => <h2 className="galley-h2">{children}</h2>,
    h3: ({ children }) => <h3 className="galley-h2">{children}</h3>,
    blockquote: ({ children }) => <blockquote className="galley-pullquote">{children}</blockquote>,
  },
  marks: {
    annotation: ({ value, children }) => <AnnotationMark value={value}>{children}</AnnotationMark>,
  },
}

export default function GallerySection({
  sectionId,
  headline,
  deck,
  rows,
  resolved,
  unresolved,
}: GallerySectionProps) {
  // toSyntheticBlocks groups `resolved` by blockIndex internally (it filters
  // the flat annotation list per-row), so the flat array is passed directly.
  const syntheticBlocks = toSyntheticBlocks(rows, resolved, sectionId)

  return (
    <section id={`galley-${sectionId}`} className="galley-section">
      {headline && <h2 className="galley-headline">{headline}</h2>}
      {deck && <p className="galley-deck">{deck}</p>}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <PortableText value={syntheticBlocks as any} components={components} />

      {unresolved.map((finding) => (
        <UnresolvedFindingCard key={finding.findingId} finding={finding} />
      ))}
    </section>
  )
}
