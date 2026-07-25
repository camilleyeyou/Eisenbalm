'use client'
/**
 * Review Desk screen (Phase 31 D-02, Plan 31-04 Task 2).
 *
 * Quick 260724-i5n (LD-1..LD-8) — this component is now the Story Desk
 * orchestrator: a URL-driven (`?story=&tab=`) switch between the CARDS-variant
 * desk grid (`StoryDeskGrid`, all 9 editable sections) and a per-story focus
 * view (`StoryFocusView`, folder Outline/Draft tabs). It owns:
 *   - the draft load + `reloadDraft` (unchanged since Phase 32/45)
 *   - the `qaCorrections`/`claimChecks` Convex subscriptions
 *   - the FACTUAL_AXES-scoped `chipCounts` memo (unchanged resolution —
 *     `findingsByGalleyId`/`bonusRows` were pulled into their own memos so
 *     the per-section `resolveSectionFindings` call below can reuse them)
 *   - a NEW per-selected-section `resolveSectionFindings` call, so the
 *     Outline tab's beat dots and "Open findings" list read the SAME
 *     resolution the single-section Draft-tab galley lights (LD-3/LD-4)
 *   - `useReviewedSections(runId)` — the LD-5 localStorage-only "Mark
 *     reviewed" nav aid; it changes no publish gate
 *   - the `revisePassage`/`relatedFacts` panels and `showProvenance` state
 *     (unchanged)
 *   - deep links (LD-8): the existing `?edit=<sectionId>[&finding=]` one-shot
 *     now translates into `?story=<id>&tab=draft` + local `editing` state,
 *     and a `hashchange`-and-mount listener replaces the old one-shot
 *     `#galley-<id>` scroll receiver — both DecisionRail's and
 *     WorkspaceOutline's "jump to finding"/jump-nav land on the story's
 *     Draft tab (their own fallback still routes to `issueDraftHref(n)#anchor`
 *     unchanged; this component is what now interprets that hash).
 *
 * The single-section galley (`StoryFocusView`'s Draft tab, non-editing) is
 * the SAME `<Galley>` every other surface mounts, scoped via its new
 * `sections` prop (LD-4) — never a forked annotation renderer. The iframe
 * preview toggle (Phase 31 D-02's soak-cycle fallback) is retired by this
 * quick task's explicit "replace the viewMode galley/edit/iframe body"
 * instruction — `PreviewIframe`/the preview-url route are untouched but no
 * longer mounted from this page.
 *
 * Phase 40/41 history: this component was copied out of `page.tsx` (Task 1)
 * so `page.tsx` could become a redirect-only Server Component, and is now
 * mounted ONLY from `/issues/[issueNumber]/draft` (the standalone
 * `/review-desk/[runId]` route is redirect-only) — this is why it can safely
 * call `useWorkspaceState()` for the Brief (LD-3's side rail) without a
 * fallback path; it always mounts inside the Issue Workspace frame.
 */
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { EDITABLE_SECTIONS, type SectionChipCounts } from './_components/SectionChipList'
import StoryDeskGrid from './_components/StoryDeskGrid'
import StoryFocusView from './_components/StoryFocusView'
import { useReviewedSections } from './_components/useReviewedSections'
import type { OutlineOpenFinding } from './_components/StoryOutlineTab'
import { useInspector } from '@/components/inspector/InspectorProvider'
import { getDraft, ContentPatchError, type DraftResponse } from '@/lib/contentPatchClient'
import {
  resolveSectionFindings,
  type QaFinding,
  type ResolvedAnnotation,
  type UnresolvedFinding,
} from '@/lib/galley/spanResolver'
import { isOpenFinding } from '@/lib/galley/findingState'
import { qaSectionToGalleyId } from '@/lib/galley/sectionIdMap'
import { FACTUAL_AXES } from '@/lib/galley/axisPartition'
import { issueFactCheckHref } from '@/lib/issueRouteResolver'
import { useWorkspaceState } from '@/app/(dashboard)/issues/_components/WorkspaceStateProvider'
import { RevisionFlow } from '@/components/revision/RevisionFlow'
import ClaimProvenanceCard from '@/components/provenance/ClaimProvenanceCard'
import type { PassageSelection } from '@/components/galley/PassageToolbar'
import { SkeletonLine } from '@/components/ui/Skeleton'
import { useConfirm } from '@/components/ui/ConfirmDialog'

interface ReviewDeskRunViewProps {
  params: Promise<{ runId: string }>
  /** Phase 41 (D-12): lets the Draft mount route an unchecked-claim click to Fact Check. */
  issueNumber?: number
}

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

