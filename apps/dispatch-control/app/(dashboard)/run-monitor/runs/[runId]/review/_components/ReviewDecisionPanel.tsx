'use client'
/**
 * Phase 26 (RVW-03) — Review decision panel.
 *
 * Exposes four decisions from the review screen:
 *   1. Approve and Publish — gated on claimChecks:allSignedOff (Pitfall 5)
 *   2. Schedule for Later — opens SchedulePublishDialog inline panel
 *   3. Reject Run — inline confirm panel with optional note
 *   4. Re-roll Section — reuses Phase 25 rerollAgent pattern + two-step confirm
 *
 * Approve gate (Pitfall 5):
 *   const canApprove = signoffQuery !== undefined && signoffQuery.allSignedOff === true
 *   disabled={!canApprove} — prevents the false-enabled flash on first render
 *   (loading guard: undefined query = not yet loaded = disabled)
 *
 * PREVIEW_SECRET is never referenced here (server-only concern in page.tsx).
 *
 * NOTE: claimChecks:allSignedOff is not yet in convex/_generated/api.d.ts
 * (pending npx convex dev regeneration). Referenced via type-asserted api object.
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { publishIssue, scheduleIssue, rejectIssue, ReviewApiError } from '@/lib/reviewClient'
import { rerollAgent } from '@/lib/pipelineControlClient'
import SchedulePublishDialog from './SchedulePublishDialog'
import { useRole } from '@/lib/role'
import { LockedControl } from '@/components/LockedControl'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const claimChecksApi = api as any

/** The 7 re-rollable section writers (matches Phase 25 RUN-05). */
const SECTION_WRITERS = [
  { key: 'origin_story', label: 'Origin Story' },
  { key: 'problem', label: 'Problem' },
  { key: 'founder_bio', label: 'Founder Bio' },
  { key: 'case_study', label: 'Case Study' },
  { key: 'game', label: 'Game' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'design', label: 'Design' },
]

interface ReviewDecisionPanelProps {
  runId: string
}

type ActiveModal = 'schedule' | 'reject' | 'reroll' | null

