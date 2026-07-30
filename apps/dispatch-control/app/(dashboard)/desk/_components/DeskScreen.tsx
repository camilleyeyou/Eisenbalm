'use client'
/**
 * quick 260730-i4j (Task 2) — the Desk (`/desk`): a work-first front door.
 *
 * One run band (status, elapsed, cost vs. budget, claim coverage, 5-stage
 * strip — the "run details" readout) plus every open task from
 * `deriveTasks()`, severity-grouped, each row deep-linking to its existing
 * `primary.href`. A quiet strip at the bottom demotes the four blocks the
 * Issues home leads with (schedule, held, recently published, create) —
 * `/issues` is unchanged and still reachable from the nav as the archive.
 *
 * Structured exactly like `MyTasksScreen.tsx`: a pure exported `DeskBody`
 * (props only, no Convex, unit-testable directly — see
 * `__tests__/DeskScreen.test.tsx`) plus a default-export `DeskScreen` that is
 * the thin data-fetching wrapper. Zero new Convex query shapes — every
 * subscription here is one `issues/page.tsx` or `MyTasksScreen.tsx` already
 * makes; every derivation runs through `lib/derivedState.ts`.
 */
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { AlertTriangle } from 'lucide-react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import {
  deriveIssueStatus,
  deriveStageStates,
  deriveTasks,
  estimateWorkMinutes,
  deriveRunCostUsd,
  deriveRunCapUsd,
  formatElapsed,
  TASK_SEVERITY_RENDER_ORDER,
  type DerivationInputs,
  type DerivedTask,
  type IssueStatus,
  type StageState,
  type StageStateResult,
  type TaskSeverity,
} from '@/lib/derivedState'
import {
  issueStoryHref,
  issueDraftHref,
  issueFactCheckHref,
  issueVoiceHref,
  issueApprovalHref,
} from '@/lib/issueRouteResolver'
import {
  DEFAULT_CADENCE,
  readConfigValue,
  formatScheduledForLabel,
  type Cadence,
} from '@/lib/scheduleLabel'
import { STAGE_STATE_LABELS } from '@/app/(dashboard)/issues/_components/StageStrip'
import DocumentTitle from '@/components/ui/DocumentTitle'

// ── Run band state (mirrors issues/page.tsx's cardState / IssueCard's `state`,
// with an additional 'none' kind for "confirmed no issue in progress" — the
// Desk must never confuse "still loading" with "there is genuinely nothing
// here", so the two get distinct kinds. ───────────────────────────────────
export type DeskRunBandState =
  | { kind: 'loading' }
  | { kind: 'unknown' }
  | { kind: 'ok' }
  | { kind: 'none' }

export interface DeskBodyProps {
  todayKicker: string
  issueNumber: number | null
  runBandState: DeskRunBandState
  status: IssueStatus
  stages: StageStateResult[]
  elapsedLabel: string
  runCostUsd: number | undefined
  capUsd: number
  claimsChecked: number
  claimsTotal: number
  tasks: DerivedTask[]
  workMinutes: number
  scheduledForLabel: string
  heldCount: number
  recentlyPublishedLabel: string | null
  onRefresh?: () => void
}

const STAGE_META: Array<{ label: string; hrefFor: (n: number) => string }> = [
  { label: 'Story', hrefFor: issueStoryHref },
  { label: 'Draft', hrefFor: issueDraftHref },
  { label: 'Fact Check', hrefFor: issueFactCheckHref },
  { label: 'Voice', hrefFor: issueVoiceHref },
  { label: 'Approval', hrefFor: issueApprovalHref },
]

// DerivedTask.stage is 1..5, Story..Approval — the SAME order STAGE_META
// (and STAGE_TABS in issues/[issueNumber]/layout.tsx) uses.
const TASK_STAGE_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Story',
  2: 'Draft',
  3: 'Fact Check',
  4: 'Voice',
  5: 'Approval',
}

const SEVERITY_GROUP_META: Record<
  TaskSeverity,
  { heading: string; suffix?: string; colorClass: string }
> = {
  'must-fix': {
    heading: 'Must fix',
    suffix: 'blocks publish',
    colorClass: 'text-[color:var(--color-vermilion)]',
  },
  'review-recommended': {
    heading: 'Review recommended',
    colorClass: 'text-[color:var(--color-marigold-text)]',
  },
  information: { heading: 'Worth knowing', colorClass: 'text-[color:var(--color-cobalt)]' },
}

