'use client'
/**
 * Phase 33 (D-04, Plan 33-05 Task 2) — the collapsed resolved-findings list
 * at the foot of the decision rail.
 *
 * This is the ONLY operator surface exposing resolved (accepted/dismissed)
 * findings — the galley hides them per D-03 — and therefore the only place
 * `reopenFinding` is reachable (RESEARCH Open Question 2). Reopen clears the
 * resolution server-side and Convex reactivity re-adds the finding to the
 * galley spans, chip counts, and the rail's blockers checklist — no manual
 * refetch, and the applied text is never rolled back (D-04: Andrew re-edits
 * via the section editor if the accepted change needs reversing).
 *
 * Resolved = the complement of the shared isOpenFinding predicate (Pitfall
 * 9), so this list and the open surfaces can never disagree about a row.
 * Badge: `resolution` when present, else legacy `accepted===true` ⇒
 * "accepted".
 *
 * Phase 36 (§36.3, Plan 36-04 Task 4): this is Review Desk's FACTUAL_AXES
 * rail — the resolved list is further scoped to factual findings (undefined
 * axis still counts as factual, per §36.3's conservative default) so a
 * resolved voice/machine-tell row never appears here; it belongs to Voice
 * Pass's own surface instead.
 *
 * Muted/tertiary treatment by design — a secondary, collapsed affordance
 * that must not compete with the blockers checklist above it.
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { reopenFinding, FindingsError } from '@/lib/findingsClient'
import { isOpenFinding } from '@/lib/galley/findingState'
import { FACTUAL_AXES } from '@/lib/galley/axisPartition'

interface ResolvedFindingsListProps {
  runId: string
}

/** Minimal shape needed from a live `qaCorrections` row (matches page.tsx). */
interface QaCorrectionRow {
  _id: string
  findingId?: string
  sectionName: string
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  accepted?: boolean
  resolution?: 'accepted' | 'dismissed'
  resolutionReason?: string
}

function badgeFor(row: QaCorrectionRow): 'accepted' | 'dismissed' {
  return row.resolution ?? (row.accepted ? 'accepted' : 'dismissed')
}

export default function ResolvedFindingsList({ runId }: ResolvedFindingsListProps) {
  const { getToken } = useAuth()

  const rows = useQuery(api.qaCorrections.byRunId, { runId }) as
    | QaCorrectionRow[]
    | undefined
  // Phase 36 (§36.3): resolved AND factual (axis undefined || FACTUAL_AXES) —
  // a resolved voice-axis row belongs to Voice Pass, not this factual rail.
  const resolved = (rows ?? []).filter(
    r => !isOpenFinding(r) && (r.axis === undefined || FACTUAL_AXES.has(r.axis)),
  )

  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Per-row inline note (e.g. the 409 not_resolved "already open" case).
  const [notes, setNotes] = useState<Record<string, string>>({})

  async function handleReopen(row: QaCorrectionRow) {
    const findingId = row.findingId ?? row._id
    setBusyId(row._id)
    setNotes(prev => ({ ...prev, [row._id]: '' }))
    try {
      const token = await getToken()
      await reopenFinding(runId, findingId, token)
      // Success needs no local state change — Convex reactivity drops the row
      // from `resolved` and re-adds it to every open surface (D-04). The
      // applied text stays as-is and the draft is never refetched here.
    } catch (e) {
      const note =
        e instanceof FindingsError && e.reason === 'not_resolved'
          ? 'This finding is already open.'
          : e instanceof Error
            ? e.message
            : 'Reopen failed.'
      setNotes(prev => ({ ...prev, [row._id]: note }))
    } finally {
      setBusyId(null)
    }
  }

  if (rows === undefined) {
    return (
      <p className="text-[12px] text-[color:var(--color-faint)]">Loading…</p>
    )
  }

  return (
    <div className="border-t border-[color:var(--color-faint)] pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="min-h-[44px] w-full text-left font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.08em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
      >
        Resolved ({resolved.length}) {open ? '▴' : '▾'}
      </button>

      {/* Never blank: the empty state shows even while collapsed. */}
      {resolved.length === 0 && (
        <p className="text-[12px] italic text-[color:var(--color-ink-soft)]">
          No resolved findings yet
        </p>
      )}

      {open &&
        (resolved.length === 0 ? null : (
          <ul className="mt-1 flex flex-col gap-2">
            {resolved.map(row => (
              <li
                key={row._id}
                className="border border-[color:var(--color-faint)] bg-white/60 p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
                    {row.sectionName}
                  </span>
                  <span
                    className={
                      'font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] ' +
                      (badgeFor(row) === 'accepted'
                        ? 'text-[color:var(--color-green,#148a52)]'
                        : 'text-[color:var(--color-ink-soft)]')
                    }
                  >
                    {badgeFor(row)}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-snug text-[color:var(--color-ink-soft)]">
                  {row.reason.length > 120 ? `${row.reason.slice(0, 120)}…` : row.reason}
                </p>
                {row.resolutionReason && (
                  <p className="mt-0.5 text-[11px] italic text-[color:var(--color-faint)]">
                    “{row.resolutionReason}”
                  </p>
                )}
                <button
                  type="button"
                  disabled={busyId === row._id}
                  onClick={() => handleReopen(row)}
                  className="mt-1 min-h-[44px] px-2 font-[family-name:var(--font-ui)] text-[11px] font-medium uppercase tracking-[.06em] text-[color:var(--color-cobalt,#253ad4)] hover:underline disabled:opacity-40"
                >
                  Reopen
                </button>
                {notes[row._id] && (
                  <p role="status" className="text-[11px] text-[color:var(--color-ink-soft)]">
                    {notes[row._id]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}
