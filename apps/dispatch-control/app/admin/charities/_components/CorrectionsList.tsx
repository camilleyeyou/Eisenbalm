'use client'
/**
 * Phase 39 — MEM-02: Corrections log (chronological, read-only).
 *
 * Renders a per-charity append-only corrections log via
 * charityCorrections.listByCharityKey (see 39-01). The query already
 * returns rows in createdAt-ascending order — this component does NOT
 * reverse them (oldest first, matching the durable-record intent).
 *
 * Read-only: no edit/delete/remove control exists — corrections are
 * append-only (D-05/D-06); a correction that needs fixing is superseded by
 * a NEW correction, never edited in place.
 */
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'

interface CorrectionsListProps {
  workspace_id: string
  charityKey: string
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 8) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export default function CorrectionsList({ workspace_id, charityKey }: CorrectionsListProps) {
  const corrections = useQuery(
    api.charityCorrections.listByCharityKey,
    charityKey ? { workspace_id, charityKey } : 'skip',
  )

  if (corrections === undefined) {
    return (
      <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
        Loading corrections…
      </p>
    )
  }

  if (corrections.length === 0) {
    return (
      <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
        No corrections yet.
      </p>
    )
  }

  return (
    <ul className="space-y-2" aria-label="Corrections log">
      {corrections.map(correction => (
        <li
          key={correction._id}
          className="border border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] p-3 font-[family-name:var(--font-ui)] text-[13px]"
        >
          <p className="text-[color:var(--color-ink)]">{correction.text}</p>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-ink-soft)]">
            {correction.author} · {formatRelativeTime(correction.createdAt)}
          </p>
        </li>
      ))}
    </ul>
  )
}
