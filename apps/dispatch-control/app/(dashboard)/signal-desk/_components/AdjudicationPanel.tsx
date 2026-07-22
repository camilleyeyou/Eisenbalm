'use client'
/**
 * Phase 37 (SIG-03, Plan 37-05 Task 3) — AdjudicationPanel: side-by-side
 * Gate-1 adjudication when the run is paused at the interrupt
 * (`status === 'awaiting-review' && completedAt == null` — the page
 * composition computes this, API_CONTRACTS §37.4(c)).
 *
 * The operator picks a candidate and types a required reason; Submit calls
 * the centralized `adjudicateGate1` client (lib/pipelineControlClient.ts —
 * NEVER inlined here) which POSTs to the Clerk-guarded
 * `POST /issues/{run_id}/adjudicate` bridge (§37.3). This is the ONE write
 * action on the Signal Desk; everything else on both screens is read-only.
 *
 * The operator NEVER handles the pipeline's server-to-server auth value used
 * by the separate resume endpoint the bridge calls internally. This
 * component contains no reference to that value whatsoever.
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { adjudicateGate1 } from '@/lib/pipelineControlClient'
import HelpTip from '@/components/ui/HelpTip'
import { HELP_COPY } from '@/components/help/helpCopy'

export interface AdjudicationCandidate {
  charityName: string
  advocateScore?: number
}

export interface AdjudicationPanelProps {
  runId: string
  candidates: AdjudicationCandidate[]
}

export function AdjudicationPanel({ runId, candidates }: AdjudicationPanelProps) {
  const { getToken } = useAuth()

  const [pick, setPick] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const canSubmit = pick !== null && reason.trim().length > 0 && !busy

  async function handleSubmit() {
    if (!pick) return
    setBusy(true)
    setMessage(null)
    try {
      const token = await getToken()
      await adjudicateGate1(runId, { selection: { charityName: pick }, reason }, token)
      setMessage(`Got it — the run is continuing with ${pick}.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't submit your choice — try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-label="Story decision required"
      className="border border-[color:var(--color-vermilion)] bg-[color:var(--color-card)] p-4"
    >
      <div className="flex items-center gap-1.5">
        <h2 className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[.09em] text-[color:var(--color-vermilion)]">
          Paused for your decision — choose the story
        </h2>
        <HelpTip text={HELP_COPY.signalDesk.adjudicate} label="Explain Gate-1 adjudication" />
      </div>
      <p className="mt-1 text-[13px] text-[color:var(--color-ink-soft)]">
        Pick a candidate and give a reason to resume the run.
      </p>

      <div
        role="radiogroup"
        aria-label="Candidate pick"
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
      >
        {candidates.map(c => (
          <label
            key={c.charityName}
            className="flex min-h-[44px] flex-1 items-center gap-2 border border-[color:var(--color-faint)] bg-white px-3 py-2 text-[13px] text-[color:var(--color-ink)]"
          >
            <input
              type="radio"
              name={`adjudicate-pick-${runId}`}
              value={c.charityName}
              checked={pick === c.charityName}
              onChange={() => setPick(c.charityName)}
            />
            <span>
              {c.charityName}
              {c.advocateScore != null && (
                <span className="text-[color:var(--color-ink-soft)]"> · {c.advocateScore}/10</span>
              )}
            </span>
          </label>
        ))}
      </div>

      <label
        className="mt-3 block font-[family-name:var(--font-ui)] text-[11px] font-medium uppercase tracking-[.06em] text-[color:var(--color-ink)]"
        htmlFor={`adjudicate-reason-${runId}`}
      >
        Reason (required)
      </label>
      <textarea
        id={`adjudicate-reason-${runId}`}
        value={reason}
        onChange={e => setReason(e.target.value)}
        rows={3}
        className="mt-1 w-full border border-[color:var(--color-faint)] bg-white p-2 text-[13px] text-[color:var(--color-ink)]"
      />

      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="mt-3 min-h-[44px] bg-[color:var(--color-ink)] px-4 py-2 font-[family-name:var(--font-ui)] text-[12px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-masthead-text)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Submitting…' : 'Resume run'}
      </button>

      {message && (
        <p role="status" className="mt-2 text-[13px] text-[color:var(--color-ink)]">
          {message}
        </p>
      )}
    </section>
  )
}
