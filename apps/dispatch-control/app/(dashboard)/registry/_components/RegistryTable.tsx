'use client'
/**
 * Phase 26 — REG-01: Charity registry table.
 * Phase 50-03 (D-03/D-15) — rendered "Blocklisted" -> "Do not use" over the
 * unchanged stored `'blocklisted'` enum; the confirm popover gains a typed
 * organization-name gate in front of the existing reason requirement.
 *
 * Real-time list of all charities in the workspace, with filter pills,
 * status badges, featured stats, and Mark Do-not-use / Restore controls.
 *
 * Data source: charities:listByWorkspace (Convex query)
 * Mutations:   charities:setStatus (status value 'blocklisted' unchanged)
 *
 * Filter pills are client-side (status is the only axis).
 * Mark Do-not-use is gated behind an inline typed-name + reason confirm
 * popover, Editor-in-chief only (LockedControl / server requireEditor).
 *
 * quick 260722-v01 (audit item 5): client-capped to the latest 50 filtered
 * rows with a "Show all" toggle, mirroring RunsTable.tsx's exemplar — an
 * unbounded table grew unusably long on a workspace with a large registry.
 *
 * quick 260724-lp1: uniform-system restyle (mockup 07) — hard-edged table,
 * mono-caps headers + numerals, square filter chips (rounded-full -> mockup
 * `.f-chip`), off the generic Tailwind grey palette and onto 1c tokens.
 * className/markup only — same query, mutation, handlers, testids.
 */
