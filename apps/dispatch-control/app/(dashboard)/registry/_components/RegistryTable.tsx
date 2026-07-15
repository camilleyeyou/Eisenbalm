'use client'
/**
 * Phase 26 — REG-01: Charity registry table.
 *
 * Real-time list of all charities in the workspace, with filter pills,
 * status badges, featured stats, and blocklist/unblocklist controls.
 *
 * Data source: charities:listByWorkspace (Convex query)
 * Mutations:   charities:setStatus
 *
 * Filter pills are client-side (status is the only axis).
 * Blocklist action is gated behind an inline confirmation popover.
 */
import { Fragment, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import CharityStatusBadge from './CharityStatusBadge'
import AddCorrectionDialog from './AddCorrectionDialog'
import CorrectionsList from './CorrectionsList'

interface RegistryTableProps {
  workspace_id: string
}

type FilterStatus = 'all' | 'candidate' | 'featured' | 'blocklisted'

const FILTER_LABELS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'candidate', label: 'Candidates' },
  { value: 'featured', label: 'Featured' },
  { value: 'blocklisted', label: 'Blocklisted' },
]

function formatRelativeTime(ms: number | undefined): string {
  if (!ms) return '—'
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

function pluralizeFeatured(n: number): string {
  return n === 1 ? `Featured ${n} time` : `Featured ${n} times`
}

function truncateUrl(url: string | undefined, maxLen = 32): string {
  if (!url) return '—'
  // Strip scheme for display
  const display = url.replace(/^https?:\/\//, '')
  if (display.length <= maxLen) return display
  return display.slice(0, maxLen) + '…'
}

export default function RegistryTable({ workspace_id }: RegistryTableProps) {
  const charities = useQuery(api.charities.listByWorkspace, { workspace_id })
  const setStatus = useMutation(api.charities.setStatus)

  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all')
  // Track which charity has an open blocklist confirm popover
  const [confirmingBlocklistId, setConfirmingBlocklistId] = useState<string | null>(null)
  // Phase 43 (TSK-06): required reason text for the Do-not-use decision, reset
  // whenever the confirm popover opens/closes for a different (or no) row.
  const [blocklistReason, setBlocklistReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  // Phase 39 (MEM-02): which charity row has its corrections detail expanded
  const [expandedCharityId, setExpandedCharityId] = useState<string | null>(null)

  if (charities === undefined) {
    return (
      <div className="text-sm text-neutral-500 py-4">Loading registry…</div>
    )
  }

  const filtered =
    activeFilter === 'all'
      ? charities
      : charities.filter(c => c.status === activeFilter)

  async function handleBlocklist(charityId: Id<'charities'>) {
    const reason = blocklistReason.trim()
    if (reason === '') return
    setPendingAction(charityId)
    setActionError(null)
    try {
      await setStatus({ workspace_id, charityId, status: 'blocklisted', reason })
      setConfirmingBlocklistId(null)
      setBlocklistReason('')
    } catch {
      setActionError('Could not update the registry. Try again.')
    } finally {
      setPendingAction(null)
    }
  }

  async function handleUnblocklist(charityId: Id<'charities'>) {
    setPendingAction(charityId)
    setActionError(null)
    try {
      await setStatus({ workspace_id, charityId, status: 'candidate' })
    } catch {
      setActionError('Could not update the registry. Try again.')
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter charities by status">
        {FILTER_LABELS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveFilter(value)}
            aria-pressed={activeFilter === value}
            className={`min-h-[44px] rounded-full px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 ${
              activeFilter === value
                ? 'bg-neutral-900 text-white'
                : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {actionError && (
        <p role="alert" className="text-xs text-red-700">
          {actionError}
        </p>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-neutral-900">No charities yet</p>
          <p className="mt-1 text-sm text-neutral-500">
            Charities appear here as the Scout pitches candidates. You can also add entries manually.
          </p>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-neutral-600">Name</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-600">Website</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-600">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-600 text-right">Featured</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-600">Last Featured</th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map(charity => {
                const isConfirmingThisBlocklist = confirmingBlocklistId === charity._id
                const isPendingThisAction = pendingAction === charity._id

                return (
                  <Fragment key={charity._id}>
                  <tr
                    className="hover:bg-neutral-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-neutral-800">
                      {charity.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-500 max-w-[200px]">
                      {charity.website ? (
                        <a
                          href={charity.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={charity.website}
                          className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 rounded"
                        >
                          {truncateUrl(charity.website)}
                        </a>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CharityStatusBadge status={charity.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 text-right">
                      {charity.timesFeatured != null && charity.timesFeatured > 0
                        ? pluralizeFeatured(charity.timesFeatured)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      {formatRelativeTime(charity.lastFeaturedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {charity.status === 'blocklisted' ? (
                          /* Unblocklist action — immediate */
                          <button
                            type="button"
                            onClick={() => handleUnblocklist(charity._id)}
                            disabled={isPendingThisAction}
                            aria-busy={isPendingThisAction}
                            className="min-h-[44px] text-sm text-neutral-600 hover:text-neutral-900 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 rounded px-1"
                          >
                            {isPendingThisAction ? 'Updating…' : 'Remove from Blocklist'}
                          </button>
                        ) : isConfirmingThisBlocklist ? (
                          /* Inline blocklist confirmation */
                          <div className="space-y-2 rounded border border-neutral-200 bg-neutral-50 p-3 text-sm">
                            <p className="font-semibold text-neutral-900">Blocklist this charity?</p>
                            <p className="text-neutral-600">
                              The Scout will skip{' '}
                              <span className="font-medium">{charity.name}</span> in all
                              future runs.
                            </p>
                            <label
                              htmlFor={`blocklist-reason-${charity._id}`}
                              className="block text-xs font-medium text-neutral-700"
                            >
                              Why mark Do not use?
                            </label>
                            <textarea
                              id={`blocklist-reason-${charity._id}`}
                              value={blocklistReason}
                              onChange={e => setBlocklistReason(e.target.value)}
                              disabled={isPendingThisAction}
                              required
                              rows={2}
                              placeholder="Required — this reason is recorded in the Decision Log."
                              className="w-full min-h-[44px] rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleBlocklist(charity._id)}
                                disabled={isPendingThisAction || blocklistReason.trim() === ''}
                                aria-busy={isPendingThisAction}
                                className="min-h-[44px] rounded bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
                              >
                                {isPendingThisAction ? 'Blocklisting…' : 'Blocklist Charity'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmingBlocklistId(null)
                                  setBlocklistReason('')
                                }}
                                disabled={isPendingThisAction}
                                className="min-h-[44px] rounded border border-neutral-300 px-3 text-sm text-neutral-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Blocklist trigger — opens inline confirm */
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmingBlocklistId(charity._id)
                              setBlocklistReason('')
                            }}
                            className="min-h-[44px] text-sm text-neutral-600 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 rounded px-1"
                          >
                            Blocklist Charity
                          </button>
                        )}

                        {/* Phase 39 (MEM-02): Add correction / view corrections toggle */}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCharityId(
                              expandedCharityId === charity._id ? null : charity._id,
                            )
                          }
                          aria-expanded={expandedCharityId === charity._id}
                          className="min-h-[44px] text-sm text-neutral-600 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 rounded px-1"
                        >
                          {expandedCharityId === charity._id ? 'Hide corrections' : 'Add correction'}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Phase 39 (MEM-02): expanded row — add correction + chronological log */}
                  {expandedCharityId === charity._id && (
                    <tr className="bg-neutral-50">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <AddCorrectionDialog workspace_id={workspace_id} charity={charity} />
                          <CorrectionsList
                            workspace_id={workspace_id}
                            charityKey={charity.dedupKey ?? ''}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
