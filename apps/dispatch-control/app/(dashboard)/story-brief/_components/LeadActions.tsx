'use client'
/**
 * Phase 47 Plan 47-05 (BRF-02) — LeadActions: "Require this lead" /
 * "Remove — add reason" for a single `story_leads` row.
 *
 * Require calls `requireLead(runId, leadId, token)` — no reason. Remove is
 * disabled while its reason textarea is empty/whitespace; submitting with a
 * non-empty reason calls `removeLead(runId, leadId, reason, token)`. Both
 * clients (`lib/pipelineControlClient.ts`) POST to the Clerk-guarded
 * `/issues/{run_id}/leads/{lead_id}/require`/`/remove` endpoints (§47.5),
 * which write `storyLeads:setStatus` + (Remove only) a reason-carrying
 * `audit_log` row — the removal surfaces in the shared Decision log
 * (`components/decision-log/DecisionLog.tsx`) server-side; this component
 * shows an optimistic pending/success message per the
 * `AdjudicationPanel.tsx` idiom while Convex's live subscription catches up.
 *
 * quick 260722-v01 (audit item 6): no longer mounts its own `<DecisionLog>`
 * — StoryBriefScreen.tsx mounts exactly ONE consolidated Decision log for
 * the whole Story stage (was up to ~11 duplicate run-scoped logs, one per
 * lead/brief-field). The require/remove reason still surfaces there.
 *
 * The operator never handles the pipeline's server-to-server auth value —
 * this component contains no reference to it whatsoever.
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { requireLead, removeLead } from '@/lib/pipelineControlClient'
import HelpTip from '@/components/ui/HelpTip'
import { HELP_COPY } from '@/components/help/helpCopy'

export interface LeadActionsProps {
  runId: string
  leadId: string
}

export function LeadActions({ runId, leadId }: LeadActionsProps) {
  const { getToken } = useAuth()

  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  // fast 260723 — feedback carries tone, and renders NEXT TO the Require
  // button (top of the section), not below the Remove textarea where it sat
  // below the fold: the operator reported clicking Require with "nothing
  // happens" while the (error) message rendered off-screen in 13px ink.
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const canRemove = reason.trim().length > 0 && !busy

  async function handleRequire() {
    setBusy(true)
    setMessage(null)
    try {
      const token = await getToken()
      await requireLead(runId, leadId, token)
      setMessage({ tone: 'ok', text: 'Locked in — the pipeline must pick this lead.' })
    } catch (e) {
      setMessage({
        tone: 'error',
        text: `Couldn't require this lead — ${e instanceof Error ? e.message : 'request failed.'}`,
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    if (reason.trim().length === 0) return
    setBusy(true)
    setMessage(null)
    try {
      const token = await getToken()
      await removeLead(runId, leadId, reason, token)
      setMessage({ tone: 'ok', text: `Removed: ${reason}` })
      setReason('')
    } catch (e) {
      setMessage({
        tone: 'error',
        text: `Couldn't remove this lead — ${e instanceof Error ? e.message : 'request failed.'}`,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-label="Lead actions"
      className="mt-2 flex flex-col gap-3 border-t border-[color:var(--color-faint)] pt-2"
    >
      <div className="flex w-fit items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={handleRequire}
          className="min-h-[44px] w-fit bg-[color:var(--color-green)] px-4 py-2 font-[family-name:var(--font-ui)] text-[12px] font-semibold uppercase tracking-[.06em] text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Require this lead
        </button>
        <HelpTip text={HELP_COPY.storyBrief.leadRequire} label="Help: require lead" />
        {busy && (
          <span className="font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-ink-soft)]">
            Working…
          </span>
        )}
      </div>

      {/* fast 260723 — feedback lives HERE, adjacent to the button that was
          clicked; error = vermilion + role=alert, success = green. */}
      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={
            message.tone === 'error'
              ? 'border border-[color:var(--color-vermilion)]/50 bg-[color:var(--color-vermilion)]/10 p-2 font-[family-name:var(--font-ui)] text-[13px] font-medium text-[color:var(--color-vermilion)]'
              : 'font-[family-name:var(--font-ui)] text-[13px] font-medium text-[color:var(--color-green)]'
          }
        >
          {message.text}
        </p>
      )}

      <div>
        <label
          className="block font-[family-name:var(--font-ui)] text-[11px] font-medium uppercase tracking-[.06em] text-[color:var(--color-ink)]"
          htmlFor={`remove-reason-${leadId}`}
        >
          Remove — add reason (required)
        </label>
        <p className="mt-0.5 text-[11px] text-[color:var(--color-ink-soft)]">
          {HELP_COPY.storyBrief.leadRemove}
        </p>
        <textarea
          id={`remove-reason-${leadId}`}
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={2}
          className="mt-1 w-full border border-[color:var(--color-faint)] bg-white p-2 text-[13px] text-[color:var(--color-ink)]"
        />
        <button
          type="button"
          disabled={!canRemove}
          onClick={handleRemove}
          className="mt-1.5 min-h-[44px] bg-[color:var(--color-vermilion)] px-4 py-2 font-[family-name:var(--font-ui)] text-[12px] font-semibold uppercase tracking-[.06em] text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Remove
        </button>
      </div>

    </section>
  )
}
