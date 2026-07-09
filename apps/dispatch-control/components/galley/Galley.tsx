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
 * StructuredFieldEditor / BlockEditor surfaces. (ClaimMark, rendered inside
 * GallerySection, DOES call claimChecks:setStatus directly — that is a
 * deliberate Convex-only exception, EDT-05 exempt per Pitfall 9 — but this
 * file itself never mutates anything.)
 *
 * Phase 35 (PRV-03, Plan 35-05): subscribes to `claim_checks` and resolves
 * each row into a per-section `ResolvedClaim[]` using the SAME
 * `resolveSectionFindings` the QA annotations already use (never a new
 * fuzzy matcher) — the publisher writes `sectionName` directly in the
 * galley section-id vocabulary (originStory/problemStatement/founderBio/
 * caseStudy/bonus), so no `qaSectionToGalleyId` bridge is needed here. A
 * `showProvenance` prop (default ON, D-10) controls whether the resolved
 * claims are passed through to `GallerySection` at all.
 *
 * Phase 36 (§36.3, Plan 36-04 Task 2): an optional `includeAxes` prop lets
 * ONE Galley instance serve two axis-partitioned surfaces — Review Desk
 * (FACTUAL_AXES) and Voice Pass (VOICE_AXES) — with no duplicated render
 * stack. Omitted = no filter (both axis groups render, back-compat). Set =
 * only findings whose `axis` is BOTH present AND a member of the whitelist
 * render; an axis-less row is omitted from any axis-scoped surface (see
 * `lib/galley/axisPartition.ts`).
 *
 * Phase 36 (VOX-02, D-10, Plan 36-06): an optional `labels` prop is
 * forwarded, unmodified, into every `GallerySection`/`AnnotationMark` this
 * Galley mounts — the voice-tell label variant. Undefined (Review Desk's
 * default) leaves today's Accept fix / Edit inline / Dismiss labels intact.
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
import type { ResolvedClaim } from '@/lib/galley/syntheticPortableText'
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

