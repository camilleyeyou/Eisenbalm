'use client'
/**
 * Phase 40 Plan 40-05 (§40-UI-SPEC, ISS-01/ISS-03/ISS-06) — Issues home.
 *
 * The primary editorial surface of v4.0: "what's the state of the
 * operation, and does it need me?" at a glance. Every readout derives from
 * EXISTING Convex queries via `lib/derivedState.ts` (Plan 40-04) — zero new
 * persisted fields. This page owns all querying + derivation; every
 * `_components/*` component below it is presentational.
 *
 * Load-bearing detail for ISS-06 (D-18): `deriveIssueStatus` treats
 * `signOffs === undefined` as NOT LOADED regardless of whether a run
 * exists. So once we've confirmed there is genuinely no run for the
 * in-progress issue (not "still loading" — actually resolved to no run),
 * `signOffs` must be normalized to `{}` (loaded-and-empty), never left as
 * the raw `undefined` a skipped query produces — otherwise a brand-new
 * issue with no run yet would show "State unknown — refresh" forever
 * instead of "Draft".
 *
 * quick 260722-tv1: root swapped `min-h-screen` + `px-6/lg:px-8` for
 * `min-h-full` + no horizontal padding — main already carries `p-6`, so the
 * old root double-guttered (48px) and overscrolled (~100px) past the
 * 100vh-52px shell. Held list is now client-capped to 8 with a `+N more` note.
 */
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useAuth } from '@clerk/nextjs'
import { api } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import {
  deriveIssueStatus,
  deriveStageStates,
  deriveTasks,
  estimateWorkMinutes,
  type DerivationInputs,
} from '@/lib/derivedState'
import { fetchRepetitionNote } from '@/lib/repetitionNoteClient'
import { parseCostJson } from '@/lib/costRollup'
import IssueCard from './_components/IssueCard'
import ScheduledSlotCard from './_components/ScheduledSlotCard'
import HeldIssueRow from './_components/HeldIssueRow'
import RecentlyPublishedRow from './_components/RecentlyPublishedRow'
import CreatePanel from './_components/CreatePanel'
import StartHereCard from './_components/StartHereCard'

type ConfigRow = { key: string; value: string }

function readConfigValue<T>(rows: ConfigRow[] | undefined, key: string): T | undefined {
  const row = rows?.find(r => r.key === key)
  if (!row) return undefined
  try {
    return JSON.parse(row.value) as T
  } catch {
    return undefined
  }
}

type Cadence = { dayOfWeek: number; hourUtc: number; minuteUtc: number }

// Same default AutomationPanel.tsx falls back to when no schedule_cadence
// row exists yet (Thu 14:00 UTC) — reused here for parity, not reinvented.
const DEFAULT_CADENCE: Cadence = { dayOfWeek: 4, hourUtc: 14, minuteUtc: 0 }

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** `{weekday} {HH:MM}` — prefers the concrete `schedule_next_run_at` Unix-ms
 * timestamp when set; falls back to the recurring cadence otherwise. Both
 * read the SAME `pipelineConfig` keys AutomationPanel.tsx already parses. */