// Duplicated locally — the same small map IssueCard.tsx and
// issues/[issueNumber]/layout.tsx each already carry their own copy of
// (established codebase convention: no single shared export for this).
const STATUS_META: Record<Exclude<IssueStatus, 'unknown'>, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'var(--color-ink-soft)' },
  'needs-review': { label: 'Needs review', color: 'var(--color-marigold-text)' },
  ready: { label: 'Ready to publish', color: 'var(--color-green)' },
  published: { label: 'Published', color: 'var(--color-green)' },
  held: { label: 'Held', color: 'var(--color-vermilion)' },
  failed: { label: 'Run failed', color: 'var(--color-vermilion)' },
}

function StageDot({ state }: { state: StageState }) {
  const color =
    state === 'clean'
      ? 'var(--color-green)'
      : state === 'in-progress'
        ? 'var(--color-marigold)'
        : state === 'needs-you'
          ? 'var(--color-vermilion)'
          : 'var(--color-faint)'
  // House rule: hard edges everywhere EXCEPT dots — dots are the only circles.
  return (
    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
  )
}

function Readout({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-right">
      <div className="font-[family-name:var(--font-mono)] text-[8.5px] uppercase tracking-[.12em] text-[color:var(--color-faint)]">
        {label}
      </div>
      <div className="mt-[3px] font-[family-name:var(--font-mono)] text-[12.5px] text-[color:var(--color-ink)]">
        {value}
      </div>
    </div>
  )
}

