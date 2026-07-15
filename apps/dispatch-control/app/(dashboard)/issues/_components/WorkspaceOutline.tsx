'use client'
/**
 * Phase 41 Plan 41-05 (WSP-02/WSP-07) — WorkspaceOutline.
 *
 * The persistent issue outline: one row per `EDITABLE_SECTIONS` entry, each
 * carrying a LABEL + ICON 5-state mark (never color alone) — clean / review
 * / must fix / changed since review / not generated — sourced from
 * `useWorkspaceState().sectionStates` (Plan 41-05 Task 1's provider, which
 * in turn sources presence from the SAME authoritative draft the Stage-2
 * canvas reads — 41-08). Clicking a row scrolls the galley to that section
 * via the shared `galleyAnchorFor` helper (de-duplicated into
 * `lib/galley/sectionIdMap.ts` on this, its third use).
 *
 * WSP-07: 'not-generated' is a visible first-class marker, never a blank
 * row. Its mirror-image concern — a section silently mislabeled
 * 'not-generated' while the draft is still loading (the plan-review
 * blocker) — is guarded by rendering a LOADING state whenever
 * `sectionStates` is `undefined`, never inferring a wall of "not generated"
 * from an as-yet-unloaded draft.
 *
 * A small legend lists all five state labels (so the vocabulary is visible
 * even for 'changed-since-review', which the 41-01 selector never actually
 * produces this phase).
 */
import { CheckCircle2, AlertCircle, AlertTriangle, RefreshCw, Circle } from 'lucide-react'
import type { SectionState } from '@/lib/derivedState'
import { useWorkspaceState } from './WorkspaceStateProvider'
import { EDITABLE_SECTIONS } from '../../review-desk/[runId]/_components/SectionChipList'
import { galleyAnchorFor } from '@/lib/galley/sectionIdMap'

/** The 5-value outline vocabulary — distinct wording from `StageState` (Pitfall 4). */
export const SECTION_STATE_LABELS: Record<SectionState, string> = {
  clean: 'Clean',
  review: 'Review',
  'must-fix': 'Must fix',
  'changed-since-review': 'Changed since review',
  'not-generated': '— not generated',
}

function SectionStateIcon({ state }: { state: SectionState }) {
  switch (state) {
    case 'clean':
      return (
        <CheckCircle2
          size={14}
          className="shrink-0 text-[color:var(--color-green)]"
          aria-hidden="true"
        />
      )
    case 'review':
      return (
        <AlertCircle
          size={14}
          className="shrink-0 text-[color:var(--color-marigold)]"
          aria-hidden="true"
        />
      )
    case 'must-fix':
      return (
        <AlertTriangle
          size={14}
          className="shrink-0 text-[color:var(--color-vermilion)]"
          aria-hidden="true"
        />
      )
    case 'changed-since-review':
      return (
        <RefreshCw
          size={14}
          className="shrink-0 text-[color:var(--color-cobalt)]"
          aria-hidden="true"
        />
      )
    case 'not-generated':
      return (
        <Circle
          size={14}
          className="shrink-0 text-[color:var(--color-faint)]"
          aria-hidden="true"
        />
      )
  }
}

function jumpToSection(sectionId: string) {
  const anchor = galleyAnchorFor(sectionId)
  if (!anchor) return
  document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** The vocabulary legend — visible even for states that never fire this phase. */
function OutlineLegend() {
  const states = Object.keys(SECTION_STATE_LABELS) as SectionState[]
  return (
    <ul
      aria-label="Section state legend"
      className="flex flex-wrap gap-x-3 gap-y-1 border-b border-[color:var(--color-ink)]/[.08] pb-2"
    >
      {states.map(state => (
        <li
          key={state}
          data-testid={`outline-legend-${state}`}
          className="flex items-center gap-1 font-[family-name:var(--font-ui)] text-[10.5px] text-[color:var(--color-ink-soft)]"
        >
          <SectionStateIcon state={state} />
          {SECTION_STATE_LABELS[state]}
        </li>
      ))}
    </ul>
  )
}

export default function WorkspaceOutline() {
  const { sectionStates } = useWorkspaceState()

  return (
    <nav aria-label="Issue outline" className="flex flex-col gap-3">
      <OutlineLegend />
      {sectionStates === undefined ? (
        <p
          data-testid="outline-loading"
          className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]"
        >
          Loading outline…
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {EDITABLE_SECTIONS.map(section => {
            const result = sectionStates[section.id]
            // Defensive fallback only — `deriveSectionStates` always returns
            // one entry per EDITABLE_SECTIONS id; a missing key would itself
            // be a bug, not a legitimate "not generated" inference here
            // (that inference happens upstream, once, in the provider).
            const state: SectionState = result?.state ?? 'not-generated'
            const openCount = result?.openCount ?? 0
            return (
              <li key={section.id}>
                <button
                  type="button"
                  data-testid={`outline-row-${section.id}`}
                  onClick={() => jumpToSection(section.id)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 px-2 py-1.5 text-left font-[family-name:var(--font-ui)] text-[12.5px] font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]"
                >
                  <span>{section.label}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <SectionStateIcon state={state} />
                    <span className="text-[11px] text-[color:var(--color-ink-soft)]">
                      {SECTION_STATE_LABELS[state]}
                      {state !== 'not-generated' && openCount > 0 ? ` · ${openCount}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </nav>
  )
}
