'use client'
/**
 * Section-chip jump-nav list (Phase 31 D-02, Plan 31-04 Task 3).
 *
 * A precursor to the design's galley "section-status chip strip"
 * (docs/design/dispatch-control-v2/README.md) — Phase 32 upgrades this
 * component in place once the native galley lands, so no route/prop rework
 * is needed later.
 *
 * Presentational only: the parent page owns `selectedSection` state and all
 * save wiring (Plan 05). Each chip is a keyboard-focusable <button> with a
 * >=44px hit target; the `dirty` prop drives an unsaved-edit dot indicator
 * (D-07 dirty-state).
 */

export interface SectionMeta {
  id: string
  label: string
}

/** The 9 editable surfaces, in reading order (RESEARCH Field Inventory). */
export const EDITABLE_SECTIONS: SectionMeta[] = [
  { id: 'originStory', label: 'Origin Story' },
  { id: 'problemStatement', label: 'Problem' },
  { id: 'founderBio', label: 'Founder Bio' },
  { id: 'caseStudy', label: 'Case Study' },
  { id: 'bonus', label: 'Bonus' },
  { id: 'game', label: 'Game' },
  { id: 'deliberation-conversation', label: 'Deliberation' },
  { id: 'podcast', label: 'Podcast' },
  { id: 'theme', label: 'Theme' },
]

interface SectionChipListProps {
  sections?: SectionMeta[]
  selected: string
  onSelect: (id: string) => void
  dirty?: Record<string, boolean>
}

export default function SectionChipList({
  sections = EDITABLE_SECTIONS,
  selected,
  onSelect,
  dirty = {},
}: SectionChipListProps) {
  return (
    <nav aria-label="Editable sections" className="flex flex-col gap-1">
      {sections.map(section => {
        const isSelected = section.id === selected
        const isDirty = Boolean(dirty[section.id])
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            aria-current={isSelected ? 'true' : undefined}
            className={
              isSelected
                ? 'flex min-h-[44px] items-center justify-between gap-2 rounded-[2px] bg-[color:var(--color-cobalt)] px-3 py-2 text-left font-[family-name:var(--font-ui)] text-[12.5px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]'
                : 'flex min-h-[44px] items-center justify-between gap-2 rounded-[2px] px-3 py-2 text-left font-[family-name:var(--font-ui)] text-[12.5px] font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]'
            }
          >
            <span>{section.label}</span>
            {isDirty && (
              <span
                aria-label="Unsaved changes"
                title="Unsaved changes"
                className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--color-vermilion)]"
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}
