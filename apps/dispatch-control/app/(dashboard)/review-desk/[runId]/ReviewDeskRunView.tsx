'use client'
/**
 * Review Desk screen (Phase 31 D-02, Plan 31-04 Task 2).
 *
 * Phase 32 (GLY-01, GLY-05, Plan 32-07 Task 2) re-composes this screen
 * around the native galley as the DEFAULT view (D-01): a `viewMode` state
 * drives three mutually-exclusive bodies — `'galley'` (the Plan 32-06
 * `<Galley>`, default), `'edit'` (the Phase 31 `SectionEditorPanel`, entered
 * via the Edit-section affordance), and `'iframe'` (the Phase 31
 * `PreviewIframe` toggle, kept mounted as the soak-cycle fallback per D-02).
 * The `SectionChipList` (upgraded Plan 32-07 Task 1 with `counts`) serves as
 * jump-nav in galley mode (click -> scrollIntoView) and as the section
 * selector in edit mode — one chip strip, two roles (D-03).
 *
 * Chip counts are computed client-side (D-13) from the live `qaCorrections`
 * feed (open findings only, D-08) resolved per-section via the Plan 32-03/
 * 32-05 span resolver — the same resolution the galley itself performs, so
 * the chip badges and the galley's inline annotations always agree.
 *
 * Data: fetches the draft via getDraft(runId, token) from contentPatchClient
 * (token from useAuth().getToken()). The signed preview URL is resolved via a
 * tiny server Route Handler (app/api/review-desk/[runId]/preview-url) since
 * lib/previewToken.ts is server-only (PREVIEW_SECRET + node:crypto) and this
 * page is a Client Component (it owns selectedSection/viewMode state).
 *
 * §31.9 rerun-clobber ordering rule: a static advisory note is shown near the
 * header — re-rolling a section after an operator edit overwrites the console
 * change (rerun rebuilds from the LangGraph checkpoint and calls the full
 * write_issue_draft). v1 position: documented ordering rule, not a code guard.
 *
 * Phase 36 (VOX-02, D-09, Plan 36-07 Task 1): the page also reads an
 * `?edit=<sectionId>[&finding=<findingId>]` deep-link so a second surface
 * (Voice Pass's "Write my own" action) can route straight into the section
 * editor without duplicating any editor machinery. A `deepLinkAppliedRef`
 * guard fires it at most once per mount — after that, normal in-page nav
 * (chip clicks, "Back to galley") behaves exactly as before.
 *
 * Phase 40 (ISS-02, D-07, Plan 40-06 Task 1): this component was copied
 * verbatim out of `page.tsx` into this co-located non-route file so
 * `page.tsx` could become a redirect-only Server Component (Task 3) while
 * `/issues/[issueNumber]/review` (Task 2) mounts THIS file directly. Every
 * relative import below is unchanged — this file lives in the SAME
 * directory `page.tsx` used to occupy.
 *
 * Phase 41 (WSP-04, WSP-07, D-06/D-07/D-13, Plan 41-08 Task 1): this is now
 * the Stage 2 (Draft) canvas mounted from `issues/[issueNumber]/draft/
 * page.tsx`. The standalone page-level heading + the rerun-clobber advisory
 * paragraph, and the decision-rail mount (moved to Stage 5, D-13, see the
 * Approval stage's own rail import) were removed — the frame (`layout.tsx`)
 * now supplies the page chrome, and the rail lives in the Approval stage
 * instead. An optional `issueNumber` prop lets the galley's unchecked-claim
 * click-through route to the Fact Check tab (D-12); it is undefined for any
 * other caller of this component (none currently exist beyond the Draft
 * mount).
 *
 * Phase 44 (INS-01, Plan 44-07 Task 1): the mounted `<Galley>` now gets
 * `onInspect` — the draft passage entry point into the shared "Inspect how
 * this was made" panel (`useInspector().openInspector`, mounted once at the
 * `(dashboard)` root layout). Opens on the section's `founder` artifact.
 *
 * Phase 45 (REV-01/REV-04, D-18, Plan 45-05 Task 2): the mounted `<Galley>`
 * now also gets `onRevise`/`onRelatedFacts` — wired to the SAME
 * `revisePassage`/`requestRevision`/`clearRevisePassage` channel the
 * `InspectorProvider` context exposes (shared with the Phase-44 inspector
 * footer's "Ask agent to revise", Plan 45-05 Task 3), not new local state —
 * this is what makes the galley toolbar AND the inspector footer open the
 * SAME `RevisionFlow` regardless of which one triggered it (D-18's "one
 * component, every surface"). Applying reloads the draft (`reloadDraft`),
 * re-fetching from Sanity so the reset claims and any revoked Voice
 * sign-off surface immediately. "Related facts & sources" looks up a
 * tracked `claim_checks` row intersecting the selected block from the SAME
 * `claimChecks.listByRunId` query the shared galley already subscribes to
 * internally (Convex dedupes the identical subscription — no new backend
 * query) and renders the shared `ClaimProvenanceCard`, or an honest "No
 * tracked claims in this passage."
 */
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import SectionChipList, {
  EDITABLE_SECTIONS,
  type SectionChipCounts,
} from './_components/SectionChipList'
import SectionEditorPanel from './_components/SectionEditorPanel'
import Galley from '@/components/galley/Galley'
import { useInspector } from '@/components/inspector/InspectorProvider'
import PreviewIframe from '../../run-monitor/runs/[runId]/review/_components/PreviewIframe'
import { getDraft, ContentPatchError, type DraftResponse } from '@/lib/contentPatchClient'
import { resolveSectionFindings, type QaFinding } from '@/lib/galley/spanResolver'
import { isOpenFinding } from '@/lib/galley/findingState'
import { qaSectionToGalleyId } from '@/lib/galley/sectionIdMap'
import { FACTUAL_AXES } from '@/lib/galley/axisPartition'
import { issueFactCheckHref } from '@/lib/issueRouteResolver'
import { RevisionFlow } from '@/components/revision/RevisionFlow'
import ClaimProvenanceCard from '@/components/provenance/ClaimProvenanceCard'
import type { PassageSelection } from '@/components/galley/PassageToolbar'

