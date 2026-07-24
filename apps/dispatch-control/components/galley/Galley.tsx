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
 *
 * Phase 41 (WSP-07, Plan 41-08 Task 2) — a long-read (or specAd bonus)
 * section whose `blocks` array is empty/absent renders a first-class
 * "Not generated" Editor's-note block INSIDE its `galley-{id}` anchor (so
 * the outline jump still lands somewhere) instead of a blank section. The
 * presence check — `(section?.blocks ?? []).length === 0` — is
 * BYTE-IDENTICAL to `draftSectionIdsFromDraft` (lib/derivedState.ts, Plan
 * 41-01), the shared source the workspace outline reads. Keep the two in
 * lockstep: if this predicate ever changes, change it there too.
 *
 * Phase 44 (INS-01, Plan 44-07 Task 1): an optional `onInspect?` prop is
 * forwarded, unmodified, into every `GallerySection` this Galley mounts —
 * the draft passage + voice finding entry points into the shared "Inspect
 * how this was made" panel. Undefined leaves today's render unaffected.
 *
 * Phase 45 (REV-01, D-18, Plan 45-05 Task 1): mounts ONE shared
 * `PassageToolbar` inside `galley-root` — since Draft (`ReviewDeskRunView`)
 * and Voice (`VoicePassRunView`) both mount this SAME `Galley` component,
 * wiring the toolbar here covers both surfaces for free (D-18's "one
 * component, every surface"). New optional `onRevise?`/`onRelatedFacts?`
 * props mirror `onInspect`'s skip-when-undefined convention exactly;
 * `onEditText` is NOT a new prop — the toolbar's "Edit text" action reuses
 * the EXISTING (required) `onEditSection` prop below, and "Inspect how this
 * was made" reuses the EXISTING `onInspect` prop, so no caller needs to
 * change how it wires those two actions.
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
import { PassageToolbar, type PassageSelection, type RevisionPassageFromSelection } from './PassageToolbar'

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
  /**
   * Phase 42 (FCT-04, Plan 42-07) — threaded through resolveClaimsFor so the
   * Draft galley's ClaimMark popover can feed the shared ClaimProvenanceCard
   * real fields instead of blank ones.
   */
  importance?: 'Load-bearing' | 'Supporting' | 'Incidental'
  context?: string
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
  /**
   * Phase 44 (INS-01) — opens the shared "Inspect how this was made" panel
   * on this section's founder artifact. Optional; forwarded unmodified to
   * every `GallerySection`. Undefined leaves today's render unaffected.
   */
  onInspect?: (sectionId: string) => void
  /**
   * Phase 45 (REV-01, D-18) — opens the shared "Ask agent to revise" flow
   * (`RevisionFlow`, 45-04) scoped to the passage the operator selected in
   * this galley. Optional; forwarded ONLY into the mounted `PassageToolbar`
   * (never into GallerySection/AnnotationMark — the toolbar reads
   * selections at the containerRef level, not per-block). Undefined leaves
   * the toolbar's "Ask agent to revise" button a no-op (still enabled per
   * the toolbar's own convention, never a false-disabled control).
   */
  onRevise?: (passage: RevisionPassageFromSelection) => void
  /**
   * Phase 45 (REV-01, D-16) — surfaces the shared `ClaimProvenanceCard` for
   * a tracked claim intersecting the selected passage. Optional; forwarded
   * ONLY into the mounted `PassageToolbar`, mirroring `onRevise` above.
   */
  onRelatedFacts?: (sel: PassageSelection) => void
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
  /**
   * Phase 41 (WSP-04, Plan 41-03) — optional click-through for an unchecked
   * claim, forwarded unmodified to every GallerySection this Galley mounts.
   * Undefined (Review Desk/Voice Pass default) leaves today's
   * toggle-popover-only behavior intact; Draft (Stage 2, Plan 41-08) wires
   * it to route into the Fact Check tab (D-12).
   */
  onUnsourcedClaimClick?: (claimIndex: number) => void
  /**
   * Quick 260724-i5n (LD-4) — an optional section-id whitelist. When
   * provided, ONLY the sections whose id is a member render (every render
   * branch below is additionally gated on membership); `undefined` renders
   * everything, exactly as before (back-compat — Voice Pass and any other
   * full-galley mount are unaffected). This is what lets the Story Desk's
   * per-story Draft tab reuse this SAME Galley for a single section instead
   * of forking the annotation/claim rendering.
   */
  sections?: ReadonlyArray<string>
}

