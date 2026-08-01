'use client'
/**
 * Phase 51 (READ-01, READ-02, READ-03, READ-06, READ-07, READ-08) — the
 * section-reader page. This is the phase's whole point: an editor opens
 * `/s/[section]`, reads the current issue's section as full-width prose with
 * no side rails, no tabs, no form fields — and every kind of problem (fact,
 * voice, unsourced claim) is marked in the sentence it affects, in one read.
 *
 * Current-run resolution (D-02) is the ONE locked path — `useCurrentRun()`
 * (`runs.latest -> pipelineRuns.byRunId -> issueNumber`) — never a derived
 * "highest issue number" computation, never an `?issue=` override, never an
 * issue number in this path.
 *
 * Section-id validation (D-03): `params.section` IS the internal galley id,
 * verbatim — there is no slug<->id map and none may be introduced. An
 * unknown segment 404s via `notFound()` rather than guessing.
 *
 * Honest states (D-21): loading / not-generated / clean are three visibly
 * different renders. "Clean" never renders before BOTH the live QA findings
 * and the live claim rows have resolved — the not-generated block itself is
 * owned entirely by `Galley` (WSP-07), never re-worded here, so the two stay
 * byte-identical in lockstep.
 *
 * The single-section `Galley` mount below reuses the existing `sections`
 * whitelist prop (added for exactly this reuse, quick 260724-i5n) — never a
 * new single-section renderer — and deliberately omits an axis filter
 * (D-06): fact, voice and unsourced-claim problems all render together, in
 * one read.
 */
import { use, useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { notFound } from 'next/navigation'
import { api } from '@convex/_generated/api'
import { useCurrentRun } from '@/lib/useCurrentRun'
import { useInspector } from '@/components/inspector/InspectorProvider'
import { EDITABLE_SECTIONS } from '@/lib/editableSections'
import { deriveSectionStates, draftSectionIdsFromDraft } from '@/lib/derivedState'
import {
  getDraft,
  ContentPatchError,
  type ContentBlock,
  type DraftResponse,
} from '@/lib/contentPatchClient'
import { resolveSectionFindings, type QaFinding } from '@/lib/galley/spanResolver'
import { isOpenFinding } from '@/lib/galley/findingState'
import { qaSectionToGalleyId } from '@/lib/galley/sectionIdMap'
import { groupForFinding } from '@/lib/galley/findingGroups'
import { acceptFinding } from '@/lib/findingsClient'
import Galley from '@/components/galley/Galley'
import { RevisionFlow } from '@/components/revision/RevisionFlow'
import ClaimProvenanceCard from '@/components/provenance/ClaimProvenanceCard'
import type { PassageSelection, RevisionPassageFromSelection } from '@/components/galley/PassageToolbar'
import { SkeletonLine } from '@/components/ui/Skeleton'
import SectionHeader from './_components/SectionHeader'
import SectionEndNav from './_components/SectionEndNav'
import ExemptSectionNote, { type ExemptSectionKind } from './_components/ExemptSectionNote'
import InPlaceBlockEditor from './_components/InPlaceBlockEditor'

interface SectionParams {
  section: string
}

interface SectionReaderPageProps {
  /**
   * Real Next.js routing hands a Promise here; the Wave-0 test scaffold
   * (`__tests__/SectionReaderPage.test.tsx`) mounts this page directly with
   * a plain synchronous object. Both are legal — `isThenable` below decides
   * whether `use()` needs to unwrap it.
   */
  params: SectionParams | Promise<SectionParams>
}

/** Minimal shape needed from a live `claim_checks` row (mirrors Galley.tsx's
 * own internal `ClaimCheckRow` — this app duplicates "minimal shape needed
 * from a row" interfaces per-surface, not a shared cross-import). */
interface ClaimCheckRow {
  claimIndex: number
  text: string
  status: string
  claimId?: string
  sourceUrl?: string
  retrievedAt?: number
  sectionName?: string
  blockIndexHint?: number
  importance?: 'Load-bearing' | 'Supporting' | 'Incidental'
  context?: string
}

/** Minimal shape needed from a live `qaCorrections` row (mirrors Galley.tsx's
 * own internal `QaCorrectionRow` — same duplication convention as
 * `ClaimCheckRow` above). `derivationInputs.qaFindings`'s own declared type
 * (`lib/derivedState.ts`) is a narrower view that omits `quotedSpan`/
 * `blockIndexHint`; the live Convex rows carry them, so this widens the read
 * for the one call site (Task 1's block-index resolution, Task 3's
 * grouping) that needs them. */
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
  resolution?: 'accepted' | 'dismissed' | null
}