interface ReviewDeskRunViewProps {
  params: Promise<{ runId: string }>
  /** Phase 41 (D-12): lets the Draft mount route an unchecked-claim click to Fact Check. */
  issueNumber?: number
}

type ViewMode = 'galley' | 'edit' | 'iframe'

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

/**
 * Minimal shape needed from a live `claim_checks` row (Phase 45, D-16 —
 * "Related facts & sources"). Mirrors `Galley.tsx`'s own internal
 * `ClaimCheckRow` (this app duplicates "minimal shape needed from a row"
 * interfaces per-surface today, matching `QaCorrectionRow` above).
 */
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

/**
 * Maps a chip's section id to the galley's DOM anchor. `theme` has no galley
 * anchor (D-04: theme is applied globally, not rendered as its own section)
 * and `deliberation-conversation` renders under the shorter `galley-
 * deliberation` id (see `Galley.tsx`) -- both intentional exceptions to the
 * otherwise-uniform `galley-{id}` pattern.
 */
function galleyAnchorFor(sectionId: string): string | null {
  if (sectionId === 'theme') return null
  if (sectionId === 'deliberation-conversation') return 'galley-deliberation'
  return `galley-${sectionId}`
}

/**
 * Tallies open findings (already section-scoped) into a chip's count shape.
 * Sections with no draft blocks to anchor against (game/podcast/theme/
 * deliberation, or a bonus variant that isn't rendered as blocks) count by
 * severity only -- there is no anchor concept there, so nothing can be
 * "unresolved" (D-09 is about anchor failure, not absence of an anchor
 * surface). Sections with blocks reuse the same `resolveSectionFindings`
 * call the galley itself makes, so chip badges and inline annotations never
 * disagree.
 */
function tallyForSection(
  sectionId: string,
  rows: Array<{ type: string; text: string }>,
  findings: QaFinding[],
): SectionChipCounts {
  const counts: SectionChipCounts = { open: 0, unresolved: 0, error: 0, warning: 0, info: 0 }
  if (findings.length === 0) return counts

  if (rows.length === 0) {
    for (const finding of findings) {
      counts.open += 1
      counts[finding.severity] = (counts[finding.severity] ?? 0) + 1
    }
    return counts
  }

  const { resolved, unresolved } = resolveSectionFindings(rows, findings, sectionId)
  counts.unresolved = unresolved.length
  for (const finding of [...resolved, ...unresolved]) {
    counts.open += 1
    counts[finding.severity] = (counts[finding.severity] ?? 0) + 1
  }
  return counts
}

