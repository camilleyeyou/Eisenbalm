'use client'
/**
 * Phase 42 (FCT-02/03/04/05/06, Plan 42-06 Task 3) — the real Stage 3 (Fact
 * Check) workspace, replacing the Phase 41 placeholder.
 *
 * Delivers: the affirmative summary (FCT-02, never-blank), the 7-filter
 * claim table (FCT-03), the ONE shared `ClaimProvenanceCard` published into
 * the frame's context panel on selection (FCT-04), the six claim actions at
 * their correct write boundaries (FCT-05), and the two-step "Ask agent for
 * better evidence" preview -> apply flow (FCT-06).
 *
 * Checker Warning 2 (MANDATED): subscribes to the FULL `claim_checks` rows
 * via `useQuery(api.claimChecks.listByRunId, { runId })` directly — NOT
 * `useWorkspaceState().claimRows`, which is a lean projection missing
 * `claimType`/`context` (needed by the filters and the card's supporting
 * passage, per 42-CONTEXT's SCOPE NOTE / Plan 42-05).
 *
 * Checker Warning 3: `useWorkspaceState()` does not expose a draft/
 * revisionId. Any content-touching apply (Edit claim with text,
 * evidence/apply) obtains a FRESH `ifRevisionID` immediately before the call
 * via `getDraft(runId, token)` — mirroring `ReviewDeskRunView.reloadDraft` —
 * rather than reading a non-existent `revisionId` off the workspace value.
 *
 * Panel ownership (D-19): `<FactCheckPanelPublisher/>` (page.tsx) publishes
 * the default coverage-summary panel content from the ALREADY-subscribed
 * lean `claimRows`. This screen's own effect below OVERRIDES that with the
 * `ClaimProvenanceCard` while a claim is selected, and RESTORES the same
 * default content (via the shared `buildFactCheckPanelContent`) on deselect
 * or unmount — so the frame's single persistent context panel never goes
 * blank either way.
 *
 * D-16: because all four surfaces (counters, My Tasks, Approval readiness,
 * header status) read derived selectors over the same Convex data, no
 * explicit cross-surface update wiring is needed here — a mutation from any
 * action below propagates everywhere via Convex reactivity.
 *
 * Phase 44 (INS-01, Plan 44-07 Task 2): supplies `ClaimProvenanceCard`'s
 * already-present-but-inert `actions.onInspect` callback
 * (`components/provenance/ClaimProvenanceCard.tsx`, Phase 42) — this flips
 * its Inspect button from disabled to live with ZERO changes to that file
 * (Phase 42 D-09 three-copies ban). Locator is the claim's stable
 * `claimIndex` (always present, unlike the Phase 35-only `claimId`
 * provenance field) — the same identifier every other claim action on this
 * screen already keys off (`selectedClaimIndex`).
 *
 * quick 260722-n5r (claim table grouped by section, collapsible): the
 * `<section aria-label="Claims">` list render below is reorganized into one
 * collapsible group per `EDITABLE_SECTIONS` entry (reading order), plus a
 * trailing "Other" group for any row whose `sectionName` doesn't resolve to
 * a known section id. A 132-claim run used to render as one flat `<ul>` —
 * an unnavigable wall; grouping + collapse-by-default on all-checked
 * sections makes the wall scannable. Filters, selection state, the
 * published context-panel card, and every action handler are UNCHANGED —
 * this is purely a reorganization of how `filteredRows` is rendered.
 */
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import HelpTip from '@/components/ui/HelpTip'
import { HELP_COPY } from '@/components/help/helpCopy'
import { useWorkspaceState } from '../../_components/WorkspaceStateProvider'
import { useInspector } from '@/components/inspector/InspectorProvider'
import { useRole } from '@/lib/role'
import { LockedControl } from '@/components/LockedControl'
import { buildFactCheckPanelContent } from './FactCheckPanelContent'
import { deriveFactCheckSummary, type FactCheckClaimRow } from '@/lib/derivedState'
import { FACT_CHECK_FILTERS, applyFilters, type FactCheckFilterRow } from '@/lib/factCheckFilters'
import ClaimProvenanceCard, {
  deriveClaimChipState,
  type ClaimProvenanceView,
} from '@/components/provenance/ClaimProvenanceCard'
import { EDITABLE_SECTIONS } from '../../../review-desk/[runId]/_components/SectionChipList'
import { qaSectionToGalleyId } from '@/lib/galley/sectionIdMap'
import { getDraft, ContentPatchError } from '@/lib/contentPatchClient'
import {
  keepClaim,
  patchClaim,
  replaceSource,
  removeClaim,
  evidencePreview,
  evidenceApply,
  FactCheckError,
  type EvidencePreviewResult,
} from '@/lib/factCheckClient'
import { SkeletonLine } from '@/components/ui/Skeleton'