/** Phase 51 (READ-05) — the one in-place editor open at a time on this page. */
interface EditingTarget {
  sectionId: string
  findingId?: string
  blockIndex: number
  /** True when `blockIndex` is a fallback default, not a resolved target. */
  isFallback: boolean
}

function isThenable<T>(value: unknown): value is Promise<T> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function'
}

// The four long-reads plus a specAd bonus carry inline findings (D-14's
// "five annotated" sections); every other section is structurally exempt.
const ANNOTATED_LONG_READS = new Set(['originStory', 'problemStatement', 'founderBio', 'caseStudy'])

/** D-14 — resolves which exempt-note copy (if any) this section/bonus-variant
 * combination needs. `null` = this section IS annotated (carries findings). */
function exemptKindFor(sectionId: string, bonusType: DraftResponse['bonusType']): ExemptSectionKind | null {
  if (sectionId === 'game') return 'game'
  if (sectionId === 'podcast') return 'podcast'
  if (sectionId === 'theme') return 'theme'
  if (sectionId === 'deliberation-conversation') return 'deliberation-conversation'
  if (sectionId === 'bonus') {
    if (bonusType === 'jingle') return 'bonus-jingle'
    if (bonusType === 'bigBudget') return 'bonus-bigBudget'
  }
  return null
}

/** `Galley` renders NO `theme` section at all (verified — no `included('theme')`
 * branch exists). `/s/theme` renders swatches directly from `draft.theme`
 * instead of mounting Galley — never a blank page. */
function ThemeSwatches({ theme }: { theme: DraftResponse['theme'] }) {
  const chips: Array<{ label: string; value?: string }> = [
    { label: 'Primary', value: theme?.primaryColor },
    { label: 'Accent', value: theme?.accentColor },
    { label: 'Background', value: theme?.backgroundColor },
    { label: 'Text', value: theme?.textColor },
  ]
  return (
    <section className="galley-section">
      <h2 className="galley-headline">Theme</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
        {chips.map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span
              aria-hidden="true"
              style={{
                display: 'block',
                width: 44,
                height: 44,
                borderRadius: 2,
                border: '1px solid var(--color-faint)',
                background: value ?? 'transparent',
              }}
            />
            <span className="galley-body" style={{ fontSize: 11 }}>
              {label}: {value ?? '—'}
            </span>
          </div>
        ))}
      </div>
      <p className="galley-body" style={{ marginTop: 16 }}>
        Display font: {theme?.fontDisplay ?? '—'}
      </p>
      <p className="galley-body">Body font: {theme?.fontBody ?? '—'}</p>
    </section>
  )
}

function LoadingSkeleton() {
  return (
    <div className="section-reader" aria-busy="true" aria-label="Loading section…">
      <SkeletonLine className="h-8 w-2/3" />
      <div className="mt-4 flex flex-col gap-2">
        <SkeletonLine className="h-4 w-full" />
        <SkeletonLine className="h-4 w-full" />
        <SkeletonLine className="h-4 w-5/6" />
      </div>
    </div>
  )
}

