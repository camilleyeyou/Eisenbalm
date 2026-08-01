/**
 * Phase 51 (D-17) — canonical home for the nine editable sections.
 *
 * Promoted OUT of app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx
 * so shared selectors (lib/derivedState.ts) and the new (editorial) route group
 * can import it without reaching upward into an old-console route-private
 * _components folder. SectionChipList.tsx re-exports both symbols so every
 * existing importer keeps compiling unchanged.
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