/** Minimal shape needed from a live `claim_checks` row (Phase 35 PRV-03). */
interface ClaimCheckRow {
  claimIndex: number
  text: string
  status: string
  claimId?: string
  sourceUrl?: string
  retrievedAt?: number
  sectionName?: string
  blockIndexHint?: number
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
  /** Phase 35 (PRV-03, D-10) — provenance wash layer, default ON. */
  showProvenance?: boolean
  /**
   * Phase 36 (§36.3, Task 2) — axis whitelist. Undefined = render every open
   * finding regardless of axis (back-compat). Set = only findings whose axis
   * is present AND in this set render.
   */
  includeAxes?: ReadonlySet<string>
  /**
   * Phase 36 (VOX-02, D-10, Plan 36-06) — AnnotationMark voice-tell label
   * variant, forwarded unmodified to every GallerySection this Galley mounts.
   */
  labels?: {
    accept?: string
    editInline?: string
    dismiss?: string
    dismissReasonDefault?: string
  }
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
  showProvenance = true,
  includeAxes,
  labels,
}: GalleyProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Live findings — undefined while loading (default to []); resolved
  // (accepted/dismissed) findings are excluded via the ONE shared
  // isOpenFinding predicate (D-08 open findings only, Pitfall 9).
  const rawFindings =
    (useQuery(api.qaCorrections.byRunId, { runId }) as QaCorrectionRow[] | undefined) ?? []
  const openFindings = rawFindings.filter(isOpenFinding)

  // Phase 36 (§36.3, Task 2) — axis-scope the open findings when an
  // includeAxes whitelist is passed; undefined = no filter (both Review
  // Desk's FACTUAL_AXES and Voice Pass's VOICE_AXES reuse this ONE Galley).
  const scopedFindings = includeAxes
    ? openFindings.filter(row => row.axis !== undefined && includeAxes.has(row.axis))
    : openFindings

  // Group scoped findings by galley section id (QA's sectionName vocabulary
  // differs from the galley's — qaSectionToGalleyId is the only bridge).
  const findingsByGalleyId = new Map<string, QaFinding[]>()
  for (const row of scopedFindings) {
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

  // Phase 35 (PRV-03) — live claim_checks rows, undefined while loading.
  // The publisher writes `sectionName` directly in the galley id vocabulary
  // (originStory/problemStatement/founderBio/caseStudy/bonus) — no mapping
  // bridge needed, unlike qaCorrections above. A row missing sectionName
  // (legacy/unresolvable) is simply never grouped into any section — it
  // renders no wash anywhere, never a crash.
  const claimRows =
    (useQuery(api.claimChecks.listByRunId, { runId }) as ClaimCheckRow[] | undefined) ?? []
  const claimsBySection = new Map<string, ClaimCheckRow[]>()
  for (const row of claimRows) {
    if (!row.sectionName) continue
    const list = claimsBySection.get(row.sectionName) ?? []
    list.push(row)
    claimsBySection.set(row.sectionName, list)
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

  // Phase 35 (PRV-03) — reuses the SAME resolver as resolveFor above (never
  // a new fuzzy matcher): claim_checks rows are mapped into the QaFinding
  // shape (quotedSpan=row.text, blockIndexHint=row.blockIndexHint), resolved
  // per-block, then re-hydrated with each claim's provenance fields.
  function resolveClaimsFor(
    sectionId: string,
    rows: Array<{ type: string; text: string }>,
  ): ResolvedClaim[] {
    if (!showProvenance) return []
    const rowsForSection = claimsBySection.get(sectionId) ?? []
    if (rowsForSection.length === 0) return []
    const claimFindings: QaFinding[] = rowsForSection.map((row) => ({
      _id: String(row.claimIndex),
      severity: 'info',
      reason: '',
      quotedSpan: row.text,
      blockIndexHint: row.blockIndexHint,
    }))
    const { resolved } = resolveSectionFindings(rows, claimFindings, sectionId)
    return resolved.map((r) => {
      const row = rowsForSection.find((cr) => String(cr.claimIndex) === r.findingId)
      return {
        claimIndex: row ? row.claimIndex : Number(r.findingId),
        sectionId,
        blockIndex: r.blockIndex,
        start: r.start,
        end: r.end,
        provenance: row?.claimId ? 'sourced' : 'unsourced',
        sourceUrl: row?.sourceUrl,
        retrievedAt: row?.retrievedAt,
        status: row?.status ?? 'pending',
      }
    })
  }

  const bonusRows: Array<{ type: string; text: string }> = Array.isArray(draft.bonus?.body)
    ? draft.bonus.body
    : []
  const bonusResolution = draft.bonusType === 'specAd' ? resolveFor('bonus', bonusRows) : null
  const bonusClaimResolved = draft.bonusType === 'specAd' ? resolveClaimsFor('bonus', bonusRows) : []

  return (
    <div ref={containerRef} className="galley-root">
      {LONG_READ_SECTIONS.map(({ id }) => {
        const section = draft.sections[id]
        const rows = section?.blocks ?? []
        const { resolved, unresolved } = resolveFor(id, rows)
        const claimResolved = resolveClaimsFor(id, rows)
        return (
          <GallerySection
            key={id}
            sectionId={id}
            headline={section?.headline}
            rows={rows}
            resolved={resolved}
            unresolved={unresolved}
            claimResolved={claimResolved}
            showProvenance={showProvenance}
            runId={runId}
            revisionId={revisionId}
            reloadDraft={reloadDraft}
            onEditSection={onEditSection}
            labels={labels}
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
          claimResolved={bonusClaimResolved}
          showProvenance={showProvenance}
          runId={runId}
          revisionId={revisionId}
          reloadDraft={reloadDraft}
          onEditSection={onEditSection}
          labels={labels}
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
