'use client'
/**
 * Section-chip jump-nav list (Phase 31 D-02, Plan 31-04 Task 3).
 *
 * Phase 32 (GLY-05, D-03, Plan 32-07 Task 1) upgrades this component IN
 * PLACE into the design's chip strip: an optional `counts` prop drives a
 * severity-tinted open-finding badge plus an unresolved marker, so the same
 * strip serves both the galley's jump-nav (click -> scroll-to-section,
 * wired by the parent page) and the Phase 31 editor's section selector.
 *
 * Presentational only: the parent page owns `selectedSection` state, the
 * `counts` computation (via the span resolver), and all save wiring. Each
 * chip is a keyboard-focusable <button> with a >=44px hit target; `dirty`
 * drives the unsaved-edit dot (D-07 dirty-state).
 *
 * quick 260722-n5r (Draft nav de-duplication): added an `orientation` prop
 * ('vertical' default | 'horizontal'). `ReviewDeskRunView` (the ONLY
 * consumer of this default export — `WorkspaceOutline` imports only the
 * named `EDITABLE_SECTIONS` export below) now renders this strip
 * horizontally as the section selector inside edit mode only; galley mode
 * no longer nests a second, duplicate vertical copy of this list (the
 * frame's `WorkspaceOutline` already provides galley jump-nav).
 */

// Phase 51 (D-17) — EDITABLE_SECTIONS/SectionMeta promoted to lib/editableSections.ts
// so shared, non-route-scoped modules can import them without reaching into
// this route-private _components folder. Re-exported here so every existing
// importer of this file keeps compiling with zero edits.
import { EDITABLE_SECTIONS, type SectionMeta } from '@/lib/editableSections'
export { EDITABLE_SECTIONS }
export type { SectionMeta }

/**
 * Per-section open-finding tally (D-08: accepted findings are excluded
 * upstream — the galley is a to-do surface, not an archive). `open` and
 * `unresolved` are always supplied by the parent; the per-severity breakdown
 * is optional so callers that only need the aggregate + unresolved flag
 * (e.g. tests) can supply a narrower shape.
 */
export interface SectionChipCounts {
  open: number
  unresolved: number
  error?: number
  warning?: number
  info?: number
}

interface SectionChipListProps {
  sections?: SectionMeta[]
  selected: string
  onSelect: (id: string) => void
  dirty?: Record<string, boolean>
  counts?: Record<string, SectionChipCounts>
  /** quick 260722-n5r — 'vertical' (default, unchanged) is the jump-nav
   * column layout; 'horizontal' wraps chips in a row (used as the edit-mode
   * section selector strip). */
  orientation?: 'vertical' | 'horizontal'
}

/** Highest-severity present -> the 1c token that tints the count badge (D-07). */
function badgeColorFor(counts: SectionChipCounts | undefined): string {
  if (counts && (counts.error ?? 0) > 0) return 'var(--color-vermilion)'
  if (counts && (counts.warning ?? 0) > 0) return 'var(--color-marigold-text)'
  return 'var(--color-cobalt)'
}

export default function SectionChipList({
  sections = EDITABLE_SECTIONS,
  selected,
  onSelect,
  dirty = {},
  counts = {},
  orientation = 'vertical',
}: SectionChipListProps) {
  return (
    <nav
      aria-label="Editable sections"
      className={orientation === 'horizontal' ? 'flex flex-wrap gap-1.5' : 'flex flex-col gap-1'}
    >
      {sections.map(section => {
        const isSelected = section.id === selected
        const isDirty = Boolean(dirty[section.id])
        const sectionCounts = counts[section.id]
        const openCount = sectionCounts?.open ?? 0
        const unresolvedCount = sectionCounts?.unresolved ?? 0
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            aria-current={isSelected ? 'true' : undefined}
            data-unresolved={unresolvedCount > 0 ? 'true' : undefined}
            className={
              isSelected
                ? 'flex min-h-[44px] items-center justify-between gap-2 rounded-[2px] bg-[color:var(--color-cobalt)] px-3 py-2 text-left font-[family-name:var(--font-ui)] text-[12.5px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]'
                : 'flex min-h-[44px] items-center justify-between gap-2 rounded-[2px] px-3 py-2 text-left font-[family-name:var(--font-ui)] text-[12.5px] font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]'
            }
          >
            <span>{section.label}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              {openCount > 0 && (
                <span
                  data-testid="chip-count"
                  className="inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-white"
                  style={{ backgroundColor: badgeColorFor(sectionCounts) }}
                >
                  {openCount}
                </span>
              )}
              {unresolvedCount > 0 && (
                <span
                  aria-label={`${unresolvedCount} unresolved`}
                  title={`${unresolvedCount} unresolved`}
                  className="text-[12px] font-bold leading-none text-[color:var(--color-vermilion)]"
                >
                  !
                </span>
              )}
              {isDirty && (
                <span
                  aria-label="Unsaved changes"
                  title="Unsaved changes"
                  className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--color-vermilion)]"
                />
              )}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
