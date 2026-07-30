'use client'
/**
 * quick 260730-ldn (Task 5) — `/issues` rewritten as the title-led Archive.
 *
 * Built to mockup 16. Split the way `RunScreen` is split: `ArchiveBody`
 * (pure, props only, unit-tested directly — `__tests__/ArchiveScreen.test.tsx`)
 * plus this default page component as the data wrapper.
 *
 * Data: ONE `api.issues.listWithTitles` subscription replaces
 * `api.issues.listForWorkspace` for the archive list — the long list must
 * never per-row-subscribe (the `RecentlyPublishedRowContainer` N+1 pattern
 * below is pre-existing and accepted ONLY for its bounded 5-row disclosure).
 *
 * Every existing capability is preserved, relocated:
 *   - `StartHereCard` — `inProgressIssueNumber` now comes from
 *     `useCurrentRun().issueNumber`, NEVER a `max(issueNumber)` scan (the
 *     defect Task 2 eliminated stays eliminated here).
 *   - `HeldIssueRow` (owns Reopen) — mounted via `heldSlot`, under the
 *     Archive's own generic "Held" group rows (which ALSO list held issues,
 *     title-led and searchable, per the ArchiveBody test contract). This is
 *     a deliberate, documented trade-off: held issues appear twice — once
 *     as a searchable archive row, once via the capability-preserving
 *     `HeldIssueRow` — rather than dropping either the searchability or the
 *     reopen action.
 *   - `ScheduledSlotCard` + the `ensureByNumber` reservation effect + the
 *     `fetchRepetitionNote` effect — survive verbatim, mounted via
 *     `scheduledSlot`. Both one-shot `useRef` guards, dependency arrays, and
 *     comments are UNCHANGED from the prior `issues/page.tsx`.
 *   - `RecentlyPublishedRowContainer` + `RecentlyPublishedRow` — kept,
 *     relocated into a collapsed `<details>` disclosure ("Verification
 *     record — recently published"), still capped at 5 rows.
 *   - `CreatePanel` — unchanged, still at the bottom (now also the target of
 *     The Run's "Start a run →").
 *   - `IssueCard` is REMOVED — every readout it carried now lives on The
 *     Run's identity line and gates (see `app/(dashboard)/run/`).
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation } from 'convex/react'
import { useAuth } from '@clerk/nextjs'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { useCurrentRun } from '@/lib/useCurrentRun'
import { issueTitleLabel, relativeWeekLabel, NO_TITLE_LABEL } from '@/lib/issueTitle'
import { issueDraftHref } from '@/lib/issueRouteResolver'
import { fetchRepetitionNote } from '@/lib/repetitionNoteClient'
import { DEFAULT_CADENCE, readConfigValue, formatScheduledForLabel, type Cadence } from '@/lib/scheduleLabel'
import ScheduledSlotCard from './_components/ScheduledSlotCard'
import HeldIssueRow from './_components/HeldIssueRow'
import RecentlyPublishedRow from './_components/RecentlyPublishedRow'
import CreatePanel from './_components/CreatePanel'
import StartHereCard from './_components/StartHereCard'
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

function ArchiveRowView({ row }: { row: ArchiveRow }) {
  const group = archiveGroupFor(row)
  const chip = GROUP_CHIP_META[group]
  const label = issueTitleLabel(row.title)
  const isLink = row.hasDrafts

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

  if (isLink) {
    return (
      <Link href={issueDraftHref(row.issueNumber)} className={rowClass} data-testid={`archive-row-${row.issueNumber}`}>
        {inner}
      </Link>
    )
  }
  return (
    <div className={`${rowClass} bg-[color:var(--color-card-alt)]`} data-testid={`archive-row-${row.issueNumber}`}>
      {inner}
    </div>
  )
}

// ── ArchiveBody (pure — no Convex, unit-testable directly) ──────────────────

export interface ArchiveBodyProps {
  rows: ArchiveRow[]
  startHereSlot?: React.ReactNode
  heldSlot?: React.ReactNode
  scheduledSlot?: React.ReactNode
  verificationSlot?: React.ReactNode
  createSlot?: React.ReactNode
}

export function ArchiveBody({
  rows,
  startHereSlot,
  heldSlot,
  scheduledSlot,
  verificationSlot,
  createSlot,
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
      <div className="mx-auto flex max-w-[1100px] flex-col gap-8 px-6 pb-16 pt-4">
        {startHereSlot}

        <div>
          <span className="font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[.14em] text-[color:var(--color-cobalt)]">
            Editorial
          </span>
          <h1 className="mt-[5px] font-[family-name:var(--font-display)] text-[31px] font-semibold leading-[1.05] text-[color:var(--color-ink)]">
            Archive
          </h1>
          <p className="mt-[6px] font-[family-name:var(--font-body)] text-[13.5px] italic text-[color:var(--color-ink-soft)]">
            Every issue this workspace has produced, by title.
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
                <ArchiveRowView key={row.issueNumber} row={row} />
              ))}
              {key === 'held' && heldSlot}
              {key === 'scheduled' && scheduledSlot}
            </div>
          ) : null,
        )}

        {verificationSlot}

        {createSlot}
      </div>
    </div>
  )
}

// ── RecentlyPublishedRowContainer — bounded per-row subscription, accepted ──
// (pre-existing, capped at 5 rows). Narrowed prop type (not `Doc<'issues'>`)
// since the wrapper now sources rows from `listWithTitles`, not
// `listForWorkspace` — only `issueNumber`/`publishedAt` are ever read here.

function RecentlyPublishedRowContainer({
  issue,
}: {
  issue: { issueNumber: number; publishedAt?: number }
}) {
  const run = useQuery(api.pipelineRuns.byIssueNumber, { issueNumber: issue.issueNumber })
  const runId = run?.runId ?? null

  const signOffs = useQuery(api.signOffs.activeByRunId, runId ? { runId } : 'skip')
  const claimSummary = useQuery(api.claimChecks.allSignedOff, runId ? { runId } : 'skip')

  return (
    <RecentlyPublishedRow
      issue={{ issueNumber: issue.issueNumber, publishedAt: issue.publishedAt }}
      verification={{
        checked: claimSummary?.signedOff ?? 0,
        total: claimSummary?.total ?? 0,
        factsClearedBy: signOffs?.['facts-cleared']?.actorId,
        factsClearedAt: signOffs?.['facts-cleared']?.signedAt,
        voiceApprovedBy: signOffs?.['sounds-human']?.actorId,
        voiceApprovedAt: signOffs?.['sounds-human']?.signedAt,
      }}
    />
  )
}

// ── Default export — the data-fetching wrapper ───────────────────────────────

export default function ArchivePage() {
  const { getToken } = useAuth()
  const run = useCurrentRun()

  const issuesList = useQuery(api.issues.listWithTitles, { workspace_id: DEFAULT_WORKSPACE_ID })
  const configRows = useQuery(api.pipelineConfig.getAll, { workspace_id: DEFAULT_WORKSPACE_ID })

  const cadence = readConfigValue<Cadence>(configRows, 'schedule_cadence') ?? DEFAULT_CADENCE
  const scheduleNextRunAt = readConfigValue<number>(configRows, 'schedule_next_run_at')
  const scheduledForLabel = formatScheduledForLabel(scheduleNextRunAt, cadence)

  const maxIssueNumber =
    issuesList && issuesList.length > 0 ? Math.max(...issuesList.map(i => i.issueNumber)) : 0
  const nextIssueNumber = maxIssueNumber + 1

  // ── Scheduled-slot reservation (unchanged verbatim from the prior
  // issues/page.tsx — quick 260730-i4j's Task-1b extraction, still the same
  // one-shot useRef guard + dependency array). ─────────────────────────────
  const ensureByNumber = useMutation(api.issues.ensureByNumber)
  const ensuredRef = useRef(false)
  useEffect(() => {
    if (ensuredRef.current) return
    if (issuesList === undefined) return
    ensuredRef.current = true
    const alreadyReserved = issuesList.some(i => i.issueNumber === nextIssueNumber)
    if (alreadyReserved) return
    void ensureByNumber({
      workspace_id: DEFAULT_WORKSPACE_ID,
      issueNumber: nextIssueNumber,
      scheduledFor: scheduleNextRunAt,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issuesList, nextIssueNumber, scheduleNextRunAt])

  const [repetitionNote, setRepetitionNote] = useState<string | null>(null)
  const noteFetchedRef = useRef(false)
  // Quick 260721-ohu note: this effect's deps ([getToken]) are intentionally
  // UNCHANGED — it is already safe against getToken's reference churn
  // because of the noteFetchedRef one-shot guard immediately below (any
  // refire early-returns before doing work).
  useEffect(() => {
    if (noteFetchedRef.current) return
    noteFetchedRef.current = true
    let cancelled = false
    void (async () => {
      try {
        const token = await getToken()
        const result = await fetchRepetitionNote(token)
        if (!cancelled) setRepetitionNote(result.note)
      } catch {
        // Tolerate a RepetitionNoteError (or any other failure) — the slot
        // still renders, just without the note (D-10, Claude's discretion).
        if (!cancelled) setRepetitionNote(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [getToken])

  const now = Date.now()
  const rows: ArchiveRow[] = (issuesList ?? []).map(issue => {
    const dek = issue.held
      ? (issue.heldReason ?? '')
      : issue.runId === null
        ? `Discovery runs ${scheduledForLabel}. No drafts yet.`
        : (issue.subtitle ?? '')
    return {
      issueNumber: issue.issueNumber,
      title: issue.title,
      dek,
      hasDrafts: issue.hasDrafts,
      runId: issue.runId,
      published: issue.published,
      held: issue.held,
      relativeWeek: relativeWeekLabel(
        issue.runStartedAt ?? issue.publishedAt ?? issue.createdAt,
        now,
      ),
    }
  })

  const heldIssues = (issuesList ?? []).filter(i => i.held && !i.published)
  const publishedIssues = (issuesList ?? [])
    .filter(i => i.published)
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
    .slice(0, 5)

  const heldSlot =
    heldIssues.length > 0 ? (
      <div className="mt-2 flex flex-col gap-1 border-t border-[color:var(--color-ink)]/[.08] pt-2">
        <span className="font-[family-name:var(--font-ui)] text-[10.5px] uppercase tracking-[.06em] text-[color:var(--color-faint)]">
          Reopen
        </span>
        {heldIssues.slice(0, 8).map(issue => (
          <HeldIssueRow key={issue._id} issue={issue} />
        ))}
        {heldIssues.length > 8 && (
          <p className="font-[family-name:var(--font-ui)] text-[11px] text-[color:var(--color-ink-soft)]">
            +{heldIssues.length - 8} more held
          </p>
        )}
      </div>
    ) : undefined

  const scheduledSlot =
    issuesList !== undefined ? (
      <div className="mt-2">
        <ScheduledSlotCard
          issueNumber={nextIssueNumber}
          scheduledForLabel={scheduledForLabel}
          note={repetitionNote}
        />
      </div>
    ) : undefined

  const verificationSlot =
    publishedIssues.length > 0 ? (
      <details className="border border-[color:var(--color-ink)]/[.1] bg-[color:var(--color-card)] p-4">
        <summary className="cursor-pointer font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
          Verification record — recently published
        </summary>
        <div className="mt-2 flex flex-col gap-1">
          {publishedIssues.map(issue => (
            <RecentlyPublishedRowContainer key={issue._id} issue={issue} />
          ))}
        </div>
      </details>
    ) : undefined

  return (
    <ArchiveBody
      rows={rows}
      startHereSlot={<StartHereCard inProgressIssueNumber={run.issueNumber} />}
      heldSlot={heldSlot}
      scheduledSlot={scheduledSlot}
      verificationSlot={verificationSlot}
      createSlot={<CreatePanel nextIssueNumber={nextIssueNumber} />}
    />
  )
}

// Re-export for tests/callers that need the "no title" constant alongside
// ArchiveRow's own title:null convention.
export { NO_TITLE_LABEL }
