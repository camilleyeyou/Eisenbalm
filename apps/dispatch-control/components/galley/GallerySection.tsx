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
 * Phase 33 (EDT-04, Plan 33-04): threads the action context — `runId`,
 * `revisionId`, `reloadDraft`, `onEditSection` — down into each
 * `AnnotationMark` (via a per-render `components` object that closes over
 * the props) and each `UnresolvedFindingCard`, so the popover's
 * Accept/Edit/Dismiss row and the card's Dismiss/Edit-inline actions can
 * call the pipeline findings endpoints.
 *
 * Wrapped in `<section id="galley-{sectionId}">` so the chip jump-nav
 * (Plan 32-07) can `scrollIntoView` directly.
 *
 * Phase 35 (PRV-03, Plan 35-05): threads `claimResolved` + `showProvenance`
 * into `toSyntheticBlocks` so a span can additionally carry a `claimSpan`
 * mark (rendered by `ClaimMark`), stacked alongside `annotation` marks —
 * the marigold/rust provenance wash. When `showProvenance` is false, `[]`
 * is passed instead so no wash renders (annotations are unaffected).
 */
import { useMemo } from 'react'
import { PortableText, type PortableTextReactComponents } from '@portabletext/react'
import {
  toSyntheticBlocks,
  type ClaimSpanMarkDef,
  type ResolvedClaim,
} from '@/lib/galley/syntheticPortableText'
import type { ResolvedAnnotation, UnresolvedFinding } from '@/lib/galley/spanResolver'
import AnnotationMark from './AnnotationMark'
import ClaimMark from './ClaimMark'
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
  // Phase 33 action context — threaded into AnnotationMark + UnresolvedFindingCard.
  runId: string
  revisionId: string
  reloadDraft: () => Promise<void> | void
  onEditSection: (sectionId: string, findingId?: string) => void
  // Phase 35 (PRV-03) — provenance wash resolution + visibility toggle.
  claimResolved?: ResolvedClaim[]
  showProvenance?: boolean
}

export default function GallerySection({
  sectionId,
  headline,
  deck,
  rows,
  resolved,
  unresolved,
  runId,
  revisionId,
  reloadDraft,
  onEditSection,
  claimResolved = [],
  showProvenance = true,
}: GallerySectionProps) {
  // toSyntheticBlocks groups `resolved`/`claimResolved` by blockIndex
  // internally (it filters the flat lists per-row), so the flat arrays are
  // passed directly. showProvenance=false passes [] so no wash renders.
  const syntheticBlocks = toSyntheticBlocks(
    rows,
    resolved,
    sectionId,
    showProvenance ? claimResolved : [],
  )

  // Built per-render (memoized on the action context) because
  // marks.annotation must close over runId/revisionId/reloadDraft/
  // onEditSection to hand them to each AnnotationMark.
  const components = useMemo<Partial<PortableTextReactComponents>>(
    () => ({
      block: {
        normal: ({ children }) => <p className="galley-body">{children}</p>,
        h2: ({ children }) => <h2 className="galley-h2">{children}</h2>,
        h3: ({ children }) => <h3 className="galley-h2">{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="galley-pullquote">{children}</blockquote>
        ),
      },
      marks: {
        annotation: ({ value, children }) => (
          <AnnotationMark
            value={value}
            runId={runId}
            sectionId={sectionId}
            revisionId={revisionId}
            reloadDraft={reloadDraft}
            onEditSection={onEditSection}
          >
            {children}
          </AnnotationMark>
        ),
        claimSpan: ({ value, children }) => (
          <ClaimMark value={value as ClaimSpanMarkDef} runId={runId}>
            {children}
          </ClaimMark>
        ),
      },
    }),
    [runId, sectionId, revisionId, reloadDraft, onEditSection],
  )

  return (
    <section id={`galley-${sectionId}`} className="galley-section">
      {headline && <h2 className="galley-headline">{headline}</h2>}
      {deck && <p className="galley-deck">{deck}</p>}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <PortableText value={syntheticBlocks as any} components={components} />

      {unresolved.map((finding) => (
        <UnresolvedFindingCard
          key={finding.findingId}
          finding={finding}
          runId={runId}
          sectionId={sectionId}
          onEditSection={onEditSection}
        />
      ))}
    </section>
  )
}
