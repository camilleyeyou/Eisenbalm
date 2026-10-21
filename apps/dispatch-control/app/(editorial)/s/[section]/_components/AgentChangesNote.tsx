'use client'
/**
 * Quick 261021-7aw — a quiet, read-only "what the agents changed" note for one
 * section. The pipeline agents fix their own QA findings before the draft
 * reaches the editor; this lists those applied fixes ("old" -> "new") so
 * nothing is invisible. No buttons, no actions, no prompts. Renders nothing
 * when the agents changed nothing in this section.
 *
 * The caller filters rows to this section and resolution 'agent-applied'.
 */
export interface AgentChangeRow {
  _id: string
  quotedSpan?: string
  suggestedFix?: string
  reason: string
}

export default function AgentChangesNote({ rows }: { rows: AgentChangeRow[] }) {
  if (rows.length === 0) return null
  return (
    <details className="galley-body mt-6 text-[13px] text-[color:var(--color-ink-soft)]">
      <summary className="cursor-pointer">What the agents changed ({rows.length})</summary>
      <ul className="mt-2 list-disc pl-5">
        {rows.map((row) => (
          <li key={row._id}>
            {row.quotedSpan && row.suggestedFix
              ? `“${row.quotedSpan}” → “${row.suggestedFix}”`
              : row.reason}
          </li>
        ))}
      </ul>
    </details>
  )
}
