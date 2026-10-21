'use client'
/**
 * Quick 261021-j83 — pure archive list (moved from the retired /issues page).
 * Props only; no Convex. The current issue's row opens `/`; a published row
 * opens the live issue; held rows keep Release via `heldSlot`.
 */
import { useState } from 'react'
import Link from 'next/link'
import { issueTitleLabel } from '@/lib/issueTitle'
import DocumentTitle from '@/components/ui/DocumentTitle'

// ── ArchiveRow — flat, pre-resolved shape ArchiveBody renders ───────────────

export interface ArchiveRow {
  issueNumber: number
  /** null === the run (if any) has never chosen a subject. */
  title: string | null
  /** Already resolved by the wrapper: subtitle, or the held reason, or the
   * scheduled copy, or '' — ArchiveBody never branches on WHY. */
  dek: string
  hasDrafts: boolean
  runId: string | null
  published: boolean
  held: boolean
  relativeWeek: string
}

export type ArchiveGroupKey = 'in-progress' | 'published' | 'held' | 'scheduled'

function archiveGroupFor(row: ArchiveRow): ArchiveGroupKey {
  if (row.published) return 'published'
  if (row.held) return 'held'
  if (row.runId !== null) return 'in-progress'
  return 'scheduled'
}

const GROUP_ORDER: Array<{ key: ArchiveGroupKey; heading: string }> = [
  { key: 'in-progress', heading: 'In progress' },
  { key: 'published', heading: 'Published' },
  { key: 'held', heading: 'Held' },
  { key: 'scheduled', heading: 'Scheduled' },
]

const GROUP_CHIP_META: Record<ArchiveGroupKey, { label: string; color: string }> = {
  'in-progress': { label: 'Needs review', color: 'var(--color-marigold-text)' },
  published: { label: 'Published', color: 'var(--color-green)' },
  held: { label: 'Held', color: 'var(--color-vermilion)' },
  scheduled: { label: 'Scheduled', color: 'var(--color-faint)' },
}

type ArchiveFilter = 'all' | 'published' | 'held' | 'has-drafts'

const FILTER_LABEL: Record<ArchiveFilter, string> = {
  all: 'All',
  published: 'Published',
  held: 'Held',
  'has-drafts': 'Has drafts',
}

function matchesQuery(row: ArchiveRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  if (String(row.issueNumber).includes(q)) return true
  return (row.title ?? '').toLowerCase().includes(q)
}

function matchesFilter(row: ArchiveRow, filter: ArchiveFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'published') return row.published
  if (filter === 'held') return row.held
  return row.hasDrafts
}

function ArchiveRowView({ row, currentIssueNumber }: { row: ArchiveRow; currentIssueNumber?: number | null }) {
  const group = archiveGroupFor(row)
  const chip = GROUP_CHIP_META[group]
  const label = issueTitleLabel(row.title)
  const isCurrent = currentIssueNumber != null && row.issueNumber === currentIssueNumber
  const liveBase = process.env.NEXT_PUBLIC_WEB_PREVIEW_BASE
  const liveHref =
    row.published && liveBase ? `${liveBase.replace(/\/$/, '')}/issue/issue-${row.issueNumber}` : null

  const inner = (
    <>
      <span
        data-testid={`archive-row-${row.issueNumber}-number`}
        className="w-16 shrink-0 font-[family-name:var(--font-mono)] text-[10.5px] text-[color:var(--color-faint)]"
      >
        {row.issueNumber}
      </span>
      <span className="min-w-0 flex-1">
        <span
          data-testid={`archive-row-${row.issueNumber}-title`}
          className={
            row.hasDrafts
              ? 'block font-[family-name:var(--font-display)] text-[19px] font-semibold leading-[1.22] text-[color:var(--color-ink)]'
              : 'block font-[family-name:var(--font-display)] text-[17px] font-normal italic leading-[1.22] text-[color:var(--color-faint)]'
          }
        >
          {label}
        </span>
        {row.dek && (
          <span className="mt-1 block truncate font-[family-name:var(--font-body)] text-[12.5px] italic text-[color:var(--color-ink-soft)]">
            {row.dek}
          </span>
        )}
      </span>
      <span className="w-28 shrink-0 text-right font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[.07em] text-[color:var(--color-faint)]">
        {row.relativeWeek}
      </span>
      <span className="flex w-[132px] shrink-0 justify-end">
        <span
          className="inline-flex items-center gap-[5px] border px-[7px] py-[3px] font-[family-name:var(--font-mono)] text-[9px] font-semibold uppercase tracking-[.09em]"
          style={{ color: chip.color, borderColor: chip.color }}
        >
          {group === 'published' && (
            <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: chip.color }} />
          )}
          {chip.label}
        </span>
      </span>
    </>
  )

  const rowClass =
    'flex items-baseline gap-4 border border-t-0 border-[color:var(--color-border)] bg-[color:var(--color-card)] px-[17px] py-[15px]'

  if (isCurrent) {
    return (
      <Link href="/" className={rowClass} data-testid={`archive-row-${row.issueNumber}`}>
        {inner}
      </Link>
    )
  }
  if (liveHref) {
    return (
      <a href={liveHref} className={rowClass} data-testid={`archive-row-${row.issueNumber}`}>
        {inner}
      </a>
    )
  }
  return (
    <div className={`${rowClass} bg-[color:var(--color-card-alt)]`} data-testid={`archive-row-${row.issueNumber}`}>
      {inner}
    </div>
  )
}

