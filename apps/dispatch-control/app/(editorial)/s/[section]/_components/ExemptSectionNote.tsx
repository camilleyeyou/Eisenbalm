'use client'
/**
 * Phase 56 -- one plain sentence for the parts that cannot be edited here.
 */
const NOTES = {
  game: "This part is a small game readers play on the website. You can try it below. It can't be changed here.",
  podcast: "This part is the week's audio. Listen below. It can't be changed here.",
  theme: "These are the colours and fonts for this issue. They can't be changed here.",
  deliberation: "This is how the writers chose this week's charity. It can't be changed here.",
  'bonus-media': "This bonus is a recording or a big picture, not text. It can't be changed here.",
} as const

export type ExemptSectionKind = keyof typeof NOTES

export default function ExemptSectionNote({ kind }: { kind: ExemptSectionKind }) {
  return (
    <p className="max-w-[720px] font-[family-name:var(--font-lora)] text-[17px] text-[color:var(--color-ink-soft)]">
      {NOTES[kind]}
    </p>
  )
}