/** Reverse of `galleyAnchorFor`/`qaSectionToGalleyId`'s anchor convention — `#galley-<id>` -> section id. */
function sectionIdFromHash(hash: string): string | null {
  const raw = hash.replace(/^#/, '')
  if (!raw.startsWith('galley-')) return null
  if (raw === 'galley-deliberation') return 'deliberation-conversation'
  const id = raw.slice('galley-'.length)
  return id.length > 0 ? id : null
}

export function ReviewDeskRunView({ params, issueNumber }: ReviewDeskRunViewProps) {
  const { runId: rawRunId } = use(params)
  const runId = decodeURIComponent(rawRunId)

  const { getToken } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { openInspector, revisePassage, requestRevision, clearRevisePassage } = useInspector()
  const confirm = useConfirm()
  const { brief } = useWorkspaceState()

  // ── Draft load (unchanged) ────────────────────────────────────────────────
  const [draft, setDraft] = useState<DraftResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    // See historical note (quick 260721-ohu): getToken is intentionally
    // excluded from this dependency array to avoid a refetch loop when its
    // reference churns; depend on runId only.
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

  // ── URL-driven desk<->story state ─────────────────────────────────────────
  const storySectionId = searchParams.get('story')
  const activeTab: 'outline' | 'draft' = searchParams.get('tab') === 'draft' ? 'draft' : 'outline'

  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const [editFinding, setEditFinding] = useState<{ sectionId: string; findingId?: string } | null>(null)
  // Phase 35 (PRV-03, D-10): the provenance wash layer is ON by default.
  const [showProvenance, setShowProvenance] = useState(true)

  const { reviewed: reviewedIds, isReviewed, toggle: toggleReviewed } = useReviewedSections(runId)

  function buildHref(next: { story: string | null; tab?: 'outline' | 'draft' }): string {
    const sp = new URLSearchParams()
    if (next.story) {
      sp.set('story', next.story)
      sp.set('tab', next.tab ?? 'outline')
    }
    const qs = sp.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  /** Confirms before an action that would abandon unsaved edits (D-07). */
  async function guardDirty(action: () => void) {
    if (editing && storySectionId && dirty[storySectionId]) {
      const confirmed = await confirm({
        title: 'Unsaved changes',
        body: 'You have unsaved changes in this section. Leave the editor anyway? Unsaved edits will be lost.',
        confirmLabel: 'Leave anyway',
        tone: 'danger',
      })
      if (!confirmed) return
    }
    action()
  }

  function goToDesk() {
    void guardDirty(() => {
      setEditing(false)
      setEditFinding(null)
      router.push(buildHref({ story: null }))
    })
  }

  function navToStory(id: string) {
    void guardDirty(() => {
      setEditing(false)
      setEditFinding(null)
      router.push(buildHref({ story: id, tab: activeTab }))
    })
  }

  function openStory(id: string, tab: 'outline' | 'draft' = 'draft') {
    void guardDirty(() => {
      setEditing(false)
      setEditFinding(null)
      router.push(buildHref({ story: id, tab }))
    })
  }

  /**
   * Quick 260724-x4b (LD-3) — the Story Desk card's secondary "Edit →"
   * shortcut: sets editing synchronously and navigates straight to the
   * story's Draft tab, skipping the "open card -> Edit story" two-click
   * tax. Reuses the exact machinery `handleEdit` + `openStory` already
   * provide — StoryFocusView mounts SectionEditorPanel identically to
   * clicking a card then "Edit story", including for structured
   * game/theme/podcast sections.
   */
  function openStoryEditing(id: string) {
    void guardDirty(() => {
      setEditFinding(null)
      setEditing(true)
      router.push(buildHref({ story: id, tab: 'draft' }))
    })
  }

  function setTab(tab: 'outline' | 'draft') {
    if (!storySectionId) return
    // Switching FROM the Draft tab while editing would unmount
    // SectionEditorPanel (its working state lives there, not lifted up) —
    // guard that specific transition; entering/staying on Draft is always safe.
    if (tab === 'outline' && editing) {
      void guardDirty(() => {
        setEditing(false)
        setEditFinding(null)
        router.replace(buildHref({ story: storySectionId, tab }))
      })
      return
    }
    router.replace(buildHref({ story: storySectionId, tab }))
  }

  function handleExitEdit() {
    void guardDirty(() => {
      setEditing(false)
      setEditFinding(null)
    })
  }

  function handleEdit() {
    setEditing(true)
  }

  /**
   * D-08 edit-inline entry (from the galley toolbar/inline annotation, or
   * the `?edit=` deep link below) — always for the CURRENTLY open story.
   */
  function handleEditSection(sectionId: string, findingId?: string) {
    setEditFinding({ sectionId, findingId })
    setEditing(true)
    if (sectionId !== storySectionId) {
      router.replace(buildHref({ story: sectionId, tab: 'draft' }))
    }
  }

  /**
   * Phase 44 (INS-01) — the draft passage entry point. Opens the shared
   * inspector on this section's `founder` artifact.
   */
  function handleInspect(sectionId: string) {
    openInspector({ type: 'founder', runId, locator: sectionId })
  }

  // Phase 36 (VOX-02, D-09) / quick 260724-i5n (LD-8): ?edit=<sectionId>
  // [&finding=<findingId>] one-shot deep link — now translates into
  // ?story=<id>&tab=draft + local editing=true.
  const deepLinkAppliedRef = useRef(false)

  useEffect(() => {
    if (deepLinkAppliedRef.current) return
    if (!draft) return
    const editSection = searchParams.get('edit')
    if (!editSection) return
    deepLinkAppliedRef.current = true
    setEditFinding({ sectionId: editSection, findingId: searchParams.get('finding') ?? undefined })
    setEditing(true)
    router.replace(buildHref({ story: editSection, tab: 'draft' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, searchParams])

  // quick 260724-i5n (LD-8): replaces the old one-shot `#galley-*` scroll
  // receiver — a hashchange-and-mount listener that routes DecisionRail's/
  // WorkspaceOutline's jump-nav (which fall back to `issueDraftHref(n)#anchor`
  // when no galley element is present in the current DOM) onto the target
  // story's Draft tab, then clears the hash so a repeat click re-fires.
  useEffect(() => {
    function handleHash() {
      if (typeof window === 'undefined') return
      const id = sectionIdFromHash(window.location.hash)
      if (!id) return
      router.replace(buildHref({ story: id, tab: 'draft' }))
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    if (draft) handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  // ── Findings / chip counts (unchanged resolution, refactored into memos) ──
  const rawFindings =
    (useQuery(api.qaCorrections.byRunId, { runId }) as QaCorrectionRow[] | undefined) ?? []
  // Pitfall 9: the ONE shared open-finding predicate.
  const openFindings = rawFindings.filter(isOpenFinding)

  const findingsByGalleyId = useMemo(() => {
    // Phase 36 (§36.3): Review Desk's Galley mount is scoped to
    // FACTUAL_AXES — chip/outline/story resolution all apply the SAME rule.
    const factualOpenFindings = openFindings.filter(
      row => row.axis !== undefined && FACTUAL_AXES.has(row.axis),
    )
    const map = new Map<string, QaFinding[]>()
    for (const row of factualOpenFindings) {
      const galleyId = qaSectionToGalleyId(row.sectionName)
      if (!galleyId) continue
      const list = map.get(galleyId) ?? []
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
      map.set(galleyId, list)
    }
    return map
  }, [openFindings])

  const bonusRows = useMemo<Array<{ type: string; text: string }>>(
    () => (draft?.bonusType === 'specAd' && Array.isArray(draft.bonus?.body) ? draft.bonus.body : []),
    [draft],
  )

  const chipCounts = useMemo<Record<string, SectionChipCounts>>(() => {
    const result: Record<string, SectionChipCounts> = {}
    for (const section of EDITABLE_SECTIONS) {
      const findings = findingsByGalleyId.get(section.id) ?? []
      const rows = section.id === 'bonus' ? bonusRows : (draft?.sections[section.id]?.blocks ?? [])
      result[section.id] = tallyForSection(section.id, rows, findings)
    }
    return result
  }, [findingsByGalleyId, bonusRows, draft])

  // quick 260724-i5n (LD-3) — the currently-open story's resolved/unresolved
  // findings, via the SAME `resolveSectionFindings` call the single-section
  // galley makes — the Outline tab's beat dots and open-findings list never
  // drift from what opening the Draft tab actually shows.
  const selectedResolution = useMemo<{
    resolved: ResolvedAnnotation[]
    unresolved: UnresolvedFinding[]
  }>(() => {
    if (!draft || !storySectionId) return { resolved: [], unresolved: [] }
    const rows =
      storySectionId === 'bonus' ? bonusRows : (draft.sections[storySectionId]?.blocks ?? [])
    const findings = findingsByGalleyId.get(storySectionId) ?? []
    return resolveSectionFindings(rows, findings, storySectionId)
  }, [draft, storySectionId, bonusRows, findingsByGalleyId])

  const outlineOpenFindings = useMemo<OutlineOpenFinding[]>(() => {
    const fromResolved = selectedResolution.resolved.map(r => ({
      id: r.findingId,
      severity: r.severity,
      reason: r.reason,
    }))
    const fromUnresolved = selectedResolution.unresolved.map(u => ({
      id: u.findingId,
      severity: u.severity,
      reason: u.reason,
    }))
    return [...fromResolved, ...fromUnresolved]
  }, [selectedResolution])

  // ── Claims (Phase 45, D-16 "Related facts & sources" + LD-3 claim counts) ─
  const [relatedFacts, setRelatedFacts] = useState<PassageSelection | null>(null)
  const claimRows =
    (useQuery(api.claimChecks.listByRunId, { runId }) as ClaimCheckRow[] | undefined) ?? []
  const relatedClaim = relatedFacts
    ? claimRows.find(
        (row) => row.sectionName === relatedFacts.sectionId && row.blockIndexHint === relatedFacts.blockIndex,
      )
    : undefined

  const claimRowsForStory = useMemo(
    () => (storySectionId ? claimRows.filter(row => row.sectionName === storySectionId) : []),
    [claimRows, storySectionId],
  )
  const sourcedCount = claimRowsForStory.filter(row => Boolean(row.claimId)).length
  const unsourcedCount = claimRowsForStory.length - sourcedCount

  // D-08: the reason text for the finding that deep-linked into the editor.
  const editFindingReason = editFinding?.findingId
    ? rawFindings.find(row => row._id === editFinding.findingId)?.reason
    : undefined

  // "Next unreviewed" — first EDITABLE_SECTIONS entry AFTER the current one
  // that isn't in the reviewed set (no wraparound).
  function nextUnreviewedAfter(currentId: string): { id: string; label: string } | null {
    const idx = EDITABLE_SECTIONS.findIndex(s => s.id === currentId)
    for (let i = idx + 1; i < EDITABLE_SECTIONS.length; i++) {
      const candidate = EDITABLE_SECTIONS[i]
      if (candidate && !isReviewed(candidate.id)) return candidate
    }
    return null
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {loading && (
        <div className="flex flex-col gap-3" data-testid="galley-loading-skeleton">
          <SkeletonLine className="h-6 w-40" />
          <SkeletonLine className="h-4 w-full" />
          <SkeletonLine className="h-4 w-5/6" />
          <SkeletonLine className="h-4 w-3/4" />
          <SkeletonLine className="h-4 w-2/3" />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-[color:var(--color-vermilion)]">
          {error}
        </p>
      )}

      {!loading && !error && draft && (
        <div className="flex flex-1 flex-col gap-4">
          {!storySectionId ? (
            <StoryDeskGrid
              draft={draft}
              chipCounts={chipCounts}
              reviewedIds={reviewedIds}
              onOpen={id => openStory(id, 'draft')}
              onOpenEdit={openStoryEditing}
              issueNumber={issueNumber}
            />
          ) : (
            <StoryFocusView
              runId={runId}
              draft={draft}
              sectionId={storySectionId}
              activeTab={activeTab}
              onTab={setTab}
              onBack={goToDesk}
              onNav={navToStory}
              reviewed={isReviewed(storySectionId)}
              onToggleReviewed={() => toggleReviewed(storySectionId)}
              chipCounts={chipCounts}
              resolved={selectedResolution.resolved}
              unresolved={selectedResolution.unresolved}
              openFindings={outlineOpenFindings}
              sourcedCount={sourcedCount}
              unsourcedCount={unsourcedCount}
              brief={brief}
              editing={editing}
              onEdit={handleEdit}
              onExitEdit={handleExitEdit}
              onDirtyChange={setDirty}
              focusFindingId={editFinding?.findingId}
              findingReason={editFindingReason}
              revisionId={draft.revisionId}
              reloadDraft={reloadDraft}
              onEditSection={handleEditSection}
              onInspect={handleInspect}
              onRevise={requestRevision}
              onRelatedFacts={setRelatedFacts}
              showProvenance={showProvenance}
              onToggleProvenance={() => setShowProvenance(prev => !prev)}
              onUnsourcedClaimClick={() => {
                if (issueNumber != null) router.push(issueFactCheckHref(issueNumber))
              }}
              nextUnreviewed={nextUnreviewedAfter(storySectionId)}
            />
          )}

          {/* Phase 45 (REV-01/REV-04, D-18) — the shared "Ask agent to
              revise" flow, scoped to whichever passage was selected. */}
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

          {/* Phase 45 (REV-01, D-16) — "Related facts & sources". */}
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
      )}

      {!loading && !error && !draft && (
        <div className="flex min-h-[300px] flex-1 items-center justify-center border border-dashed border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-8">
          <p className="text-sm text-[color:var(--color-ink-soft)]">Loading draft…</p>
        </div>
      )}
    </div>
  )
}

export default ReviewDeskRunView
