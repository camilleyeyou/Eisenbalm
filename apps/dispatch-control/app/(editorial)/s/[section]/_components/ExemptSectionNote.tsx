'use client'
/**
 * Phase 51 (D-14) — the structurally-exempt-section note.
 *
 * Four of the nine editable sections carry no QA `sectionName` mapping
 * (`lib/galley/sectionIdMap.ts`'s `GALLEY_TO_QA`) and therefore no inline
 * findings to mark; the bonus section is exempt too, but only for its two
 * non-prose variants (`jingle`/`bigBudget` — `specAd` is annotated exactly
 * like the four long-reads). Each states plainly what it is rather than
 * looking empty or broken (D-14) — the exact strings below are quoted
 * from 51-UI-SPEC.md's Navigation & Section States Contract; quick 261021-ind
 * reworded the tail so it no longer implies findings to review.
 */

const EXEMPT_NOTES = {
  game: 'This section renders as an interactive game — the agents check it as a whole.',
  podcast: 'This section is an audio player — the agents check it as a whole.',
  theme:
    "This section sets the issue's color and font palette — the agents check it as a whole.",
  'deliberation-conversation':
    "This section shows the agents' deliberation as a conversation — the agents check it as a whole.",
  'bonus-jingle':
    "This week's bonus is an audio jingle — the agents check it as a whole.",
  'bonus-bigBudget':
    "This week's bonus is a storyboard set — the agents check it as a whole.",
} as const

export type ExemptSectionKind = keyof typeof EXEMPT_NOTES

interface ExemptSectionNoteProps {
  kind: ExemptSectionKind
}

export default function ExemptSectionNote({ kind }: ExemptSectionNoteProps) {
  return (
    <p
      className="galley-body italic text-[color:var(--color-ink-soft)]"
      style={{ marginTop: 16 }}
    >
      {EXEMPT_NOTES[kind]}
    </p>
  )
}