interface FactCheckScreenProps {
  runId: string
}

/** The FULL `claim_checks` row shape (`claimChecks:listByRunId`) — includes
 * `claimType`/`context`, unlike the provider's lean `claimRows` projection. */
interface FullClaimRow extends FactCheckClaimRow, FactCheckFilterRow {
  _id: string
  claimIndex: number
  text: string
  claimType: string
  context: string
  status: string
  sourceUrl?: string
  retrievedAt?: number
  sectionName?: string
  blockIndexHint?: number
  importance?: 'Load-bearing' | 'Supporting' | 'Incidental'
  changedSinceCheck?: boolean
  conflict?: boolean
  checkedAt?: number
}

const MICRO_LABEL =
  'font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.09em] text-[color:var(--color-ink-soft)]'

const CHIP_BUTTON =
  'min-h-[36px] rounded-[2px] border px-2.5 py-1 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em]'

const ACTION_BUTTON =
  'min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-40'

function formatAgo(ts: number): string {
  const deltaMs = Date.now() - ts
  const minutes = Math.floor(deltaMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/** quick 260722-n5r — claim table grouping. */

/** The trailing group's key/label for any row whose `sectionName` doesn't
 * resolve to a known `EDITABLE_SECTIONS` id. */
const OTHER_GROUP_KEY = 'other'
const OTHER_GROUP_LABEL = 'Other'

interface ClaimGroup {
  key: string
  label: string
  rows: FullClaimRow[]
}

/**
 * Normalizes a claim row's `sectionName` to a matching `EDITABLE_SECTIONS`
 * id: (a) direct id match (the vocabulary `claim_checks.sectionName`
 * actually uses per verified fact), else (b) `qaSectionToGalleyId` as a
 * defensive fallback for any legacy snake_case rows. Unknown/missing ->
 * null (routes the row to the trailing "Other" group).
 */
function sectionGroupKeyFor(sectionName: string | undefined): string | null {
  if (!sectionName) return null
  if (EDITABLE_SECTIONS.some(section => section.id === sectionName)) return sectionName
  const mapped = qaSectionToGalleyId(sectionName)
  if (mapped && EDITABLE_SECTIONS.some(section => section.id === mapped)) return mapped
  return null
}

/** Reuses the SAME chip classifier every row already renders with — never a
 * second, forked notion of "must fix" / "unchecked" / "checked". */
function chipStateForRow(row: FullClaimRow) {
  return deriveClaimChipState({
    text: row.text,
    status: row.status,
    importance: row.importance,
    sourceUrl: row.sourceUrl,
    changedSinceCheck: row.changedSinceCheck,
  })
}

/** Builds ordered groups from the already-filtered rows: one group per
 * `EDITABLE_SECTIONS` entry (reading order) that has >=1 matching row
 * (empty sections are skipped, not rendered as empty groups), then a
 * trailing "Other" group if any row didn't resolve to a known section. */
function buildClaimGroups(filteredRows: FullClaimRow[]): ClaimGroup[] {
  const groups: ClaimGroup[] = []
  for (const section of EDITABLE_SECTIONS) {
    const sectionRows = filteredRows.filter(
      row => sectionGroupKeyFor(row.sectionName) === section.id,
    )
    if (sectionRows.length > 0) {
      groups.push({ key: section.id, label: section.label, rows: sectionRows })
    }
  }
  const otherRows = filteredRows.filter(row => sectionGroupKeyFor(row.sectionName) === null)
  if (otherRows.length > 0) {
    groups.push({ key: OTHER_GROUP_KEY, label: OTHER_GROUP_LABEL, rows: otherRows })
  }
  return groups
}

/** All-checked -> collapsed by default; ANY must-fix/unchecked/changed/
 * review-recommended row in the group -> open by default (a problem group
 * should never start hidden). */
function defaultCollapsedFor(group: ClaimGroup): boolean {
  return group.rows.every(row => chipStateForRow(row) === 'checked')
}

/** DERIVED-STATE-CONTRACT §9-style comparison card for "Ask agent for
 * better evidence" — Original (strikethrough) | Proposed + "What changed". */
function EvidenceComparisonCard({
  original,
  preview,
  busy,
  onConfirm,
  onDiscard,
}: {
  original: string
  preview: EvidencePreviewResult
  busy: boolean
  onConfirm: () => void
  onDiscard: () => void
}) {
  // ROL-03 (D-09): "Confirm evidence replacement" shares the Apply-revision
  // lock — no distinct label. Presentation-only (D-11); the server
  // `_require_editor` dependency (Plan 49-03) is the authoritative gate.
  const isLocked = useRole() !== 'Editor-in-chief'
  return (
    <div
      className="flex flex-col gap-2 border border-[color:var(--color-marigold)] bg-white p-3"
      data-testid="evidence-comparison-card"
    >
      <h4 className={MICRO_LABEL}>Ask agent for better evidence — comparison</h4>
      <p className="text-[13px] leading-snug text-[color:var(--color-ink-soft)] line-through">
        {original}
      </p>
      <p className="text-[13px] leading-snug text-[color:var(--color-ink)]">
        {preview.rewrittenClaim}
      </p>
      <p className="text-[12px] text-[color:var(--color-ink-soft)]">
        What changed: replaced the unsourced claim with a version supported by{' '}
        {preview.sourcePublisher}.
      </p>
      <a
        href={preview.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[12px] font-medium text-[color:var(--color-marigold-text)] underline"
      >
        {preview.sourcePublisher}
      </a>
      <div className="flex gap-2">
        <LockedControl isLocked={isLocked} lockedLabel="Apply revision 🔒 editor only">
          <button type="button" disabled={busy} className={ACTION_BUTTON} onClick={onConfirm}>
            Confirm replacement
          </button>
        </LockedControl>
        <button type="button" disabled={busy} className={ACTION_BUTTON} onClick={onDiscard}>
          Discard
        </button>
      </div>
    </div>
  )
}

export default function FactCheckScreen({ runId }: FactCheckScreenProps) {
  const { getToken } = useAuth()
  const { setPanelContent, claimRows: leanClaimRows } = useWorkspaceState()
  const { openInspector } = useInspector()
  const setStatus = useMutation(api.claimChecks.setStatus)

  // Checker Warning 2 (MANDATED) — full rows, not the provider's lean
  // projection. `undefined` = loading, `[]` = loaded-and-empty, both handled
  // explicitly below (never a fake verified state).
  const rows = useQuery(api.claimChecks.listByRunId, { runId }) as FullClaimRow[] | undefined

  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [selectedClaimIndex, setSelectedClaimIndex] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [evidence, setEvidence] = useState<EvidencePreviewResult | null>(null)
  // quick 260722-n5r — per-group collapse state. Undefined for a key means
  // "use the computed default" (all-checked -> collapsed); once the
  // operator toggles a group, the override wins regardless of the computed
  // default on subsequent renders.
  const [collapseOverrides, setCollapseOverrides] = useState<Record<string, boolean>>({})

  const selectedRow = rows?.find(r => r.claimIndex === selectedClaimIndex) ?? null

  function toggleFilter(id: string) {
    setActiveFilters(prev => (prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]))
  }

  function selectClaim(claimIndex: number) {
    setActionError(null)
    setEvidence(null)
    setSelectedClaimIndex(prev => (prev === claimIndex ? null : claimIndex))
  }

  async function withBusy(fn: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setActionError(null)
    try {
      await fn()
    } catch (e) {
      setActionError(
        e instanceof FactCheckError
          ? e.message
          : e instanceof ContentPatchError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Action failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  /** Obtains a FRESH ifRevisionID immediately before any content-touching
   * apply (checker Warning 3) — mirrors ReviewDeskRunView.reloadDraft. */
  async function freshRevisionId(token: string | null): Promise<string> {
    const draft = await getDraft(runId, token)
    return draft.revisionId
  }

  function handleConfirm() {
    if (selectedClaimIndex === null) return
    void withBusy(async () => {
      await setStatus({ runId, claimIndex: selectedClaimIndex, status: 'checked' })
    })
  }

  function handleKeep(reason: string) {
    if (selectedClaimIndex === null) return
    void withBusy(async () => {
      const token = await getToken()
      await keepClaim(runId, selectedClaimIndex, reason, token)
    })
  }

  function handleEdit(newText: string) {
    if (selectedClaimIndex === null) return
    void withBusy(async () => {
      const token = await getToken()
      const ifRevisionID = await freshRevisionId(token)
      await patchClaim(runId, selectedClaimIndex, { ifRevisionID, text: newText }, token)
    })
  }

  function handleReplaceSource(sourceUrl: string) {
    if (selectedClaimIndex === null) return
    void withBusy(async () => {
      const token = await getToken()
      await replaceSource(runId, selectedClaimIndex, { sourceUrl }, token)
    })
  }

  function handleRemove(reason?: string) {
    if (selectedClaimIndex === null) return
    void withBusy(async () => {
      const token = await getToken()
      await removeClaim(runId, selectedClaimIndex, reason, token)
      setSelectedClaimIndex(null)
    })
  }

  function handleAskAgent() {
    if (selectedClaimIndex === null) return
    void withBusy(async () => {
      const token = await getToken()
      const preview = await evidencePreview(runId, selectedClaimIndex, token)
      setEvidence(preview)
    })
  }

  function handleConfirmEvidence() {
    if (selectedClaimIndex === null || !evidence) return
    void withBusy(async () => {
      const token = await getToken()
      const ifRevisionID = await freshRevisionId(token)
      await evidenceApply(
        runId,
        selectedClaimIndex,
        {
          ifRevisionID,
          sourceUrl: evidence.sourceUrl,
          retrievedAt: evidence.retrievedAt,
          rewrittenClaim: evidence.rewrittenClaim,
        },
        token,
      )
      setEvidence(null)
    })
  }

  function handleDiscardEvidence() {
    setEvidence(null)
  }

  // ── Publish into the frame's single persistent context panel (D-19) ──────
  // No selection -> the same default coverage-summary content
  // FactCheckPanelPublisher (page.tsx) already publishes, reused here via
  // the shared `buildFactCheckPanelContent` so cleanup/deselect restores it
  // exactly, without needing a reference back to that sibling component.
  useEffect(() => {
    if (!selectedRow) {
      setPanelContent(buildFactCheckPanelContent(leanClaimRows))
      return
    }

    const claimView: ClaimProvenanceView = {
      text: selectedRow.text,
      importance: selectedRow.importance,
      status: selectedRow.status,
      sourceUrl: selectedRow.sourceUrl,
      supportingPassage: selectedRow.context,
      retrievedAt: selectedRow.retrievedAt,
      sectionName: selectedRow.sectionName,
      changedSinceCheck: selectedRow.changedSinceCheck,
    }

    setPanelContent(
      <div className="flex flex-col gap-3">
        <ClaimProvenanceCard
          claim={claimView}
          busy={busy}
          actions={{
            onConfirm: handleConfirm,
            onEdit: handleEdit,
            onReplaceSource: handleReplaceSource,
            onAskAgent: handleAskAgent,
            onRemove: handleRemove,
            onKeep: handleKeep,
            // Phase 44 (INS-01) — flips ClaimProvenanceCard's already-present
            // Inspect button from disabled to live. Locator is the claim's
            // stable claimIndex (see file header comment above).
            onInspect: () =>
              openInspector({ type: 'claim', runId, locator: String(selectedRow.claimIndex) }),
          }}
        />
        {actionError && (
          <p role="alert" className="text-xs text-[color:var(--color-vermilion)]">
            {actionError}
          </p>
        )}
        {evidence && (
          <EvidenceComparisonCard
            original={selectedRow.text}
            preview={evidence}
            busy={busy}
            onConfirm={handleConfirmEvidence}
            onDiscard={handleDiscardEvidence}
          />
        )}
      </div>,
    )

    return () => {
      setPanelContent(buildFactCheckPanelContent(leanClaimRows))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRow, busy, actionError, evidence, leanClaimRows, setPanelContent, openInspector])

  const summary = rows ? deriveFactCheckSummary(rows) : null
  const filteredRows = rows ? applyFilters(rows, activeFilters) : []
  // quick 260722-n5r — grouped-by-section claim list (reading order, "Other"
  // trailing). Purely a render reorganization of the same `filteredRows`.
  const claimGroups = buildClaimGroups(filteredRows)

  function isGroupCollapsed(group: ClaimGroup): boolean {
    return collapseOverrides[group.key] ?? defaultCollapsedFor(group)
  }

  function toggleGroup(group: ClaimGroup) {
    setCollapseOverrides(prev => ({ ...prev, [group.key]: !isGroupCollapsed(group) }))
  }

  function groupCounts(group: ClaimGroup): { mustFix: number; unchecked: number } {
    let mustFix = 0
    let unchecked = 0
    for (const row of group.rows) {
      const chip = chipStateForRow(row)
      if (chip === 'must-fix') mustFix += 1
      if (chip === 'unchecked') unchecked += 1
    }
    return { mustFix, unchecked }
  }

  return (
    <div className="flex min-h-[60vh] flex-col gap-4 p-6">
      <div className="flex flex-col items-start gap-2 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[color:var(--color-ink)]">
          Fact Check
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
          Confirm, edit, or replace the source for every extracted claim. Blank never means
          verified — every counter below is always shown, even at zero.
        </p>
      </div>

      <section
        aria-label="Fact check summary"
        className="border border-[color:var(--color-faint)] bg-white p-4"
      >
        <h2 className={MICRO_LABEL}>Coverage</h2>
        {rows === undefined ? (
          <div data-testid="fact-check-coverage-loading">
            <SkeletonLine className="mt-1 h-4 w-32" />
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-1 text-[13px] italic text-[color:var(--color-ink-soft)]">
            No claims extracted yet
          </p>
        ) : (
          summary && (
            <div className="mt-1 flex flex-col gap-0.5 text-[13px] text-[color:var(--color-ink)]">
              <p>checked {summary.factCoverage}</p>
              <p className="text-[color:var(--color-ink-soft)]">
                {summary.mustFixCount} must fix · {summary.uncheckedCount} unchecked ·{' '}
                {summary.conflictsCount} conflicting sources · {summary.checksNotRunCount} checks
                not run · {summary.changedCount} changed since check
              </p>
              {summary.lastVerifiedAt ? (
                <p className="text-[color:var(--color-green,#148a52)]">
                  last verified {formatAgo(summary.lastVerifiedAt)}
                </p>
              ) : (
                <p className="text-[color:var(--color-ink-soft)]">not yet verified</p>
              )}
            </div>
          )
        )}
      </section>

      {rows !== undefined && rows.length > 0 && (
        <>
          <div className="flex items-center gap-1.5">
            <h2 className={MICRO_LABEL}>Claims</h2>
            <HelpTip text={HELP_COPY.factCheck.claimMark} label="Explain claim marks" />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Claim filters">
            {FACT_CHECK_FILTERS.map(f => {
              const active = activeFilters.includes(f.id)
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleFilter(f.id)}
                  className={`${CHIP_BUTTON} ${
                    active
                      ? 'border-[color:var(--color-cobalt)] bg-[color:var(--color-cobalt)] text-white'
                      : 'border-[color:var(--color-faint)] bg-white text-[color:var(--color-ink)]'
                  }`}
                >
                  {f.label}
                </button>
              )
            })}
          </div>

          <section aria-label="Claims" className="flex flex-col gap-3">
            {filteredRows.length === 0 ? (
              <p className="text-[13px] italic text-[color:var(--color-ink-soft)]">
                No claims match the active filters.
              </p>
            ) : (
              claimGroups.map(group => {
                const collapsed = isGroupCollapsed(group)
                const { mustFix, unchecked } = groupCounts(group)
                return (
                  <div key={group.key} className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group)}
                      aria-expanded={!collapsed}
                      className="flex min-h-[44px] w-full items-center justify-between gap-2 border border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] px-3 py-2 text-left"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="text-[11px] text-[color:var(--color-ink-soft)]"
                        >
                          {collapsed ? '▸' : '▾'}
                        </span>
                        <span className={MICRO_LABEL}>{group.label}</span>
                      </span>
                      <span className="text-[12px] text-[color:var(--color-ink-soft)]">
                        {group.rows.length} claims · {mustFix} must fix · {unchecked} unchecked
                      </span>
                    </button>
                    {!collapsed && (
                      <ul className="flex flex-col gap-1.5">
                        {group.rows.map(row => {
                          const chip = deriveClaimChipState({
                            text: row.text,
                            status: row.status,
                            importance: row.importance,
                            sourceUrl: row.sourceUrl,
                            changedSinceCheck: row.changedSinceCheck,
                          })
                          const selected = row.claimIndex === selectedClaimIndex
                          return (
                            <li key={row.claimIndex}>
                              <button
                                type="button"
                                aria-pressed={selected}
                                data-testid={`fact-check-row-${row.claimIndex}`}
                                onClick={() => selectClaim(row.claimIndex)}
                                className={`w-full border p-2 text-left ${
                                  selected
                                    ? 'border-[color:var(--color-cobalt)] bg-[color:var(--color-card-alt)]'
                                    : 'border-[color:var(--color-faint)] bg-white'
                                }`}
                              >
                                <p className="text-[13px] leading-snug text-[color:var(--color-ink)]">
                                  {row.text}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span className={MICRO_LABEL}>
                                    <span aria-hidden="true">
                                      {chip === 'checked'
                                        ? '✓'
                                        : chip === 'must-fix'
                                          ? '✕'
                                          : chip === 'changed'
                                            ? '⟳'
                                            : chip === 'review-recommended'
                                              ? '△'
                                              : '○'}
                                    </span>{' '}
                                    {chip === 'checked'
                                      ? 'Checked'
                                      : chip === 'must-fix'
                                        ? 'Must fix'
                                        : chip === 'changed'
                                          ? 'Changed'
                                          : chip === 'review-recommended'
                                            ? 'Review recommended'
                                            : 'Unchecked'}
                                  </span>
                                  <span className={MICRO_LABEL}>
                                    {row.importance ?? 'Supporting'}
                                  </span>
                                  <span className={MICRO_LABEL}>
                                    {row.sourceUrl ? 'Sourced' : 'Unsourced'}
                                  </span>
                                </div>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })
            )}
          </section>
        </>
      )}
    </div>
  )
}
