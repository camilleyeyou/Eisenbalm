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
 */
import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import SectionChipList, {
  EDITABLE_SECTIONS,
  type SectionChipCounts,
} from './_components/SectionChipList'
import SectionEditorPanel from './_components/SectionEditorPanel'
import Galley from './_components/Galley'
import DecisionRail from './_components/DecisionRail'
import PreviewIframe from '../../run-monitor/runs/[runId]/review/_components/PreviewIframe'
import { getDraft, ContentPatchError, type DraftResponse } from '@/lib/contentPatchClient'
import { resolveSectionFindings, type QaFinding } from '@/lib/galley/spanResolver'
import { isOpenFinding } from '@/lib/galley/findingState'
import { qaSectionToGalleyId } from '@/lib/galley/sectionIdMap'

interface ReviewDeskRunPageProps {
  params: Promise<{ runId: string }>
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

export default function ReviewDeskRunPage({ params }: ReviewDeskRunPageProps) {
  const { runId: rawRunId } = use(params)
  const runId = decodeURIComponent(rawRunId)

  const { getToken } = useAuth()

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
  }, [runId, getToken])

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
      {/* Header + rerun-clobber advisory (§31.9) */}
      <div className="flex flex-col gap-1 border-b border-[color:var(--color-faint)] pb-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[color:var(--color-ink)]">
          Review Desk — Run {runId}
        </h1>
        <p className="text-xs text-[color:var(--color-ink-soft)]">
          Re-roll a section before editing — re-rolling after an edit
          overwrites console changes here.
        </p>
      </div>

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
          </div>

          {/* FAR RIGHT — decision rail (GLY-04, D-17): the design's 336px
              column, scoped to galley mode only — it belongs beside the
              galley, not the editor or the iframe fallback. Stacks below
              the galley on mobile via the existing flex-col lg:flex-row. */}
          {viewMode === 'galley' && (
            <div className="w-full shrink-0 lg:w-[336px]">
              <DecisionRail runId={runId} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
