'use client'
/**
 * Phase 26 (RVW-05) — Factual-claims sign-off checklist.
 *
 * Lists all factual claims extracted for a run; operator checks or skips each
 * before the Approve button is enabled.
 *
 * Data sources:
 *   - useQuery claimChecks:listByRunId({runId}) → claim rows
 *   - useMutation claimChecks:setStatus({runId, claimIndex, status})
 *
 * Approve gate is enforced by ReviewDecisionPanel (which separately queries
 * claimChecks:allSignedOff); this component focuses on individual row actions.
 *
 * NOTE: claimChecks is not yet in convex/_generated/api.d.ts (pending npx
 * convex dev regeneration). We reference it via type-asserted api object until
 * the deployment regenerates _generated/.
 */
import { useQuery, useMutation } from 'convex/react'
import { api } from '@convex/_generated/api'

// Type for a single claim row returned by claimChecks:listByRunId
interface ClaimRow {
  claimIndex: number
  text: string
  claimType: string   // "number" | "date" | "proper_noun"
  context: string
  status: string      // "pending" | "checked" | "skipped"
}

interface ClaimsChecklistProps {
  runId: string
}

/** Human-readable label for claimType. */
function claimTypeLabel(claimType: string): string {
  switch (claimType) {
    case 'number': return 'Number'
    case 'date': return 'Date'
    case 'proper_noun': return 'Proper noun'
    default: return claimType
  }
}

/** Badge classes for each claim status. */
function statusBadgeClass(status: string): string {
  switch (status) {
    case 'checked': return 'bg-green-100 text-green-800 border-green-200'
    case 'skipped': return 'bg-neutral-100 text-neutral-600 border-neutral-200'
    default: return 'bg-amber-100 text-amber-800 border-amber-200' // pending
  }
}

/** Badge label for each status. */
function statusBadgeLabel(status: string): string {
  switch (status) {
    case 'checked': return 'Verified'
    case 'skipped': return 'Skipped'
    default: return 'Pending'
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const claimChecksApi = api as any

export default function ClaimsChecklist({ runId }: ClaimsChecklistProps) {
  // Query all claims for this run. undefined = still loading.
  const claims = useQuery(claimChecksApi.claimChecks.listByRunId, { runId }) as
    | ClaimRow[]
    | undefined

  const setStatus = useMutation(claimChecksApi.claimChecks.setStatus)

  async function handleSetStatus(claimIndex: number, status: 'checked' | 'skipped') {
    await setStatus({ runId, claimIndex, status })
  }

  const allResolved =
    claims !== undefined &&
    claims.length > 0 &&
    claims.every(c => c.status !== 'pending')

  return (
    <section aria-labelledby="claims-heading" className="space-y-3">
      <div>
        <h2 id="claims-heading" className="text-base font-semibold text-neutral-900">
          Factual Claims
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Check or skip each claim before approving. Approve is disabled until all
          claims are resolved.
        </p>
      </div>

      {/* Loading state */}
      {claims === undefined && (
        <p className="text-sm text-neutral-500">Loading claims…</p>
      )}

      {/* Empty state */}
      {claims !== undefined && claims.length === 0 && (
        <p className="text-sm text-neutral-500">No claims detected in this issue.</p>
      )}

      {/* Claims list */}
      {claims !== undefined && claims.length > 0 && (
        <>
          {allResolved && (
            <p className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
              All claims resolved. Approve is now enabled.
            </p>
          )}
          <ul
            role="log"
            aria-live="polite"
            aria-label="Factual claims"
            className="space-y-2"
          >
            {claims.map(claim => (
              <li
                key={claim.claimIndex}
                className="flex min-h-[40px] flex-col gap-1 rounded-md border border-neutral-200 bg-white p-3"
              >
                {/* Claim header: type label + status badge */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">
                    {claimTypeLabel(claim.claimType)}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(claim.status)}`}
                  >
                    {statusBadgeLabel(claim.status)}
                  </span>
                </div>

                {/* Claim text */}
                <p className="text-sm text-neutral-900">{claim.text}</p>

                {/* Context snippet */}
                {claim.context && (
                  <p className="text-xs text-neutral-400 italic truncate">
                    &ldquo;{claim.context}&rdquo;
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSetStatus(claim.claimIndex, 'checked')}
                    disabled={claim.status === 'checked'}
                    aria-label={`Mark claim ${claim.claimIndex + 1} as Verified`}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100 disabled:cursor-default disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 transition-colors"
                  >
                    Verified
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetStatus(claim.claimIndex, 'skipped')}
                    disabled={claim.status === 'skipped'}
                    aria-label={`Skip claim ${claim.claimIndex + 1}`}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-default disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