export function ReviewDeskRunView({ params, issueNumber }: ReviewDeskRunViewProps) {
  const { runId: rawRunId } = use(params)
  const runId = decodeURIComponent(rawRunId)

  const { getToken } = useAuth()
  const router = useRouter()
  const { openInspector, revisePassage, requestRevision, clearRevisePassage } = useInspector()

  // Phase 45 (REV-01, D-16) — "Related facts & sources" selection; local to
  // this surface (unlike revisePassage) since only ONE entry point (the
  // galley toolbar) can ever set it.
  const [relatedFacts, setRelatedFacts] = useState<PassageSelection | null>(null)
  // The SAME claim_checks query Galley.tsx already subscribes to
  // internally — Convex dedupes the identical subscription, so this is not
  // a new backend query, just a second reader of the existing one.
  const claimRows =
    (useQuery(api.claimChecks.listByRunId, { runId }) as ClaimCheckRow[] | undefined) ?? []
  const relatedClaim = relatedFacts
    ? claimRows.find(
        (row) => row.sectionName === relatedFacts.sectionId && row.blockIndexHint === relatedFacts.blockIndex,
      )
    : undefined

  const [draft, setDraft] = useState<DraftResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedSection, setSelectedSection] = useState<string>(
    EDITABLE_SECTIONS[0]?.id ?? 'originStory',
  )

  // D-01: the galley is the default view. 'edit' is the Phase 31
  // SectionEditorPanel (entered via the Edit-section affordance); 'iframe'
  // is the Phase 31 preview toggle, kept as the soak-cycle fallback (D-02).
  const [viewMode, setViewMode] = useState<ViewMode>('galley')

  // Phase 35 (PRV-03, D-10): the provenance wash layer is ON by default;
  // the toolbar toggle below lets the operator switch it off for clean
  // reading.
  const [showProvenance, setShowProvenance] = useState(true)

  // D-07 dirty-state map, bubbled up from SectionEditorPanel so the
  // section-chip list can paint the unsaved dot and in-app nav can guard
  // against silently discarding unsaved edits when switching sections.
  const [dirty, setDirty] = useState<Record<string, boolean>>({})

  // D-08 edit-inline deep-link context: which finding sent the operator into
  // the editor, so SectionEditorPanel can keep its reason visible.
  const [editFinding, setEditFinding] = useState<{
    sectionId: string
    findingId?: string
  } | null>(null)

  /** Switches view mode, guarding an unsaved edit-mode section (D-07). */
  function switchViewMode(next: ViewMode) {
    if (
      viewMode === 'edit' &&
      next !== 'edit' &&
      dirty[selectedSection] &&
      !window.confirm(
        'You have unsaved changes in this section. Leave the editor anyway? Unsaved edits will be lost.',
      )
    ) {
      return
    }
    if (next !== 'edit') setEditFinding(null)
    setViewMode(next)
  }

  function handleChipSelect(id: string) {
    if (
      viewMode === 'edit' &&
      dirty[selectedSection] &&
      !window.confirm(
        'You have unsaved changes in this section. Switch sections anyway? Unsaved edits will be lost.',
      )
    ) {
      return
    }
    setEditFinding(null)
    setSelectedSection(id)
    if (viewMode === 'galley') {
      const anchor = galleyAnchorFor(id)
      if (anchor) {
        document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  /**
   * D-08 Edit-inline deep-link: flips the page into the section editor for
   * the finding's section (galley section ids ARE editable section ids) with
   * the finding stored so its reason stays visible. Guards unsaved edits the
   * same way handleChipSelect does.
   */
  function handleEditSection(sectionId: string, findingId?: string) {
    if (
      viewMode === 'edit' &&
      dirty[selectedSection] &&
      !window.confirm(
        'You have unsaved changes in this section. Switch sections anyway? Unsaved edits will be lost.',
      )
    ) {
      return
    }
    setSelectedSection(sectionId)
    setEditFinding({ sectionId, findingId })
    setViewMode('edit')
  }

  /**
   * Phase 44 (INS-01) — the draft passage entry point. Opens the shared
   * inspector on this section's `founder` artifact. The locator is the
   * galley/draft camelCase section id; `resolveInspectorStep`
   * (`lib/inspectorArtifact.ts`) normalizes it via `galleyIdToQaSection`.
   */
  function handleInspect(sectionId: string) {
    openInspector({ type: 'founder', runId, locator: sectionId })
  }

  // Phase 36 (VOX-02, D-09, Plan 36-07 Task 1): ?edit=<sectionId>[&finding=
  // <findingId>] deep-link entry — fires handleEditSection once the draft is
  // loaded (so the section is valid), and at most once per mount via the ref
  // guard. Later in-page navigation (chip clicks, "Back to galley") is
  // unaffected — this effect never re-fires after its first successful run.
  const searchParams = useSearchParams()
  const deepLinkAppliedRef = useRef(false)

  useEffect(() => {
    if (deepLinkAppliedRef.current) return
    if (!draft) return
    const editSection = searchParams.get('edit')
    if (!editSection) return
    deepLinkAppliedRef.current = true
    handleEditSection(editSection, searchParams.get('finding') ?? undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, searchParams])

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  /**
   * Loads (or re-loads) the draft. Extracted from the mount effect so the
   * galley can refetch after a successful accept — or on a revision_mismatch
   * 409 — so span re-resolution runs against fresh text (EDT-06, Pitfall 1).
   */
  const reloadDraft = useCallback(async () => {
    setError(null)
    try {
      const token = await getToken()
      const result = await getDraft(runId, token)
      setDraft(result)
    } catch (e) {
      setError(
        e instanceof ContentPatchError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Failed to load draft.',
      )
    }
    // getToken (Clerk) is a stable accessor called FRESH inside the try block
    // and always returns a current token regardless of which reference was
    // captured; including its identity here caused an infinite
    // refetch/re-render loop on CONTENT runs when getToken's reference
    // churns — quick 260721-ohu. CHOSEN APPROACH: drop getToken from THIS
    // useCallback's deps (rather than the mount effect below, which depends
    // on [reloadDraft]) — the churn enters through reloadDraft's identity, so
    // stabilizing reloadDraft per-runId both breaks the loop AND preserves
    // Pitfall 1 (reloadDraft is reused as a prop after accept /
    // revision_mismatch — see reloadDraft={reloadDraft} / onApplied={reloadDraft}
    // below). Depend on runId ONLY.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      await reloadDraft()
      if (!cancelled) setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [reloadDraft])

  useEffect(() => {
    if (viewMode !== 'iframe' || previewUrl) return
    let cancelled = false
    async function loadPreview() {
      try {
        const res = await fetch(`/api/review-desk/${encodeURIComponent(runId)}/preview-url`)
        const body = await res.json()
        if (!cancelled) setPreviewUrl(body.previewUrl ?? null)
      } catch {
        if (!cancelled) setPreviewUrl(null)
      }
    }
    void loadPreview()
    return () => {
      cancelled = true
    }
  }, [viewMode, previewUrl, runId])

  // D-13: chip counts resolved client-side from the live `qaCorrections`
  // feed -- open findings only (D-08), grouped via `qaSectionToGalleyId`.
  const rawFindings =
    (useQuery(api.qaCorrections.byRunId, { runId }) as QaCorrectionRow[] | undefined) ?? []
  // Pitfall 9: the ONE shared open-finding predicate — dismissed/accepted
  // findings drop from chip counts the moment their resolution lands.
  const openFindings = rawFindings.filter(isOpenFinding)

  const chipCounts = useMemo<Record<string, SectionChipCounts>>(() => {
    // Phase 36 (§36.3, Task 2): Review Desk's Galley mount is scoped to
    // FACTUAL_AXES below — the chip tally applies the SAME scoping rule
    // (axis present AND in FACTUAL_AXES) so badge counts never disagree
    // with what the galley actually lights.
    const factualOpenFindings = openFindings.filter(
      row => row.axis !== undefined && FACTUAL_AXES.has(row.axis),
    )
    const findingsByGalleyId = new Map<string, QaFinding[]>()
    for (const row of factualOpenFindings) {
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

    const bonusRows: Array<{ type: string; text: string }> =
      draft?.bonusType === 'specAd' && Array.isArray(draft.bonus?.body) ? draft.bonus.body : []

    const result: Record<string, SectionChipCounts> = {}
    for (const section of EDITABLE_SECTIONS) {
      const findings = findingsByGalleyId.get(section.id) ?? []
      const rows =
        section.id === 'bonus'
          ? bonusRows
          : (draft?.sections[section.id]?.blocks ?? [])
      result[section.id] = tallyForSection(section.id, rows, findings)
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFindings, draft])

  const selectedLabel =
    EDITABLE_SECTIONS.find(s => s.id === selectedSection)?.label ?? selectedSection

  // D-08: the reason text for the finding that deep-linked into the editor,
  // kept visible above the editing surface for reference.
  const editFindingReason = editFinding?.findingId
    ? rawFindings.find(row => row._id === editFinding.findingId)?.reason
    : undefined

  return (
    <div className="flex min-h-[70vh] flex-col gap-4">
      {loading && (
        <p className="text-sm text-[color:var(--color-ink-soft)]">Loading draft…</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-[color:var(--color-vermilion)]">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="flex flex-1 flex-col gap-4 lg:flex-row">
          {/* LEFT — section-chip jump-nav / section selector */}
          <div className="w-full shrink-0 lg:w-64">
            <SectionChipList
              sections={EDITABLE_SECTIONS}
              selected={selectedSection}
              onSelect={handleChipSelect}
              dirty={dirty}
              counts={chipCounts}
            />
          </div>

          {/* RIGHT — galley (default) | editor | iframe fallback */}
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-[family-name:var(--font-ui)] text-[13px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)]">
                {viewMode === 'edit' ? selectedLabel : 'Galley'}
              </h2>
              <div className="flex items-center gap-2">
                {viewMode === 'edit' ? (
                  <button
                    type="button"
                    onClick={() => switchViewMode('galley')}
                    className="min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-medium uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
                  >
                    Back to galley
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => switchViewMode('edit')}
                    className="min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-medium uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
                  >
                    Edit {selectedLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => switchViewMode(viewMode === 'iframe' ? 'galley' : 'iframe')}
                  className="min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-medium uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
                >
                  {viewMode === 'iframe' ? 'Hide preview' : 'Show preview'}
                </button>
                {/* Phase 35 (PRV-03, D-10): default-ON provenance wash toggle. */}
                <button
                  type="button"
                  onClick={() => setShowProvenance((prev) => !prev)}
                  aria-pressed={showProvenance}
                  className="min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-medium uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
                >
                  {showProvenance ? 'Provenance on' : 'Provenance off'}
                </button>
              </div>
            </div>

            {viewMode === 'galley' &&
              (draft ? (
                <Galley
                  runId={runId}
                  draft={draft}
                  revisionId={draft.revisionId}
                  reloadDraft={reloadDraft}
                  onEditSection={handleEditSection}
                  onInspect={handleInspect}
                  onRevise={requestRevision}
                  onRelatedFacts={setRelatedFacts}
                  showProvenance={showProvenance}
                  includeAxes={FACTUAL_AXES}
                  onUnsourcedClaimClick={() => {
                    if (issueNumber != null) router.push(issueFactCheckHref(issueNumber))
                  }}
                />
              ) : (
                <div className="flex min-h-[300px] flex-1 items-center justify-center border border-dashed border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-8">
                  <p className="text-sm text-[color:var(--color-ink-soft)]">Loading draft…</p>
                </div>
              ))}

            {viewMode === 'edit' &&
              (draft ? (
                <SectionEditorPanel
                  runId={runId}
                  selectedSection={selectedSection}
                  draft={draft}
                  onDirtyChange={setDirty}
                  focusFindingId={editFinding?.findingId}
                  findingReason={editFindingReason}
                />
              ) : (
                <div className="flex min-h-[300px] flex-1 items-center justify-center border border-dashed border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-8">
                  <p className="text-sm text-[color:var(--color-ink-soft)]">Loading draft…</p>
                </div>
              ))}

            {viewMode === 'iframe' &&
              (previewUrl ? (
                <div className="min-h-[500px] flex-1">
                  <PreviewIframe previewUrl={previewUrl} />
                </div>
              ) : (
                <div className="flex min-h-[300px] flex-1 items-center justify-center border border-dashed border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-8">
                  <p className="text-sm text-[color:var(--color-ink-soft)]">
                    Preview unavailable.
                  </p>
                </div>
              ))}

            {/* Phase 45 (REV-01/REV-04, D-18) — the shared "Ask agent to
                revise" flow, scoped to whichever passage was selected
                (galley toolbar) OR requested (inspector footer). Rendered
                regardless of viewMode so an inspector-footer-triggered
                request is never silently dropped. */}
            {revisePassage && (
              <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-[family-name:var(--font-ui)] text-[13px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)]">
                    Ask agent to revise — {revisePassage.sectionName}
                  </h3>
                  <button
                    type="button"
                    onClick={clearRevisePassage}
                    className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
                  >
                    Close
                  </button>
                </div>
                <RevisionFlow
                  runId={runId}
                  passage={revisePassage}
                  onApplied={reloadDraft}
                  onClose={clearRevisePassage}
                />
              </div>
            )}

            {/* Phase 45 (REV-01, D-16) — "Related facts & sources": the
                shared ClaimProvenanceCard for a tracked claim intersecting
                the selected block, or an honest "no tracked claims" state. */}
            {relatedFacts && (
              <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4">
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
          </div>
        </div>
      )}
    </div>
  )
}

export default ReviewDeskRunView