// D-05 reader order for the four long-read sections.
const LONG_READ_SECTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'originStory', label: 'Origin Story' },
  { id: 'problemStatement', label: 'The Problem' },
  { id: 'founderBio', label: 'Founder Bio' },
  { id: 'caseStudy', label: 'Case Study' },
]

/**
 * WSP-07 "Not generated" Editor's-note — styled per `_PlaceholderScreen`
 * conventions (1c ink-soft italic body text, no literal Tailwind gray).
 * Rendered INSIDE the section's own `galley-{id}` anchor so the outline
 * jump still lands on the section even before it has content.
 */
function NotGeneratedBlock({ label }: { label: string }) {
  return (
    <p className="galley-body italic text-[color:var(--color-ink-soft)]">
      — Not generated. The {label} will appear here once the agents write it.
    </p>
  )
}

export default function Galley({
  runId,
  draft,
  revisionId,
  reloadDraft,
  onEditSection,
  onInspect,
  onRevise,
  onRelatedFacts,
  showProvenance = true,
  includeAxes,
  labels,
  onUnsourcedClaimClick,
  sections,
}: GalleyProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Quick 260724-i5n (LD-4) — `undefined` sections = render everything
  // (back-compat); otherwise membership-only.
  const included = (id: string): boolean => sections === undefined || sections.includes(id)

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
        // Phase 42 (FCT-04) — thread the fields the shared ClaimProvenanceCard
        // needs (text/importance/context) exactly like the provenance fields
        // above were threaded in Phase 35.
        text: row?.text ?? '',
        importance: row?.importance,
        context: row?.context,
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
      {/* Phase 45 (REV-01, D-18) — ONE shared selection toolbar for the
          whole galley; renders nothing without an active in-container
          selection. "Edit text" reuses onEditSection, "Inspect how this
          was made" reuses onInspect — neither is a new prop. */}
      <PassageToolbar
        containerRef={containerRef}
        onRevise={onRevise}
        onEditText={(sel) => onEditSection(sel.sectionId)}
        onRelatedFacts={onRelatedFacts}
        onInspect={onInspect}
      />

      {LONG_READ_SECTIONS.filter(({ id }) => included(id)).map(({ id, label }) => {
        const section = draft.sections[id]
        const rows = section?.blocks ?? []
        // WSP-07 lockstep check — byte-identical to draftSectionIdsFromDraft's
        // long-read predicate (lib/derivedState.ts, Plan 41-01).
        if (rows.length === 0) {
          return (
            <section key={id} id={`galley-${id}`} className="galley-section">
              <h2 className="galley-headline">{section?.headline ?? label}</h2>
              <NotGeneratedBlock label={label} />
            </section>
          )
        }
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
            onInspect={onInspect}
            labels={labels}
            onUnsourcedClaimClick={onUnsourcedClaimClick}
          />
        )
      })}

      {included('game') && <GalleryGameSlot game={draft.game ?? {}} />}

      {included('bonus') && draft.bonusType === 'specAd' && bonusRows.length === 0 && (
        <section id="galley-bonus" className="galley-section">
          <h2 className="galley-headline">{draft.bonus?.headline ?? 'Bonus'}</h2>
          <NotGeneratedBlock label="Bonus" />
        </section>
      )}

      {included('bonus') && draft.bonusType === 'specAd' && bonusRows.length > 0 && bonusResolution && (
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
          onInspect={onInspect}
          labels={labels}
          onUnsourcedClaimClick={onUnsourcedClaimClick}
        />
      )}

      {included('bonus') && draft.bonusType === 'bigBudget' && (
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

      {included('bonus') && draft.bonusType === 'jingle' && (
        <section id="galley-bonus" className="galley-section">
          {draft.bonus?.headline && <h2 className="galley-headline">{draft.bonus.headline}</h2>}
          <p className="galley-body" style={{ whiteSpace: 'pre-wrap' }}>
            {draft.bonus?.lyrics}
          </p>
        </section>
      )}

      {included('podcast') && (
        <section id="galley-podcast" className="galley-section">
          <h2 className="galley-h2">Podcast</h2>
          {draft.podcast?.audioUrl ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio controls src={draft.podcast.audioUrl} />
          ) : (
            <p className="galley-body">{draft.podcast?.transcript}</p>
          )}
        </section>
      )}

      {included('deliberation-conversation') && (
        <section id="galley-deliberation" className="galley-section">
          <h2 className="galley-h2">Deliberation</h2>
          {(draft.conversation ?? []).map((turn, i) => (
            <p key={i} className="galley-body">
              {turn.speaker}: {turn.text}
            </p>
          ))}
        </section>
      )}
    </div>
  )
}
