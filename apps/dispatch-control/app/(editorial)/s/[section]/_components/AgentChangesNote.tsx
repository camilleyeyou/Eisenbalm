'use client'
/**
 * Phase 56 -- a quiet, closed-by-default list of what the writers changed in
 * this part. Items are plain sentences supplied by the page.
 */
interface AgentChangesNoteProps {
  count: number
  items: string[]
}

export default function AgentChangesNote({ count, items }: AgentChangesNoteProps) {
  if (count === 0) return null
  return (
    <details className="mt-10 max-w-[720px] font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-ink-soft)]">
      <summary className="min-h-[48px] cursor-pointer text-[17px] font-semibold text-[color:var(--color-ink)] flex items-center editor-focus">
        What the writers changed in this part ({count})
      </summary>
      <ul className="mt-2 list-disc pl-5 flex flex-col gap-1">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </details>
  )
}