export default function SectionReaderPage({ params }: SectionReaderPageProps) {
  const resolvedParams = isThenable<SectionParams>(params) ? use(params) : params
  const sectionId = resolvedParams.section

  // ── Every hook, unconditionally, before any early return ────────────────
  const { getToken } = useAuth()
  const { state, runId, title, derivationInputs } = useCurrentRun()
  const { openInspector } = useInspector()

  const [draft, setDraft] = useState<DraftResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revisePassage, setRevisePassage] = useState<RevisionPassageFromSelection | null>(null)
  const [relatedFacts, setRelatedFacts] = useState<PassageSelection | null>(null)
  // Phase 51 (READ-05) — the in-place block editor's open target, if any.
  const [editingTarget, setEditingTarget] = useState<EditingTarget | null>(null)
  // Phase 51 (READ-04, D-13) — the group-accept partial-failure sentence.
  const [groupNote, setGroupNote] = useState<string | null>(null)

  const reloadDraft = useCallback(async () => {
    if (!runId) return
    setError(null)
    try {
      const result = await getDraft(runId, await getToken())
      setDraft(result)
    } catch (e) {
      setError(
        e instanceof ContentPatchError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Failed to load draft.',
      )
    } finally {
      setLoading(false)
    }
    // getToken excluded (matches ReviewDeskRunView precedent) — avoids a
    // refetch loop when its reference churns; depend on runId only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  useEffect(() => {
    if (!runId) return
    void reloadDraft()
  }, [runId, reloadDraft])

  const claimRowsRaw = useQuery(
    api.claimChecks.listByRunId,
    runId ? { runId } : 'skip',
  ) as ClaimCheckRow[] | undefined
  const claimRows = claimRowsRaw ?? []
  const relatedClaim = relatedFacts
    ? claimRows.find(
        (row) => row.sectionName === relatedFacts.sectionId && row.blockIndexHint === relatedFacts.blockIndex,
      )
    : undefined

  // ── Section-id validation (D-03) — verbatim galley id, never guessed ────
  const meta = EDITABLE_SECTIONS.find((s) => s.id === sectionId)
  if (!meta) {
    notFound()
    return null
  }

  // ── Honest states (D-21) ─────────────────────────────────────────────────

  // Confirmed absence — a plain honest line, no nav actions that cannot be
  // honoured, never an empty page.
  if (state.kind === 'none') {
    return (
      <div className="section-reader">
        <p className="galley-body italic text-[color:var(--color-ink-soft)]">
          There is no current issue yet.
        </p>
      </div>
    )
  }

  // Loading — never render "clean" until BOTH findings and claims have
  // resolved. Branch on both being defined, not merely on the draft.
  const isLoading =
    state.kind === 'loading' ||
    loading ||
    title === undefined ||
    derivationInputs.qaFindings === undefined ||
    derivationInputs.claimRows === undefined

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return (
      <div className="section-reader">
        <p role="alert" className="text-sm text-[color:var(--color-vermilion)]">
          {error}
        </p>
      </div>
    )
  }

  if (!runId || !draft) {
    // Structurally unreachable once isLoading is false and state.kind is
    // 'run' (useCurrentRun only ever returns a null runId while state.kind
    // is 'loading' or 'none', both handled above) — kept as a defensive
    // fallback rather than a non-null assertion, degrading to the skeleton
    // instead of a crash if this invariant is ever violated.
    return <LoadingSkeleton />
  }

  const draftSectionIds = draftSectionIdsFromDraft(draft)
  const sectionStates = deriveSectionStates(derivationInputs, draftSectionIds)
  const thisSectionState = sectionStates[sectionId]
  const isAnnotated =
    ANNOTATED_LONG_READS.has(sectionId) || (sectionId === 'bonus' && draft.bonusType === 'specAd')
  const showCleanLine = isAnnotated && thisSectionState?.state === 'clean'
  const exemptKind = exemptKindFor(sectionId, draft.bonusType)

  // TS does not narrow an outer `let`-backed state variable's null-check
  // into a NESTED function declaration's body (the closure could in
  // principle run after `draft`/`runId` change) — capture both in a `const`
  // once so `blocksForSection`/`acceptGroup` below read the
  // already-narrowed types.
  const currentDraft = draft
  const currentRunId = runId

  // Phase 51 (READ-05, D-18) — the section's current blocks, for the
  // in-place editor's Save-edit payload. `bonus` is not one of `draft.
  // sections`'s four keys — its blocks live at the top-level `draft.bonus.
  // body` instead (Pitfall 5), so this is the one place that bridges both
  // shapes into a single `ContentBlock[]` read.
  function blocksForSection(id: string): ContentBlock[] {
    if (id === 'bonus') {
      return Array.isArray(currentDraft.bonus?.body) ? (currentDraft.bonus.body as ContentBlock[]) : []
    }
    return currentDraft.sections[id]?.blocks ?? []
  }

  // The open QA findings for ONE section, mapped from the QA sectionName
  // vocabulary to the galley id and filtered through the ONE shared
  // isOpenFinding predicate (Pitfall 9) — never re-derived inline anywhere
  // else on this page. `derivationInputs.qaFindings`'s declared type omits
  // quotedSpan/blockIndexHint (lib/derivedState.ts's narrower view); the
  // live rows carry them, hence the QaCorrectionRow widen-cast.
  function qaFindingsForSection(id: string): QaFinding[] {
    const rawFindings = (derivationInputs.qaFindings ?? []) as unknown as QaCorrectionRow[]
    return rawFindings
      .filter((row) => isOpenFinding(row) && qaSectionToGalleyId(row.sectionName) === id)
      .map((row) => ({
        _id: row._id,
        severity: row.severity,
        axis: row.axis,
        reason: row.reason,
        suggestedFix: row.suggestedFix,
        quotedSpan: row.quotedSpan,
        blockIndexHint: row.blockIndexHint,
        accepted: row.accepted,
        resolution: row.resolution ?? undefined,
      }))
  }

  /** Which block a finding's flagged span resolves to — the SAME resolver
   * Galley itself uses internally (`lib/galley/spanResolver.ts`), never a
   * second one. `null` when the finding never resolved onto this section's
   * blocks (an orphaned anchor, or the finding isn't in this section at
   * all). */
  function resolveBlockIndex(id: string, findingId: string): number | null {
    const { resolved } = resolveSectionFindings(blocksForSection(id), qaFindingsForSection(id), id)
    const match = resolved.find((r) => r.findingId === findingId)
    return match ? match.blockIndex : null
  }

  // Phase 51 (READ-05, D-18/D-19) — the in-place block editor entry point,
  // replacing plan 51-04's no-op stub. Opens on the flagged block's exact
  // blockIndex when a finding resolved one; falls back to the first block
  // (plainly noted, never a silent guess) when no findingId reaches this
  // call — the PassageToolbar "Edit text" path, whose selection carries a
  // blockIndex that Galley's existing `onEditText={(sel) =>
  // onEditSection(sel.sectionId)}` wiring does not forward — or when the
  // finding's span never resolved (an UnresolvedFindingCard's own "Edit
  // inline" action).
  function openInPlaceEditor(targetSectionId: string, findingId?: string) {
    const resolvedIndex = findingId ? resolveBlockIndex(targetSectionId, findingId) : null
    setEditingTarget({
      sectionId: targetSectionId,
      findingId,
      blockIndex: resolvedIndex ?? 0,
      isFallback: resolvedIndex === null,
    })
  }

  // Phase 51 (READ-04, D-10..D-13) — group-aware Accept. Scoped to THIS
  // section only (the route only ever renders one), reusing the same
  // isOpenFinding-filtered rows `resolveBlockIndex` above already builds.
  const sectionOpenFindings = qaFindingsForSection(sectionId)

  function sizeFor(findingId: string): number {
    return groupForFinding(sectionOpenFindings, findingId).findingIds.length
  }

  /**
   * Sequential accept loop (D-12): each call carries the PREVIOUS call's
   * freshly-returned revisionId, never a stale closure value and never the
   * same value twice — firing the group in parallel against one revisionId
   * would 409 most of the group against the Phase 33 D-06 guard. Keeps
   * going through a failure (D-13) rather than stopping at the first one;
   * failed members stay marked and individually openable — no rollback, no
   * batch-retry control.
   */
  async function acceptGroup(findingId: string) {
    const group = groupForFinding(sectionOpenFindings, findingId)
    let currentRevisionId = currentDraft.revisionId
    let applied = 0
    const failed: string[] = []
    for (const id of group.findingIds) {
      try {
        const res = await acceptFinding(currentRunId, id, { ifRevisionID: currentRevisionId }, await getToken())
        currentRevisionId = res.revisionId // D-12 — fresh revision for the NEXT call
        applied += 1
      } catch {
        failed.push(id) // D-13 — keep going, never stop at first failure
      }
    }
    await reloadDraft()
    setGroupNote(
      failed.length > 0
        ? `${applied} of ${group.findingIds.length} applied — ${failed.length} still need you.`
        : null,
    )
  }

  return (
    <div className="section-reader">
      <SectionHeader title={title} />

      {sectionId === 'theme' ? (
        <ThemeSwatches theme={draft.theme} />
      ) : (
        <Galley
          runId={runId}
          draft={draft}
          revisionId={draft.revisionId}
          reloadDraft={reloadDraft}
          sections={[sectionId]}
          labels={{ accept: 'Accept suggestion', editInline: 'Edit myself', dismiss: 'Dismiss' }}
          generateFixOnAccept
          showAxisTag
          showProvenance
          markSourcedClaims={false}
          onEditSection={openInPlaceEditor}
          onInspect={(id) => openInspector({ type: 'founder', runId, locator: id })}
          onRevise={setRevisePassage}
          onRelatedFacts={setRelatedFacts}
          findingGroup={{ sizeFor, acceptGroup }}
        />
      )}

      {groupNote && (
        <p role="status" className="galley-body">
          {groupNote}
        </p>
      )}

      {editingTarget && editingTarget.sectionId === sectionId && (
        <InPlaceBlockEditor
          runId={runId}
          sectionId={editingTarget.sectionId}
          blocks={blocksForSection(editingTarget.sectionId)}
          blockIndex={editingTarget.blockIndex}
          revisionId={draft.revisionId}
          reloadDraft={reloadDraft}
          onClose={() => setEditingTarget(null)}
          isFallbackBlock={editingTarget.isFallback}
        />
      )}

      {exemptKind && <ExemptSectionNote kind={exemptKind} />}
      {showCleanLine && <p className="galley-body">No open findings in this section.</p>}

      {revisePassage && (
        <div className="mt-4 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-[family-name:var(--font-ui)] text-[13px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)]">
              Ask agent to revise — {revisePassage.sectionName}
            </h3>
            <button
              type="button"
              onClick={() => setRevisePassage(null)}
              className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
            >
              Close
            </button>
          </div>
          <RevisionFlow
            runId={runId}
            passage={revisePassage}
            onApplied={reloadDraft}
            onClose={() => setRevisePassage(null)}
          />
        </div>
      )}

      {relatedFacts && (
        <div className="mt-4 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-[family-name:var(--font-ui)] text-[13px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)]">
              Related facts &amp; sources
            </h3>
            <button
              type="button"
              onClick={() => setRelatedFacts(null)}
              className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
            >
              Close
            </button>
          </div>
          {relatedClaim ? (
            <ClaimProvenanceCard
              claim={{
                text: relatedClaim.text,
                importance: relatedClaim.importance,
                status: relatedClaim.status,
                sourceUrl: relatedClaim.sourceUrl,
                supportingPassage: relatedClaim.context,
                retrievedAt: relatedClaim.retrievedAt,
                sectionName: relatedClaim.sectionName,
              }}
            />
          ) : (
            <p className="text-[13px] italic text-[color:var(--color-ink-soft)]">
              No tracked claims in this passage.
            </p>
          )}
        </div>
      )}

      <SectionEndNav sectionId={sectionId} derivationInputs={derivationInputs} draftSectionIds={draftSectionIds} />
    </div>
  )
}
