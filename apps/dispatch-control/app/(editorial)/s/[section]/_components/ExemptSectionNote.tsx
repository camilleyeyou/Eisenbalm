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
 * verbatim from 51-UI-SPEC.md's Navigation & Section States Contract; never
 * paraphrased.
 */

const EXEMPT_NOTES = {
  game: 'This section renders as an interactive game — it carries no inline findings to review here.',
  podcast: 'This section is an audio player — it carries no inline findings to review here.',
  theme:
    "This section sets the issue's color and font palette — it carries no inline findings to review here.",
  'deliberation-conversation':
    "This section shows the agents' deliberation as a conversation — it carries no inline findings to review here.",
  'bonus-jingle':
    "This week's bonus is an audio jingle — it carries no inline findings to review here.",
  'bonus-bigBudget':
    "This week's bonus is a storyboard set — it carries no inline findings to review here.",
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
