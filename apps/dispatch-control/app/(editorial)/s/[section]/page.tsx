'use client'
/**
 * Phase 51 (READ-01, READ-02, READ-03, READ-06, READ-07, READ-08) — the
 * section-reader page: an editor opens `/s/[section]` and reads the current
 * issue's section as full-width prose with no side rails or tabs.
 *
 * Quick 261021-7aw: the agents review and self-fix every section before the
 * draft reaches the editor, so this page shows NO finding marks, no
 * Accept/Dismiss/rewrite controls and no "Ask agent to revise" prompts
 * (`Galley hideFindings`). The only extra is a quiet read-only
 * `AgentChangesNote` listing what the agents changed. Hand-editing via the
 * in-place block editor still works.
 *
 * Current-run resolution (D-02) is the ONE locked path — `useCurrentRun()`
 * — never a derived "highest issue number", never an `?issue=` override.
 *
 * Section-id validation (D-03): `params.section` IS the internal galley id,
 * verbatim. An unknown segment 404s via `notFound()`.
 *
 * Honest states (D-21): loading / not-generated / ready are visibly
 * different renders; the not-generated block is owned by `Galley` (WSP-07).
 */
import { use, useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { notFound } from 'next/navigation'
import { api } from '@convex/_generated/api'
import { useCurrentRun } from '@/lib/useCurrentRun'
import { useInspector } from '@/components/inspector/InspectorProvider'
import { EDITABLE_SECTIONS } from '@/lib/editableSections'
import { draftSectionIdsFromDraft } from '@/lib/derivedState'
import {
  getDraft,
  ContentPatchError,
  type ContentBlock,
  type DraftResponse,
} from '@/lib/contentPatchClient'
import { qaSectionToGalleyId } from '@/lib/galley/sectionIdMap'
import Galley from '@/components/galley/Galley'
import ClaimProvenanceCard from '@/components/provenance/ClaimProvenanceCard'
import type { PassageSelection } from '@/components/galley/PassageToolbar'
import { SkeletonLine } from '@/components/ui/Skeleton'
import SectionHeader from './_components/SectionHeader'
import SectionEndNav from './_components/SectionEndNav'
import ExemptSectionNote, { type ExemptSectionKind } from './_components/ExemptSectionNote'
import InPlaceBlockEditor from './_components/InPlaceBlockEditor'
import AgentChangesNote from './_components/AgentChangesNote'
import type { FindingResolution } from '@/lib/galley/findingState'

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
  verdict?: 'verified' | 'contradicted' | 'unverifiable'
  verdictEvidence?: string
  verdictSources?: string[]
  changedSinceCheck?: boolean
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
  resolution?: FindingResolution | null
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
  const [relatedFacts, setRelatedFacts] = useState<PassageSelection | null>(null)
  // Phase 51 (READ-05) — the in-place block editor's open target, if any.
  const [editingTarget, setEditingTarget] = useState<EditingTarget | null>(null)

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

  const pageLoading =
    state.kind === 'loading' ||
    loading ||
    title === undefined ||
    derivationInputs.qaFindings === undefined ||
    derivationInputs.claimRows === undefined

  // Phase 52 (HOME-05) — the front door links to /s/{id}#finding-{id}. The
  // browser's native hash scroll fires before the async draft renders the
  // mark, so scroll once loading clears.
  useEffect(() => {
    if (pageLoading || typeof window === 'undefined') return
    const id = window.location.hash.slice(1)
    if (!id) return
    document.getElementById(id)?.scrollIntoView({ block: 'center' })
  }, [pageLoading])

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
  const isLoading = pageLoading

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
  const exemptKind = exemptKindFor(sectionId, draft.bonusType)

  // TS does not narrow an outer `let`-backed state variable's null-check
  // into a NESTED function declaration's body — capture `draft` in a `const`
  // once so `blocksForSection` below reads the already-narrowed type.
  const currentDraft = draft

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

  // Quick 261021-7aw — the agents' own changes to THIS section, shown as a
  // quiet read-only note (no actions). Only 'agent-applied' rows count.
  const agentChangeRows = ((derivationInputs.qaFindings ?? []) as unknown as QaCorrectionRow[]).filter(
    (row) => row.resolution === 'agent-applied' && qaSectionToGalleyId(row.sectionName) === sectionId,
  )

  // Phase 51 (READ-05, D-18/D-19) — hand-editing entry point (the
  // PassageToolbar "Edit text" action). Quick 261021-ind: opens on the
  // selected paragraph (`onEditBlock`); this section-level fallback opens the
  // first block with a plain note.
  function openInPlaceEditor(targetSectionId: string) {
    setEditingTarget({ sectionId: targetSectionId, blockIndex: 0, isFallback: true })
  }

  function openInPlaceEditorAtBlock(targetSectionId: string, blockIndex: number) {
    const n = blocksForSection(targetSectionId).length
    const valid = blockIndex >= 0 && blockIndex < n
    setEditingTarget({
      sectionId: targetSectionId,
      blockIndex: valid ? blockIndex : 0,
      isFallback: !valid,
    })
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
          hideFindings
          showProvenance
          markSourcedClaims={false}
          onEditSection={openInPlaceEditor}
          onEditBlock={openInPlaceEditorAtBlock}
          onInspect={(id) => openInspector({ type: 'founder', runId, locator: id })}
          onRelatedFacts={setRelatedFacts}
        />
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
      <AgentChangesNote rows={agentChangeRows} />

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
                verdict: relatedClaim.verdict,
                verdictEvidence: relatedClaim.verdictEvidence,
                verdictSources: relatedClaim.verdictSources,
                changedSinceCheck: relatedClaim.changedSinceCheck,
              }}
            />
          ) : (
            <p className="text-[13px] italic text-[color:var(--color-ink-soft)]">
              No tracked claims in this passage.
            </p>
          )}
        </div>
      )}

      <SectionEndNav sectionId={sectionId} />
    </div>
  )
}
