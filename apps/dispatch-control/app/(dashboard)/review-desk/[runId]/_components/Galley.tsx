'use client'
/**
 * Phase 32 (GLY-01) — the native galley.
 *
 * Orchestrates the D-05 reader-order render (originStory, problemStatement,
 * founderBio, caseStudy, game, bonus, podcast, deliberation-conversation)
 * from the draft-read data, overlaying live open QA findings (Convex
 * `qaCorrections.byRunId`, `accepted` findings excluded per D-08) resolved
 * per-section via the Plan 32-03 span resolver, with theme fonts/accent
 * applied via the Plan 32-04 whitelist-validated loader. The game renders in
 * a sandboxed iframe via `GalleryGameSlot`.
 *
 * READ-ONLY: no Convex mutation, no Sanity write anywhere in this file — the
 * galley is a render surface only. Editing lives in the Plan 31
 * StructuredFieldEditor / BlockEditor surfaces.
 */
import { useEffect, useRef } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import type { DraftResponse } from '@/lib/contentPatchClient'
import {
  resolveSectionFindings,
  type QaFinding,
  type ResolvedAnnotation,
  type UnresolvedFinding,
} from '@/lib/galley/spanResolver'
import { isOpenFinding } from '@/lib/galley/findingState'
import { qaSectionToGalleyId } from '@/lib/galley/sectionIdMap'
import { ensureThemeFont, applyThemeAccent } from '@/lib/galley/googleFontLoader'
import GallerySection from './GallerySection'
import GalleryGameSlot from './GalleryGameSlot'

/** Minimal shape needed from a live `qaCorrections` row. */
interface QaCorrectionRow {
  _id: string
  sectionName: string
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  suggestedFix?: string
  quotedSpan?: string
  blockIndexHint?: number
  accepted?: boolean
  /** §33.1 resolution state — filtered via the shared isOpenFinding (Pitfall 9). */
  resolution?: 'accepted' | 'dismissed'
}

interface GalleyProps {
  runId: string
  draft: DraftResponse
  /** Current draft revision — the popover's Accept needs it as ifRevisionID. */
  revisionId: string
  /** Refetches the draft so re-resolution runs against fresh text (EDT-06). */
  reloadDraft: () => Promise<void> | void
  /** D-08 edit-inline deep-link into the section editor. */
  onEditSection: (sectionId: string, findingId?: string) => void
}

// D-05 reader order for the four long-read sections.
const LONG_READ_SECTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'originStory', label: 'Origin Story' },
  { id: 'problemStatement', label: 'The Problem' },
  { id: 'founderBio', label: 'Founder Bio' },
  { id: 'caseStudy', label: 'Case Study' },
]

export default function Galley({
  runId,
  draft,
  revisionId,
  reloadDraft,
  onEditSection,
}: GalleyProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Live findings — undefined while loading (default to []); resolved
  // (accepted/dismissed) findings are excluded via the ONE shared
  // isOpenFinding predicate (D-08 open findings only, Pitfall 9).
  const rawFindings =
    (useQuery(api.qaCorrections.byRunId, { runId }) as QaCorrectionRow[] | undefined) ?? []
  const openFindings = rawFindings.filter(isOpenFinding)

  // Group open findings by galley section id (QA's sectionName vocabulary
  // differs from the galley's — qaSectionToGalleyId is the only bridge).
  const findingsByGalleyId = new Map<string, QaFinding[]>()
  for (const row of openFindings) {
    const galleyId = qaSectionToGalleyId(row.sectionName)
    if (!galleyId) continue
    const list = findingsByGalleyId.get(galleyId) ?? []
    list.push({
      _id: row._id,
      severity: row.severity,
      axis: row.axis,
      reason: row.reason,
      suggestedFix: row.suggestedFix,
      quotedSpan: row.quotedSpan,
      blockIndexHint: row.blockIndexHint,
      accepted: row.accepted,
      resolution: row.resolution,
    })
    findingsByGalleyId.set(galleyId, list)
  }

  // D-04 theme fonts + accent — validated inside the helpers; a bad value is
  // a no-op.
  useEffect(() => {
    ensureThemeFont(draft.theme?.fontDisplay)
    ensureThemeFont(draft.theme?.fontBody)
    if (containerRef.current) {
      applyThemeAccent(draft.theme?.accentColor, containerRef.current)
    }
  }, [draft.theme?.fontDisplay, draft.theme?.fontBody, draft.theme?.accentColor])

  function resolveFor(
    sectionId: string,
    rows: Array<{ type: string; text: string }>,
  ): { resolved: ResolvedAnnotation[]; unresolved: UnresolvedFinding[] } {
    return resolveSectionFindings(rows, findingsByGalleyId.get(sectionId) ?? [], sectionId)
  }

  const bonusRows: Array<{ type: string; text: string }> = Array.isArray(draft.bonus?.body)
    ? draft.bonus.body
    : []
  const bonusResolution = draft.bonusType === 'specAd' ? resolveFor('bonus', bonusRows) : null

  return (
    <div ref={containerRef} className="galley-root">
      {LONG_READ_SECTIONS.map(({ id }) => {
        const section = draft.sections[id]
        const rows = section?.blocks ?? []
        const { resolved, unresolved } = resolveFor(id, rows)
        return (
          <GallerySection
            key={id}
            sectionId={id}
            headline={section?.headline}
            rows={rows}
            resolved={resolved}
            unresolved={unresolved}
            runId={runId}
            revisionId={revisionId}
            reloadDraft={reloadDraft}
            onEditSection={onEditSection}
          />
        )
      })}

      <GalleryGameSlot game={draft.game ?? {}} />

      {draft.bonusType === 'specAd' && bonusResolution && (
        <GallerySection
          sectionId="bonus"
          headline={draft.bonus?.headline}
          rows={bonusRows}
          resolved={bonusResolution.resolved}
          unresolved={bonusResolution.unresolved}
          runId={runId}
          revisionId={revisionId}
          reloadDraft={reloadDraft}
          onEditSection={onEditSection}
        />
      )}

      {draft.bonusType === 'bigBudget' && (
        <section id="galley-bonus" className="galley-section">
          {draft.bonus?.headline && <h2 className="galley-headline">{draft.bonus.headline}</h2>}
          {(draft.bonus?.storyboards ?? []).map(
            (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              storyboard: any,
              i: number,
            ) => (
              <img
                key={i}
                src={storyboard?.asset?.url}
                alt={storyboard?.caption ?? `Storyboard ${i + 1}`}
                className="galley-storyboard"
              />
            ),
          )}
        </section>
      )}

      {draft.bonusType === 'jingle' && (
        <section id="galley-bonus" className="galley-section">
          {draft.bonus?.headline && <h2 className="galley-headline">{draft.bonus.headline}</h2>}
          <p className="galley-body" style={{ whiteSpace: 'pre-wrap' }}>
            {draft.bonus?.lyrics}
          </p>
        </section>
      )}

      <section id="galley-podcast" className="galley-section">
        <h2 className="galley-h2">Podcast</h2>
        {draft.podcast?.audioUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio controls src={draft.podcast.audioUrl} />
        ) : (
          <p className="galley-body">{draft.podcast?.transcript}</p>
        )}
      </section>

      <section id="galley-deliberation" className="galley-section">
        <h2 className="galley-h2">Deliberation</h2>
        {(draft.conversation ?? []).map((turn, i) => (
          <p key={i} className="galley-body">
            {turn.speaker}: {turn.text}
          </p>
        ))}
      </section>
    </div>
  )
}