function ArchiveHeader() {
  const link =
    'inline-flex min-h-[44px] items-center px-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)] underline-offset-4 hover:underline'
  return (
    <header className="mx-auto flex max-w-[1100px] flex-wrap items-baseline justify-between gap-3 px-6 pt-6">
      <Link href="/" className="font-[family-name:var(--font-display)] text-[22px] text-[color:var(--color-ink)]">
        The Eisenbalm Dispatch
      </Link>
      <nav aria-label="Site" className="flex items-center gap-2">
        <Link href="/" className={link}>
          This week&rsquo;s issue
        </Link>
        <Link href="/admin" className={link}>
          Admin
        </Link>
      </nav>
    </header>
  )
}

// ── ArchiveBody (pure — no Convex, unit-testable directly) ──────────────────

export interface ArchiveBodyProps {
  rows: ArchiveRow[]
  heldSlot?: React.ReactNode
  scheduledSlot?: React.ReactNode
  verificationSlot?: React.ReactNode
  /** The current issue's row opens `/` instead of a console route. */
  currentIssueNumber?: number | null
}

export function ArchiveBody({
  rows,
  heldSlot,
  scheduledSlot,
  verificationSlot,
  currentIssueNumber,
}: ArchiveBodyProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ArchiveFilter>('all')

  const filtered = rows.filter(r => matchesQuery(r, query) && matchesFilter(r, filter))

  const groups: Record<ArchiveGroupKey, ArchiveRow[]> = {
    'in-progress': [],
    published: [],
    held: [],
    scheduled: [],
  }
  for (const row of filtered) groups[archiveGroupFor(row)].push(row)

  const hasAnyRows = GROUP_ORDER.some(g => groups[g.key].length > 0)

  return (
    <div className="min-h-full bg-[color:var(--color-rail)] py-2">
      <DocumentTitle title="Archive" />
      <ArchiveHeader />
      <div className="mx-auto flex max-w-[1100px] flex-col gap-8 px-6 pb-16 pt-4">
        <div>
          <h1 className="mt-[5px] font-[family-name:var(--font-display)] text-[31px] font-semibold leading-[1.05] text-[color:var(--color-ink)]">
            Archive
          </h1>
          <p className="mt-[6px] font-[family-name:var(--font-body)] text-[13.5px] italic text-[color:var(--color-ink-soft)]">
            Every issue so far, by title.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-[color:var(--color-ink)] pb-3">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='Search titles — "bicycle", "seed bank", "Kumasi"…'
            aria-label="Search titles"
            className="flex-1 border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 py-[9px] font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)]"
          />
          {(['all', 'published', 'held', 'has-drafts'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={
                filter === f
                  ? 'bg-[color:var(--color-ink)] px-3 py-[9px] font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.09em] text-[color:var(--color-masthead-text)]'
                  : 'border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 py-[9px] font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.09em] text-[color:var(--color-ink-soft)]'
              }
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>

        {!hasAnyRows && (
          <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
            {rows.length === 0 ? 'No issues yet.' : `No issues match "${query}".`}
          </p>
        )}

        {GROUP_ORDER.map(({ key, heading }) =>
          groups[key].length > 0 ? (
            <div key={key} className="flex flex-col gap-1">
              <h2 className="font-[family-name:var(--font-mono)] text-[9.5px] font-semibold uppercase tracking-[.12em] text-[color:var(--color-faint)]">
                {heading}
              </h2>
              {groups[key].map(row => (
                <ArchiveRowView key={row.issueNumber} row={row} currentIssueNumber={currentIssueNumber} />
              ))}
              {key === 'held' && heldSlot}
              {key === 'scheduled' && scheduledSlot}
            </div>
          ) : null,
        )}

        {verificationSlot}
      </div>
    </div>
  )
}