import { Fragment, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import CharityStatusBadge from './CharityStatusBadge'
import AddCorrectionDialog from './AddCorrectionDialog'
import CorrectionsList from './CorrectionsList'
import { useRole } from '@/lib/role'
import { LockedControl } from '@/components/LockedControl'

interface RegistryTableProps {
  workspace_id: string
}

type FilterStatus = 'all' | 'candidate' | 'featured' | 'blocklisted'

// Phase 50-03 (D-03/WBN-05): rendered label only — the filter VALUE stays
// the unchanged stored enum literal 'blocklisted' (charities:setStatus,
// audit action charity.blocklisted). Only the operator-facing text changes.
const FILTER_LABELS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'candidate', label: 'Candidates' },
  { value: 'featured', label: 'Featured' },
  { value: 'blocklisted', label: 'Do not use' },
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
  // ROL-03 (D-09): presentation-only client hint — the server
  // `requireEditor` Convex helper (Plan 49-04) is the authoritative gate.
  const isLocked = useRole() !== 'Editor-in-chief'

  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all')
  // Track which charity has an open Mark Do-not-use confirm popover
  const [confirmingBlocklistId, setConfirmingBlocklistId] = useState<string | null>(null)
  // Phase 43 (TSK-06): required reason text for the Do-not-use decision, reset
  // whenever the confirm popover opens/closes for a different (or no) row.
  const [blocklistReason, setBlocklistReason] = useState('')
  // Phase 50-03 (D-15): typed organization-name confirmation — the operator
  // must type the charity's exact name to unlock the destructive action.
  // Reset alongside blocklistReason on open/close/confirm.
  const [typedName, setTypedName] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  // Phase 39 (MEM-02): which charity row has its corrections detail expanded
  const [expandedCharityId, setExpandedCharityId] = useState<string | null>(null)
  // quick 260722-v01 (audit item 5) — called unconditionally, before the
  // loading guard below, so hook order never changes across renders.
  const [showAll, setShowAll] = useState(false)

  if (charities === undefined) {
    return (
      <div className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)] py-4">
        Loading registry…
      </div>
    )
  }

  const filtered =
    activeFilter === 'all'
      ? charities
      : charities.filter(c => c.status === activeFilter)

  // quick 260722-v01 (audit item 5) — cap at the latest 50 filtered rows
  // (mirrors RunsTable.tsx's client-cap exemplar).
  const visibleCharities = showAll ? filtered : filtered.slice(0, 50)

  // Phase 50-03 (D-15): the STORED value/mutation is byte-unchanged from
  // Phase 43/47 — `status: 'blocklisted'` — only the UI adds the typed-name
  // gate in front of it and renames the operator-facing labels.
  async function handleBlocklist(charityId: Id<'charities'>, charityName: string) {
    const reason = blocklistReason.trim()
    if (reason === '' || typedName.trim() !== charityName.trim()) return
    setPendingAction(charityId)
    setActionError(null)
    try {
      await setStatus({ workspace_id, charityId, status: 'blocklisted', reason })
      setConfirmingBlocklistId(null)
      setBlocklistReason('')
      setTypedName('')
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
      {/* Filter pills — mockup-07 .f-chip: square, mono-caps, cobalt active fill */}
      <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter charities by status">
        {FILTER_LABELS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveFilter(value)}
            aria-pressed={activeFilter === value}
            className={`min-h-[44px] border px-3 font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1 ${
              activeFilter === value
                ? 'border-[color:var(--color-cobalt)] bg-[color:var(--color-cobalt)] text-white font-semibold'
                : 'border-[color:var(--color-faint)] bg-[color:var(--color-card)] text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-card-alt)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length > 50 && !showAll && (
        <p className="font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-faint)]">
          Showing latest 50 of {filtered.length}
        </p>
      )}

      {actionError && (
        <p role="alert" className="font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-vermilion)]">
          {actionError}
        </p>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-8 text-center">
          <p className="font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-ink)]">
            No charities yet
          </p>
          <p className="mt-1 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
            Charities appear here as the Scout pitches candidates. You can also add entries manually.
          </p>
        </div>
      )}

      {/* Table — uniform pattern: hard edges, mono-caps faint th, mono numerals */}
      {filtered.length > 0 && (
        <div className="overflow-x-auto border border-[color:var(--color-faint)] bg-[color:var(--color-card)]">
          <table className="w-full font-[family-name:var(--font-ui)] text-[13px]">
            <thead>
              <tr className="border-b border-[color:var(--color-faint)] text-left">
                <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[.12em] text-[color:var(--color-faint)]">
                  Name
                </th>
                <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[.12em] text-[color:var(--color-faint)]">
                  Website
                </th>
                <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[.12em] text-[color:var(--color-faint)]">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[.12em] text-[color:var(--color-faint)]">
                  Featured
                </th>
                <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[.12em] text-[color:var(--color-faint)]">
                  Last Featured
                </th>
                <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[.12em] text-[color:var(--color-faint)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleCharities.map((charity, i) => {
                const isConfirmingThisBlocklist = confirmingBlocklistId === charity._id
                const isPendingThisAction = pendingAction === charity._id
                const isExpanded = expandedCharityId === charity._id
                const isLastVisibleRow = i === visibleCharities.length - 1 && !isExpanded

                return (
                  <Fragment key={charity._id}>
                  <tr
                    className={`hover:bg-[color:var(--color-card-alt)] transition-colors ${isLastVisibleRow ? '' : 'border-b border-[color:var(--color-faint)]'}`}
                  >
                    <td className="px-4 py-3 font-[family-name:var(--font-display)] text-[15px] font-semibold text-[color:var(--color-ink)]">
                      {charity.name}
                    </td>
                    <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-ink-soft)] max-w-[200px]">
                      {charity.website ? (
                        <a
                          href={charity.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={charity.website}
                          className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
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
                    <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-ink-soft)]">
                      {charity.timesFeatured != null && charity.timesFeatured > 0
                        ? pluralizeFeatured(charity.timesFeatured)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-ink-soft)]">
                      {formatRelativeTime(charity.lastFeaturedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {charity.status === 'blocklisted' ? (
                          /* Restore action — immediate. Value/handler
                             unchanged (Phase 50-03 label swap only). */
                          <button
                            type="button"
                            onClick={() => handleUnblocklist(charity._id)}
                            disabled={isPendingThisAction}
                            aria-busy={isPendingThisAction}
                            className="min-h-[44px] text-[13px] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1 px-1"
                          >
                            {isPendingThisAction ? 'Updating…' : 'Restore to consideration'}
                          </button>
                        ) : isConfirmingThisBlocklist ? (
                          /* Inline Mark Do-not-use confirmation — Phase 50-03
                             (D-15) adds the typed org-name gate on top of the
                             Phase 43 reason-only confirm. The confirm button
                             stays disabled until BOTH the typed name matches
                             the charity's exact name AND reason is non-empty. */
                          <div className="space-y-2 border border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] p-3 text-[13px]">
                            <p className="font-semibold text-[color:var(--color-ink)]">Mark Do not use?</p>
                            <p className="text-[color:var(--color-ink-soft)]">
                              The Scout will skip{' '}
                              <span className="font-medium">{charity.name}</span> in all
                              future runs.
                            </p>
                            <label
                              htmlFor={`blocklist-typed-name-${charity._id}`}
                              className="block font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]"
                            >
                              Type the organization&rsquo;s name to confirm: {charity.name}
                            </label>
                            <input
                              id={`blocklist-typed-name-${charity._id}`}
                              type="text"
                              value={typedName}
                              onChange={e => setTypedName(e.target.value)}
                              disabled={isPendingThisAction}
                              required
                              placeholder={charity.name}
                              className="w-full min-h-[44px] border border-[color:var(--color-faint)] bg-[color:var(--color-card)] px-2 py-1 text-[13px] text-[color:var(--color-ink)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
                            />
                            <label
                              htmlFor={`blocklist-reason-${charity._id}`}
                              className="block font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]"
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
                              className="w-full min-h-[44px] border border-[color:var(--color-faint)] bg-[color:var(--color-card)] px-2 py-1 text-[13px] text-[color:var(--color-ink)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleBlocklist(charity._id, charity.name)}
                                disabled={
                                  isPendingThisAction ||
                                  blocklistReason.trim() === '' ||
                                  typedName.trim() !== charity.name.trim()
                                }
                                aria-busy={isPendingThisAction}
                                className="min-h-[44px] border border-[color:var(--color-vermilion)] bg-[color:var(--color-vermilion)] px-3 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
                              >
                                {isPendingThisAction ? 'Marking…' : 'Mark Do not use'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmingBlocklistId(null)
                                  setBlocklistReason('')
                                  setTypedName('')
                                }}
                                disabled={isPendingThisAction}
                                className="min-h-[44px] border border-[color:var(--color-faint)] px-3 text-[13px] text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Mark Do-not-use trigger — opens inline confirm.
                             Locked for a Collaborator (ROL-03/D-09): the
                             typed-confirmation + reason flow (Phase 50) stays
                             unreachable behind this lock. */
                          <LockedControl isLocked={isLocked} lockedLabel="🔒 editor only">
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmingBlocklistId(charity._id)
                                setBlocklistReason('')
                                setTypedName('')
                              }}
                              className="min-h-[44px] text-[13px] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1 px-1"
                            >
                              Mark Do not use
                            </button>
                          </LockedControl>
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
                          className="min-h-[44px] text-[13px] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1 px-1"
                        >
                          {expandedCharityId === charity._id ? 'Hide corrections' : 'Add correction'}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Phase 39 (MEM-02): expanded row — add correction + chronological log */}
                  {expandedCharityId === charity._id && (
                    <tr className={`bg-[color:var(--color-card-alt)] ${i === visibleCharities.length - 1 ? '' : 'border-b border-[color:var(--color-faint)]'}`}>
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
          {filtered.length > 50 && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full border-t border-[color:var(--color-faint)] px-4 py-3 text-[11px] font-medium text-[color:var(--color-cobalt)] hover:bg-[color:var(--color-card-alt)]"
            >
              Show all ({filtered.length})
            </button>
          )}
        </div>
      )}
    </div>
  )
}