export default function ReviewDecisionPanel({ runId }: ReviewDecisionPanelProps) {
  const { getToken } = useAuth()
  // ROL-03 (D-09): presentation-only client hint — the server
  // `_require_editor` dependency (Plan 49-03) is the authoritative gate.
  // This is the legacy publish surface (D-06/D-07) — gated the same way as
  // review-desk's DecisionRail.
  const isLocked = useRole() !== 'Editor-in-chief'

  // Claims sign-off gate query. undefined = still loading (must stay disabled).
  const signoffQuery = useQuery(
    claimChecksApi.claimChecks.allSignedOff,
    { runId },
  ) as { total: number; signedOff: number; allSignedOff: boolean } | undefined

  // Approve gate (Pitfall 5): BOTH conditions required
  const canApprove =
    signoffQuery !== undefined && signoffQuery.allSignedOff === true

  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [selectedSection, setSelectedSection] = useState(SECTION_WRITERS[0]?.key ?? 'origin_story')
  const [rerollConfirming, setRerollConfirming] = useState(false)

  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function clearFeedback() {
    setSuccessMsg(null)
    setErrorMsg(null)
  }

  // ── Approve and Publish ────────────────────────────────────────────────────

  async function handleApprove() {
    if (!canApprove || loading) return
    clearFeedback()
    setLoading(true)
    try {
      const token = await getToken()
      await publishIssue(token, runId)
      setSuccessMsg('Issue approved and published successfully.')
    } catch (e) {
      if (e instanceof ReviewApiError) {
        if (e.reason === 'claims_not_signed_off') {
          setErrorMsg('Sign off all factual claims before publishing.')
        } else if (e.reason === 'wrong_status') {
          setErrorMsg('This run cannot be published in its current state.')
        } else {
          setErrorMsg(e.message)
        }
      } else {
        setErrorMsg(e instanceof Error ? e.message : 'Publish failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Schedule for Later ─────────────────────────────────────────────────────

  function handleScheduled(scheduledAt: number) {
    setActiveModal(null)
    setSuccessMsg(
      `Issue scheduled for ${new Date(scheduledAt).toLocaleString()}.`,
    )
  }

  // ── Reject Run ────────────────────────────────────────────────────────────

  async function handleConfirmReject() {
    if (loading) return
    clearFeedback()
    setLoading(true)
    try {
      const token = await getToken()
      await rejectIssue(token, runId, rejectNote.trim() || undefined)
      setActiveModal(null)
      setRejectNote('')
      setSuccessMsg('Run rejected. It will remain in the history log.')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Reject failed.')
    } finally {
      setLoading(false)
    }
  }

  // ── Re-roll Section ───────────────────────────────────────────────────────

  async function handleConfirmReroll() {
    if (loading) return
    clearFeedback()
    setLoading(true)
    try {
      const token = await getToken()
      await rerollAgent(runId, selectedSection, token)
      setActiveModal(null)
      setRerollConfirming(false)
      const label = SECTION_WRITERS.find(s => s.key === selectedSection)?.label ?? selectedSection
      setSuccessMsg(`Re-rolling ${label}… The preview will update when complete.`)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Re-roll failed.')
    } finally {
      setLoading(false)
    }
  }

  const sectionLabel = SECTION_WRITERS.find(s => s.key === selectedSection)?.label ?? selectedSection

  return (
    <section aria-labelledby="decisions-heading" className="space-y-3">
      <h2 id="decisions-heading" className="text-base font-semibold text-neutral-900">
        Review Decision
      </h2>

      {/* Feedback messages */}
      {successMsg && (
        <p role="alert" className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
          {successMsg}
        </p>
      )}
      {errorMsg && (
        <p role="alert" className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {errorMsg}
        </p>
      )}

      {/* ── Primary CTAs ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {/* Approve and Publish */}
        <LockedControl
          isLocked={isLocked}
          lockedLabel="Collaborators can review and comment, not publish."
        >
          <button
            type="button"
            onClick={handleApprove}
            disabled={!canApprove || loading}
            aria-disabled={!canApprove}
            title={!canApprove ? 'Sign off all factual claims before publishing.' : undefined}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 transition-colors"
          >
            {loading && activeModal === null ? 'Publishing…' : 'Approve and Publish'}
          </button>
        </LockedControl>

        {/* Schedule for Later */}
        <button
          type="button"
          onClick={() => { clearFeedback(); setActiveModal('schedule') }}
          disabled={loading}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 transition-colors"
        >
          Schedule for Later
        </button>
      </div>

      {/* ── Schedule dialog ───────────────────────────────────────────────── */}
      {activeModal === 'schedule' && (
        <SchedulePublishDialog
          runId={runId}
          onScheduled={handleScheduled}
          onCancel={() => setActiveModal(null)}
        />
      )}

      {/* ── Secondary actions ─────────────────────────────────────────────── */}
      <div className="border-t border-neutral-200 pt-3 space-y-2">
        {/* Reject Run */}
        {activeModal !== 'reject' ? (
          <button
            type="button"
            onClick={() => { clearFeedback(); setActiveModal('reject') }}
            disabled={loading}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 transition-colors"
          >
            Reject Run
          </button>
        ) : (
          /* Reject inline confirm */
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-dialog-heading"
            className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3"
          >
            <h3 id="reject-dialog-heading" className="text-base font-semibold text-neutral-900">
              Reject this run?
            </h3>
            <p className="text-sm text-neutral-600">
              The run will remain in the history log but will not publish. You can
              add a note below.
            </p>
            <label className="block space-y-1">
              <span className="sr-only">Optional note</span>
              <textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="Optional note…"
                rows={3}
                disabled={loading}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 resize-none"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={loading}
                className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 transition-colors"
              >
                {loading ? 'Rejecting…' : 'Confirm Reject'}
              </button>
              <button
                type="button"
                onClick={() => { setActiveModal(null); setRejectNote('') }}
                disabled={loading}
                className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Re-roll Section */}
        <div className="space-y-2">
          {!rerollConfirming ? (
            <button
              type="button"
              onClick={() => { clearFeedback(); setRerollConfirming(true) }}
              disabled={loading}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 transition-colors"
            >
              Re-roll Section
            </button>
          ) : (
            /* Re-roll two-step inline confirm (D-12, UI-SPEC) */
            <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900">
                Re-roll a Section
              </h3>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-neutral-700">
                  Section to re-roll
                </span>
                <select
                  value={selectedSection}
                  onChange={e => setSelectedSection(e.target.value)}
                  disabled={loading}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50"
                >
                  {SECTION_WRITERS.map(s => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-neutral-600">
                The selected section will be regenerated using the current prompt
                config. The preview will update when complete.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmReroll}
                  disabled={loading}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 transition-colors"
                >
                  {loading ? `Re-rolling ${sectionLabel}…` : 'Re-roll Section'}
                </button>
                <button
                  type="button"
                  onClick={() => setRerollConfirming(false)}
                  disabled={loading}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
