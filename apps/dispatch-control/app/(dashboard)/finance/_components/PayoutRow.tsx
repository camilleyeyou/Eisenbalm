'use client'
/**
 * Phase 27 — RCN-02: PayoutRow — payout status badge + inline mark-sent action.
 *
 * Renders the two table cells for a single issue's payout: the status badge
 * (Pending marigold / Sent green) and the action cell. For a `pending` payout
 * the operator clicks "Mark sent" which replaces the button INLINE in the same
 * row (no modal) with an audit-log confirm prompt + [Mark as sent] / [Keep
 * pending].
 *
 * Confirm calls payouts:markPayoutSent (Clerk-JWT-guarded; auth is supplied by
 * ConvexProviderWithClerk so useMutation is automatically authenticated). On
 * success the Convex real-time subscription flips this row to a green Sent badge
 * with a sent date — no page reload.
 */
import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'

export interface PayoutRowData {
  _id: Id<'payouts'>
  issueNumber: number
  charitySlug: string
  amount: number
  status: 'pending' | 'sent'
  sentAt?: number
  reference?: string
}

interface PayoutRowProps {
  /** The payout row for this issue, or null when no payout exists yet. */
  payout: PayoutRowData | null
}

function formatSentDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)] focus-visible:ring-offset-1'

export default function PayoutRow({ payout }: PayoutRowProps) {
  const markPayoutSent = useMutation(api.payouts.markPayoutSent)
  const [confirming, setConfirming] = useState(false)
  const [reference, setReference] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // No payout row yet for this issue.
  if (!payout) {
    return (
      <>
        <td className="px-4 py-3">
          <span className="text-xs text-[color:var(--color-faint)]">—</span>
        </td>
        <td className="px-4 py-3" />
      </>
    )
  }

  if (payout.status === 'sent') {
    return (
      <>
        <td className="px-4 py-3">
          <span className="inline-flex items-center rounded-full bg-[color:var(--color-green)]/15 px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-green)]">
            Sent
          </span>
        </td>
        <td className="px-4 py-3">
          {payout.sentAt && (
            <span className="text-xs text-[color:var(--color-faint)]">
              Sent {formatSentDate(payout.sentAt)}
            </span>
          )}
        </td>
      </>
    )
  }

  async function handleConfirm() {
    if (!payout) return
    setSubmitting(true)
    setError(null)
    try {
      await markPayoutSent({
        payoutId: payout._id,
        reference: reference.trim(),
        sentAt: Date.now(),
      })
      // Convex subscription flips the row — no local state to reset on success.
    } catch {
      setError('Could not mark this payout sent. Try again.')
      setSubmitting(false)
    }
  }

  return (
    <>
      <td className="px-4 py-3">
        <span className="inline-flex items-center rounded-full bg-[color:var(--color-marigold)]/20 px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-marigold-text)]">
          Pending
        </span>
      </td>
      <td className="px-4 py-3">
        {confirming ? (
          <div className="space-y-2 rounded-none border border-[color:var(--color-ink)]/15 bg-[color:var(--color-card-alt)] p-3 text-sm">
            <p className="text-[color:var(--color-ink-soft)]">
              Confirm this payout was sent. This action is audit-logged and
              cannot be undone automatically.
            </p>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="Payout reference / memo"
              aria-label="Payout reference"
              className={`min-h-[44px] w-full rounded-none border border-[color:var(--color-ink)]/15 px-3 text-sm text-[color:var(--color-ink)] ${FOCUS_RING}`}
            />
            {error && (
              <p role="alert" className="text-xs text-[color:var(--color-vermilion)]">
                {error}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                aria-busy={submitting}
                className={`min-h-[44px] min-w-[44px] rounded-none bg-[color:var(--color-ink)] px-3 text-sm font-medium text-[color:var(--color-masthead-text)] hover:bg-[color:var(--color-ink)]/90 disabled:opacity-50 ${FOCUS_RING}`}
              >
                {submitting ? 'Marking…' : 'Mark as sent'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false)
                  setError(null)
                }}
                disabled={submitting}
                className={`min-h-[44px] min-w-[44px] rounded-none border border-[color:var(--color-ink)]/15 px-3 text-sm text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-card)] disabled:opacity-50 ${FOCUS_RING}`}
              >
                Keep pending
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`min-h-[44px] min-w-[44px] rounded-none bg-[color:var(--color-ink)] px-3 text-sm font-medium text-[color:var(--color-masthead-text)] hover:bg-[color:var(--color-ink)]/90 ${FOCUS_RING}`}
          >
            Mark sent
          </button>
        )}
      </td>
    </>
  )
}
