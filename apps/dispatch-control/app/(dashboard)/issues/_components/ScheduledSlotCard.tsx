'use client'
/**
 * Phase 40 Plan 40-05 (§40-UI-SPEC, ISS-03, D-10/D-11/D-13) — the next
 * scheduled slot: the reserved `issueNumber`, the deterministic repetition
 * note (D-10, no LLM call), and "Start #{n} early".
 *
 * Marigold-wash secondary card — narrower than `IssueCard`, no stage strip,
 * Heading size (never Display). "Start it early" (D-13) calls the EXISTING
 * run trigger with the reserved issueNumber, then navigates straight to the
 * issue overview — once Phase 41 lands, the same navigation drops the
 * operator into the Workspace with no rework here.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { triggerRun } from '@/lib/pipelineControlClient'
import { issueHref } from '@/lib/issueRouteResolver'

export interface ScheduledSlotCardProps {
  issueNumber: number
  scheduledForLabel: string
  note: string | null
}

export default function ScheduledSlotCard({
  issueNumber,
  scheduledForLabel,
  note,
}: ScheduledSlotCardProps) {
  const router = useRouter()
  const { getToken } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStartEarly() {
    // Owns its own busy state so a double-click can never double-fire.
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const token = await getToken()
      await triggerRun({ issueNumber }, token)
      router.push(issueHref(issueNumber))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-[480px] rounded-[2px] border border-[color:var(--color-marigold)]/40 bg-[color:var(--color-marigold)]/[.08] p-5">
      <span className="inline-block rounded-[2px] bg-[color:var(--color-marigold)] px-[9px] py-[3px] font-[family-name:var(--font-ui)] text-[9.5px] font-semibold uppercase tracking-[.08em] text-[color:var(--color-ink)]">
        Scheduled
      </span>

      <h2 className="mt-2 font-[family-name:var(--font-display)] text-[16px] font-semibold text-[color:var(--color-ink)]">
        Issue {issueNumber}
      </h2>

      <p className="mt-1 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
        {scheduledForLabel}
      </p>

      {/* D-10: no placeholder chip when note is null — the row is simply
          absent, never an empty "avoid —" stub. */}
      {note !== null && (
        <p className="mt-2 font-[family-name:var(--font-mono)] text-[12.5px] text-[color:var(--color-ink-soft)]">
          {note}
        </p>
      )}

      <button
        type="button"
        onClick={handleStartEarly}
        disabled={busy}
        className="mt-4 flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-cobalt)] disabled:opacity-50"
      >
        Start #{issueNumber} early
      </button>

      {error && (
        <p className="mt-2 font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-vermilion)]">
          {error}
        </p>
      )}
    </div>
  )
}