function RunBand({
  issueNumber,
  runBandState,
  status,
  stages,
  elapsedLabel,
  runCostUsd,
  capUsd,
  claimsChecked,
  claimsTotal,
  onRefresh,
}: {
  issueNumber: number | null
  runBandState: DeskRunBandState
  status: IssueStatus
  stages: StageStateResult[]
  elapsedLabel: string
  runCostUsd: number | undefined
  capUsd: number
  claimsChecked: number
  claimsTotal: number
  onRefresh?: () => void
}) {
  if (runBandState.kind === 'loading' || issueNumber === null) {
    // The `issueNumber === null` fallback here is defensive only — the
    // wrapper never reaches 'unknown'/'ok' without a resolved issueNumber.
    return (
      <div
        data-testid="run-band-loading"
        className="mt-5 animate-pulse border border-[color:var(--color-ink)]/[.15] bg-[color:var(--color-card)] p-5"
      >
        <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
          Loading run…
        </p>
      </div>
    )
  }

  if (runBandState.kind === 'unknown' || status === 'unknown') {
    return (
      <div className="mt-5 border border-[color:var(--color-vermilion)]/40 bg-[color:var(--color-card)] p-5">
        <div className="flex items-center gap-2">
          <AlertTriangle
            size={18}
            className="shrink-0 text-[color:var(--color-vermilion)]"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={onRefresh}
            className="min-h-[44px] font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[color:var(--color-vermilion)] underline underline-offset-2"
          >
            State unknown — refresh
          </button>
        </div>
      </div>
    )
  }

  const statusMeta = STATUS_META[status as Exclude<IssueStatus, 'unknown'>]

  return (
    <div className="mt-5 border border-[color:var(--color-ink)] bg-[color:var(--color-card)]">
      <div className="flex flex-wrap items-center gap-4 border-b border-[color:var(--color-ink)]/[.1] p-4">
        <span className="font-[family-name:var(--font-display)] text-[20px] font-semibold text-[color:var(--color-ink)]">
          Issue {issueNumber}
        </span>
        <span
          className="border border-[color:var(--color-ink)]/[.15] px-[9px] py-[4px] font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[.09em]"
          style={{ color: statusMeta.color }}
        >
          {statusMeta.label}
        </span>
        <Link
          href={issueDraftHref(issueNumber)}
          className="min-h-[44px] flex items-center font-[family-name:var(--font-ui)] text-[12px] font-semibold text-[color:var(--color-cobalt)]"
        >
          Open the draft →
        </Link>
        <div className="ml-auto flex gap-5">
          <Readout label="Elapsed" value={elapsedLabel} />
          <Readout
            label="Cost"
            value={
              runCostUsd === undefined
                ? 'cost unknown — refresh'
                : `$${runCostUsd.toFixed(2)} / $${capUsd.toFixed(2)}`
            }
          />
          <Readout label="Claims" value={`${claimsChecked} / ${claimsTotal}`} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5">
        {STAGE_META.map((meta, i) => {
          const stageResult = stages[i] ?? { state: 'not-generated' as const, openCount: 0 }
          const stateLabel = STAGE_STATE_LABELS[stageResult.state]
          const suffix =
            stageResult.state === 'needs-you' && stageResult.openCount > 0
              ? ` · ${stageResult.openCount}`
              : ''
          return (
            <Link
              key={meta.label}
              href={meta.hrefFor(issueNumber)}
              className="min-h-[44px] border-[color:var(--color-ink)]/[.1] p-3 hover:bg-[color:var(--color-card-alt)] lg:border-r lg:last:border-r-0"
            >
              <div className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[.1em] text-[color:var(--color-faint)]">
                {i + 1} · {meta.label}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-[color:var(--color-ink)]">
                <StageDot state={stageResult.state} />
                {stateLabel}
                {suffix}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function TaskGroup({ sev, tasks }: { sev: TaskSeverity; tasks: DerivedTask[] }) {
  const meta = SEVERITY_GROUP_META[sev]
  return (
    <section aria-label={meta.heading}>
      <div
        className={`flex items-center gap-2 border-b border-[color:var(--color-ink)] pb-2 font-[family-name:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[.12em] ${meta.colorClass}`}
      >
        <h2>{meta.heading}</h2>
        <span className="ml-auto font-[family-name:var(--font-mono)] text-[10.5px] font-normal normal-case tracking-normal text-[color:var(--color-faint)]">
          {tasks.length}
          {meta.suffix ? ` · ${meta.suffix}` : ''}
        </span>
      </div>
      <table className="w-full border-collapse border border-[color:var(--color-faint)] border-t-0 max-lg:block max-lg:border-none">
        <tbody className="max-lg:flex max-lg:flex-col max-lg:gap-3">
          {tasks.map(task => (
            <tr
              key={task.id}
              className="border-b border-[color:var(--color-faint)] last:border-b-0 hover:bg-[color:var(--color-card-alt)] max-lg:flex max-lg:flex-col max-lg:gap-2 max-lg:border max-lg:border-[color:var(--color-faint)] max-lg:bg-[color:var(--color-card)] max-lg:p-3"
            >
              <td className="p-3 align-top max-lg:block max-lg:p-0">
                <div className="text-[13.5px] font-medium leading-snug text-[color:var(--color-ink)]">
                  {task.title}
                </div>
                <div className="mt-1 font-[family-name:var(--font-body)] text-[12px] leading-snug text-[color:var(--color-ink-soft)]">
                  {task.why}
                </div>
              </td>
              <td className="whitespace-nowrap p-3 align-top font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.06em] text-[color:var(--color-faint)] max-lg:block max-lg:p-0">
                {task.where}
              </td>
              <td className="p-3 align-top max-lg:block max-lg:p-0">
                <span className="border border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] px-[7px] py-[3px] font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[.08em] text-[color:var(--color-ink-soft)]">
                  {TASK_STAGE_LABELS[task.stage]}
                </span>
              </td>
              <td className="p-3 text-right align-top max-lg:block max-lg:p-0 max-lg:text-left">
                <Link
                  href={task.primary.href}
                  className="inline-flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[12px] font-semibold text-[color:var(--color-cobalt)]"
                >
                  {task.primary.label}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function NothingNeedsYou() {
  return (
    <div className="mt-8 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-8 text-center">
      <p className="text-[15px] font-semibold text-[color:var(--color-ink)]">Nothing needs you.</p>
      <p className="mt-1 text-[13px] text-[color:var(--color-ink-soft)]">
        Every open claim, finding, and sign-off for the current issue is clear.
      </p>
    </div>
  )
}

function NoIssueInProgress({ scheduledForLabel }: { scheduledForLabel: string }) {
  return (
    <div className="mt-5 border border-[color:var(--color-ink)] bg-[color:var(--color-card)] p-8">
      <h2 className="font-[family-name:var(--font-display)] text-[20px] font-semibold text-[color:var(--color-ink)]">
        No issue in progress
      </h2>
      <p className="mt-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
        Discovery scheduled {scheduledForLabel}.
      </p>
    </div>
  )
}

function QuietStrip({
  scheduledForLabel,
  heldCount,
  recentlyPublishedLabel,
}: {
  scheduledForLabel: string
  heldCount: number
  recentlyPublishedLabel: string | null
}) {
  const cellClass =
    'flex flex-col gap-1 border-[color:var(--color-ink)]/[.1] pr-6 max-lg:border-r-0 max-lg:pr-0 lg:border-r lg:last:border-r-0 lg:last:pr-0'
  const labelClass =
    'font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[.12em] text-[color:var(--color-faint)]'
  const valueClass = 'font-[family-name:var(--font-mono)] text-[13px] text-[color:var(--color-ink)]'
  const linkClass = valueClass + ' text-[color:var(--color-cobalt)]'

  return (
    <div className="mt-10 flex flex-wrap gap-x-6 gap-y-4 border-t border-[color:var(--color-ink)]/[.1] pt-4 max-lg:flex-col">
      <div className={cellClass}>
        <span className={labelClass}>Next discovery</span>
        <span className={valueClass}>{scheduledForLabel}</span>
      </div>
      <div className={cellClass}>
        <span className={labelClass}>Held</span>
        <Link href="/issues" className={linkClass}>
          {heldCount} issue{heldCount === 1 ? '' : 's'}
        </Link>
      </div>
      <div className={cellClass}>
        <span className={labelClass}>Recently published</span>
        {recentlyPublishedLabel ? (
          <Link href="/issues" className={linkClass}>
            {recentlyPublishedLabel}
          </Link>
        ) : (
          <Link href="/issues" className={linkClass}>
            None yet
          </Link>
        )}
      </div>
      <div className={cellClass}>
        <span className={labelClass}>Start something new</span>
        <Link href="/issues" className={linkClass}>
          New issue →
        </Link>
      </div>
    </div>
  )
}

// ── DeskBody (pure — no Convex, unit-testable directly) ─────────────────────

export function DeskBody({
  todayKicker,
  issueNumber,
  runBandState,
  status,
  stages,
  elapsedLabel,
  runCostUsd,
  capUsd,
  claimsChecked,
  claimsTotal,
  tasks,
  workMinutes,
  scheduledForLabel,
  heldCount,
  recentlyPublishedLabel,
  onRefresh,
}: DeskBodyProps) {
  const buckets: Record<TaskSeverity, DerivedTask[]> = {
    'must-fix': [],
    'review-recommended': [],
    information: [],
  }
  for (const task of tasks) buckets[task.sev].push(task)

  const isNone = runBandState.kind === 'none'

  return (
    <div className="min-h-full bg-[color:var(--color-rail)] py-2">
      <DocumentTitle title="Desk" />
      <div className="mx-auto flex max-w-[1100px] flex-col px-6 pb-16 pt-4">
        <span className="font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[.14em] text-[color:var(--color-cobalt)]">
          {todayKicker}
        </span>
        <h1 className="mt-[5px] font-[family-name:var(--font-display)] text-[31px] font-semibold leading-[1.05] text-[color:var(--color-ink)]">
          Your desk
        </h1>
        <p className="mt-[6px] font-[family-name:var(--font-body)] text-[13.5px] italic text-[color:var(--color-ink-soft)]">
          {isNone
            ? 'No run in progress right now.'
            : `${tasks.length} open item${tasks.length === 1 ? '' : 's'} on the run in progress. Roughly ${workMinutes} min of judgment.`}
        </p>

        {isNone ? (
          <NoIssueInProgress scheduledForLabel={scheduledForLabel} />
        ) : (
          <>
            <RunBand
              issueNumber={issueNumber}
              runBandState={runBandState}
              status={status}
              stages={stages}
              elapsedLabel={elapsedLabel}
              runCostUsd={runCostUsd}
              capUsd={capUsd}
              claimsChecked={claimsChecked}
              claimsTotal={claimsTotal}
              onRefresh={onRefresh}
            />

            {runBandState.kind === 'ok' &&
              (tasks.length === 0 ? (
                <NothingNeedsYou />
              ) : (
                <div className="mt-8 flex flex-col gap-8">
                  {TASK_SEVERITY_RENDER_ORDER.filter(sev => buckets[sev].length > 0).map(sev => (
                    <TaskGroup key={sev} sev={sev} tasks={buckets[sev]} />
                  ))}
                </div>
              ))}
          </>
        )}

        <QuietStrip
          scheduledForLabel={scheduledForLabel}
          heldCount={heldCount}
          recentlyPublishedLabel={recentlyPublishedLabel}
        />
      </div>
    </div>
  )
}

// ── DeskScreen (default — the data-fetching wrapper) ─────────────────────────

// A stable reference (module-scoped, per quick 260721-pmn precedent) — never
// a fresh `{}` literal, which would retrigger downstream memoization on every
// render for no reason.
const EMPTY_SIGNOFFS: Record<string, { actorId: string; signedAt: number }> = {}

export default function DeskScreen() {
  const issuesList = useQuery(api.issues.listForWorkspace, { workspace_id: DEFAULT_WORKSPACE_ID })
  const configRows = useQuery(api.pipelineConfig.getAll, { workspace_id: DEFAULT_WORKSPACE_ID })

  // ── In-progress issue: highest-issueNumber row that is !published && !held ──
  const inProgressIssue =
    issuesList === undefined
      ? undefined
      : (issuesList.filter(i => !i.published && !i.held).sort((a, b) => b.issueNumber - a.issueNumber)[0] ??
        null)

  const inProgressRunQuery = useQuery(
    api.pipelineRuns.byIssueNumber,
    inProgressIssue ? { issueNumber: inProgressIssue.issueNumber } : 'skip',
  )
  const runLookupResolved = inProgressIssue === null || inProgressRunQuery !== undefined
  const runId: string | null = inProgressRunQuery?.runId ?? null

  const signOffsRaw = useQuery(api.signOffs.activeByRunId, runId ? { runId } : 'skip')
  const claimRowsRaw = useQuery(api.claimChecks.listByRunId, runId ? { runId } : 'skip')
  const claimSummary = useQuery(api.claimChecks.allSignedOff, runId ? { runId } : 'skip')
  const qaFindings = useQuery(api.qaCorrections.byRunId, runId ? { runId } : 'skip')
  const pitchRows = useQuery(api.pitchLog.byRunId, runId ? { runId } : 'skip')
  const runRow = useQuery(api.runs.byRunId, runId ? { runId } : 'skip')
  const latestRun = useQuery(api.runs.latest, { workspace_id: DEFAULT_WORKSPACE_ID })
  const agentRunsRows = useQuery(api.agentRuns.byRunId, runId ? { runId } : 'skip')

  // CRITICAL (ISS-06, D-18) — normalize the skip-produced `undefined` into a
  // loaded-and-empty `{}` once we've CONFIRMED there is no run. A brand-new
  // issue with no run would otherwise read "State unknown — refresh" forever.
  const signOffs = !runLookupResolved ? undefined : runId === null ? EMPTY_SIGNOFFS : signOffsRaw

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
    runStartedAt: latestRun?.startedAt,
    runCompletedAt: latestRun?.completedAt,
  }

  const status = deriveIssueStatus(derivationInputs)
  const stages = deriveStageStates(derivationInputs)
  // deriveTasks() is the sole source — do NOT wrap in computeSessionStates
  // (My Tasks' session-supersession concern, out of scope here).
  const tasks = deriveTasks(derivationInputs)
  const workMinutes = estimateWorkMinutes(tasks)

  const runCostUsd = deriveRunCostUsd(agentRunsRows)
  const capUsd = deriveRunCapUsd(configRows)
  const elapsedLabel = formatElapsed(runRow?.startedAt, Date.now(), runRow?.completedAt)

  let runBandState: DeskRunBandState = { kind: 'ok' }
  if (issuesList === undefined) {
    runBandState = { kind: 'loading' }
  } else if (inProgressIssue === null) {
    runBandState = { kind: 'none' }
  } else if (signOffs === undefined) {
    runBandState = { kind: 'loading' }
  } else if (status === 'unknown') {
    runBandState = { kind: 'unknown' }
  }

  const cadence = readConfigValue<Cadence>(configRows, 'schedule_cadence') ?? DEFAULT_CADENCE
  const scheduleNextRunAt = readConfigValue<number>(configRows, 'schedule_next_run_at')
  const scheduledForLabel = formatScheduledForLabel(scheduleNextRunAt, cadence)

  const heldIssues = (issuesList ?? []).filter(i => i.held && !i.published)
  const publishedIssues = (issuesList ?? [])
    .filter(i => i.published)
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
    .slice(0, 2)
  const recentlyPublishedLabel =
    publishedIssues.length > 0 ? publishedIssues.map(i => `Issue ${i.issueNumber}`).join(' · ') : null

  const todayKicker = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <DeskBody
      todayKicker={todayKicker}
      issueNumber={inProgressIssue ? inProgressIssue.issueNumber : null}
      runBandState={runBandState}
      status={status}
      stages={stages}
      elapsedLabel={elapsedLabel}
      runCostUsd={runCostUsd}
      capUsd={capUsd}
      claimsChecked={claimSummary?.signedOff ?? 0}
      claimsTotal={claimSummary?.total ?? 0}
      tasks={tasks}
      workMinutes={workMinutes}
      scheduledForLabel={scheduledForLabel}
      heldCount={heldIssues.length}
      recentlyPublishedLabel={recentlyPublishedLabel}
      onRefresh={() => window.location.reload()}
    />
  )
}