function formatScheduledForLabel(nextRunAt: number | undefined, cadence: Cadence): string {
  if (nextRunAt) {
    const d = new Date(nextRunAt)
    return `${DAY_NAMES[d.getUTCDay()] ?? 'Unknown'} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
  }
  return `${DAY_NAMES[cadence.dayOfWeek] ?? 'Unknown'} ${pad2(cadence.hourUtc)}:${pad2(cadence.minuteUtc)}`
}

/** Recently-published rows resolve their OWN run + verification record —
 * each list item owns its Convex subscriptions (rules-of-hooks: a `.map`
 * cannot call hooks conditionally per item, so this lives in its own
 * component). */
function RecentlyPublishedRowContainer({ issue }: { issue: Doc<'issues'> }) {
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

export default function IssuesHomePage() {
  const { getToken } = useAuth()

  const issuesList = useQuery(api.issues.listForWorkspace, { workspace_id: DEFAULT_WORKSPACE_ID })
  const configRows = useQuery(api.pipelineConfig.getAll, { workspace_id: DEFAULT_WORKSPACE_ID })

  // ── In-progress issue: highest-issueNumber row that is !published && !held ──
  const inProgressIssue =
    issuesList === undefined
      ? undefined
      : (issuesList
          .filter(i => !i.published && !i.held)
          .sort((a, b) => b.issueNumber - a.issueNumber)[0] ?? null)

  const inProgressRunQuery = useQuery(
    api.pipelineRuns.byIssueNumber,
    inProgressIssue ? { issueNumber: inProgressIssue.issueNumber } : 'skip',
  )
  // Resolved once inProgressIssue is null (no in-progress issue — runId is
  // moot) or the run lookup itself has returned (doc or null).
  const runLookupResolved = inProgressIssue === null || inProgressRunQuery !== undefined
  const runId: string | null = inProgressRunQuery?.runId ?? null

  const signOffsRaw = useQuery(api.signOffs.activeByRunId, runId ? { runId } : 'skip')
  const claimRowsRaw = useQuery(api.claimChecks.listByRunId, runId ? { runId } : 'skip')
  const claimSummary = useQuery(api.claimChecks.allSignedOff, runId ? { runId } : 'skip')
  const qaFindings = useQuery(api.qaCorrections.byRunId, runId ? { runId } : 'skip')
  const pitchRows = useQuery(api.pitchLog.byRunId, runId ? { runId } : 'skip')
  const runCostRow = useQuery(api.runs.byRunId, runId ? { runId } : 'skip')
  const latestRun = useQuery(api.runs.latest, { workspace_id: DEFAULT_WORKSPACE_ID })

  // Normalize the skip-produced `undefined` into a loaded-and-empty `{}`
  // once we've CONFIRMED there is no run — see file header. While the run
  // lookup itself is still pending, leave signOffs as `undefined` (genuine
  // not-loaded) so the card correctly shows the loading skeleton.
  const signOffs = !runLookupResolved ? undefined : runId === null ? {} : signOffsRaw

  const claimRows = claimRowsRaw?.map(row => ({
    _id: row._id,
    status: row.status,
    sourceUrl: row.sourceUrl,
    sectionName: row.sectionName,
    claimText: row.text,
  }))

  const derivationInputs: DerivationInputs = {
    issueNumber: inProgressIssue ? inProgressIssue.issueNumber : null,
    runId,
    issue: inProgressIssue ? { held: inProgressIssue.held, published: inProgressIssue.published } : null,
    signOffs,
    claimRows,
    qaFindings,
    pitchRows,
    runStatus: latestRun?.status,
  }

  const status = deriveIssueStatus(derivationInputs)
  const stages = deriveStageStates(derivationInputs)
  const tasks = deriveTasks(derivationInputs)
  const workMinutes = estimateWorkMinutes(tasks)
  const runCostDisplay = `$${parseCostJson(runCostRow?.cost).total.toFixed(2)}`

  // ISS-06 wiring — NEVER show a prior/stale value. `signOffs === undefined`
  // covers both "still loading the run lookup" and "still loading sign-offs
  // for a known run"; `status === 'unknown'` is the structural fallback for
  // any other not-loaded/failed combination deriveIssueStatus detects.
  let cardState: { kind: 'loading' } | { kind: 'error' } | { kind: 'ok' } = { kind: 'ok' }
  if (signOffs === undefined) {
    cardState = { kind: 'loading' }
  } else if (status === 'unknown') {
    cardState = { kind: 'error' }
  }

  // ── Next scheduled slot (D-11) ──────────────────────────────────────────
  const maxIssueNumber =
    issuesList && issuesList.length > 0 ? Math.max(...issuesList.map(i => i.issueNumber)) : 0
  const nextIssueNumber = maxIssueNumber + 1

  const cadence = readConfigValue<Cadence>(configRows, 'schedule_cadence') ?? DEFAULT_CADENCE
  const scheduleNextRunAt = readConfigValue<number>(configRows, 'schedule_next_run_at')
  const scheduledForLabel = formatScheduledForLabel(scheduleNextRunAt, cadence)

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
  // refire early-returns before doing work). This is the precedent the
  // codebase already knew getToken could churn; the bug fixed elsewhere in
  // this quick task was effects that refire AND redo unguarded work.
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

  // ── Held + recently published ───────────────────────────────────────────
  const heldIssues = (issuesList ?? []).filter(i => i.held && !i.published)
  const publishedIssues = (issuesList ?? [])
    .filter(i => i.published)
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
    .slice(0, 5)

  return (
    <div className="min-h-full bg-[color:var(--color-rail)] py-2">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-12">
        <StartHereCard inProgressIssueNumber={inProgressIssue?.issueNumber ?? null} />

        {issuesList === undefined ? (
          <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
            Loading…
          </p>
        ) : inProgressIssue ? (
          <IssueCard
            issueNumber={inProgressIssue.issueNumber}
            status={status}
            stages={stages}
            openTaskCount={tasks.length}
            claimCoverage={{ checked: claimSummary?.signedOff ?? 0, total: claimSummary?.total ?? 0 }}
            voiceState={stages[3].state}
            workMinutes={workMinutes}
            runCostDisplay={runCostDisplay}
            state={cardState}
            // Convex queries are already live-subscribed — there is no
            // client-side "retry" lever to pull for a stuck/failed input.
            // A full reload re-establishes the websocket connection, the
            // documented last resort (40-05 plan, Claude's discretion).
            onRefresh={() => window.location.reload()}
          />
        ) : (
          // D-30 empty state — the CreatePanel below takes the focal point
          // (Visual-Hierarchy inversion); this block only carries the copy.
          <div className="w-full rounded-[2px] border border-[color:var(--color-ink)]/[.1] bg-[color:var(--color-card)] p-8">
            <h1 className="font-[family-name:var(--font-display)] text-[22px] font-semibold text-[color:var(--color-ink)]">
              No issue in progress
            </h1>
            <p className="mt-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
              No issue in progress — discovery scheduled {scheduledForLabel}.
            </p>
          </div>
        )}

        {issuesList !== undefined && (
          <ScheduledSlotCard
            issueNumber={nextIssueNumber}
            scheduledForLabel={scheduledForLabel}
            note={repetitionNote}
          />
        )}

        {heldIssues.length > 0 && (
          <div className="flex flex-col gap-1">
            <h2 className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.08em] text-[color:var(--color-ink-soft)]">
              Held
            </h2>
            {heldIssues.slice(0, 8).map(issue => (
              <HeldIssueRow key={issue._id} issue={issue} />
            ))}
            {heldIssues.length > 8 && (
              <p className="font-[family-name:var(--font-ui)] text-[11px] text-[color:var(--color-ink-soft)]">
                +{heldIssues.length - 8} more held
              </p>
            )}
          </div>
        )}

        {publishedIssues.length > 0 && (
          <div className="flex flex-col gap-1">
            <h2 className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.08em] text-[color:var(--color-ink-soft)]">
              Recently published
            </h2>
            {publishedIssues.map(issue => (
              <RecentlyPublishedRowContainer key={issue._id} issue={issue} />
            ))}
          </div>
        )}

        <CreatePanel nextIssueNumber={nextIssueNumber} />
      </div>
    </div>
  )
}
