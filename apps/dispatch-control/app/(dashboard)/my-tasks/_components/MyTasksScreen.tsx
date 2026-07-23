'use client'
/**
 * Phase 43 Plan 43-05 (§43.5/§43.6, TSK-01..TSK-05) — the /my-tasks screen.
 *
 * The nav-level, cross-stage answer to "what needs me right now, regardless
 * of where it came from?" — the screen the Masthead's count-only "My Tasks ·
 * N" readout (Phase 40 Plan 40-08) and the AwaitingYouInbox "See all" link
 * (Plan 43-05 Task 3) have always pointed at.
 *
 * DerivationInputs is assembled EXACTLY like Masthead.tsx's self-resolving
 * "current issue" shape (D-01): `runs.latest` -> `pipelineRuns.byRunId`
 * (issueNumber) -> `issues.byIssueNumber` (held/published) +
 * `signOffs.activeByRunId` / `claimChecks.listByRunId` /
 * `qaCorrections.byRunId` / `pitchLog.byRunId`, all keyed off the resolved
 * runId — the SAME Convex queries, zero new subscription shapes. The only
 * addition relative to Masthead's copy is the `createdAt`/`runStartedAt`
 * passthroughs Plan 43-03 added to `DerivationInputs` for task age (TSK-02),
 * and the `auditLog.listForWorkspace` read this screen needs on top for the
 * TSK-05 supersession predicate.
 *
 * `deriveTasks(inputs)` (lib/derivedState.ts) produces the real
 * cross-stage projection — no tasks table. `computeSessionStates`
 * (lib/taskSupersession.ts, Plan 43-04) wraps that projection with
 * session-local 'active' | 'resolved' | 'superseded' state by
 * cross-referencing `run.section_rerolled` audit-log rows (RESEARCH Pitfall
 * 2: `rerun_agent` does NOT clear stale qaCorrections/claim_checks rows for
 * the re-rolled section, so a rerolled task does not simply vanish).
 *
 * `MyTasksList` is exported as the PURE render half (no Convex) so it is
 * unit-testable directly against DisplayTask fixtures (__tests__/
 * MyTasksScreen.test.tsx) — MyTasksScreen (default export) is the thin
 * data-fetching wrapper that feeds it.
 *
 * quick 260722-v01 (audit item 2): `MyTasksList` groups its (already
 * severity-sorted) tasks into three `TaskSeverity` sections — "Must fix",
 * "Review recommended", "Information" — each with a "{label} · {count}"
 * micro-label header, in that order, omitting empty buckets. Row markup
 * (`renderTask`) is unchanged byte-for-byte from before the grouping.
 */
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import {
  deriveTasks,
  formatTaskAge,
  type DerivationInputs,
  type DerivedTask,
  type TaskSeverity,
} from '@/lib/derivedState'
import { computeSessionStates, type DisplayTask, type RerollSignal } from '@/lib/taskSupersession'
import { issueApprovalHref, issueDraftHref } from '@/lib/issueRouteResolver'
// Phase 44 Plan 44-08 (INS-01, §44.6) — the single shared inspector opener.
import { useInspector } from '@/components/inspector/InspectorProvider'
// Phase 49 Plan 08 (ROL-04) — the same persistent comments affordance
// FrameChrome mounts on the 5 stages + overview; My Tasks is a SIBLING route
// (not nested under issues/[issueNumber]/layout.tsx), so it needs its own
// placement (49-RESEARCH.md "Mount points"). My Tasks aggregates every open
// item for the current issue only (never a mixed set of issues), so a single
// reachable affordance keyed to that issueNumber is correct — no stage scope
// (an issue-overview-level comment), matching the bare-overview route.
import IssueComments from '@/app/(dashboard)/issues/[issueNumber]/_components/IssueComments'

// ── Severity label + icon (D-19, State & Icon Contract §Attention) ─────────
// NEVER color alone — every row pairs the label with a lucide icon.

const SEVERITY_META: Record<TaskSeverity, { label: string; Icon: LucideIcon; color: string }> = {
  'must-fix': { label: 'Must fix', Icon: AlertTriangle, color: 'var(--color-vermilion)' },
  'review-recommended': {
    label: 'Review recommended',
    Icon: AlertCircle,
    color: 'var(--color-marigold-text)',
  },
  information: { label: 'Information', Icon: Info, color: 'var(--color-ink-soft)' },
}

function SeverityBadge({ sev }: { sev: TaskSeverity }) {
  const meta = SEVERITY_META[sev]
  const Icon = meta.Icon
  return (
    <span
      className="flex items-center gap-[6px] font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.06em]"
      style={{ color: meta.color }}
    >
      <Icon size={13} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

const STRUCK_ROW =
  'flex flex-wrap items-center gap-x-3 gap-y-1 border border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] p-4 text-[color:var(--color-ink-soft)]'

const ROW_TITLE_LINE_THROUGH = 'line-through'

// quick 260722-v01 (audit item 2) — copied verbatim from StoryBriefScreen.tsx's MICRO_LABEL.
const MICRO_LABEL =
  'font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[.09em] text-[color:var(--color-ink-soft)]'

// Section render order — matches the sort order `deriveTasks` already produces.
const SEVERITY_SECTION_ORDER: TaskSeverity[] = ['must-fix', 'review-recommended', 'information']

// ── MyTasksList (pure — no Convex, unit-testable directly) ──────────────────

export function MyTasksList({
  tasks,
  approvalHref,
  // Phase 44 Plan 44-08 (INS-01) — `useInspector().openInspector`, supplied
  // by the default-export wrapper below. Optional + defaulted to a no-op so
  // this stays the pure, Convex-free render half MyTasksScreen.test.tsx
  // exercises directly (every fixture there has `insp` unset, so the
  // disabled branch renders and the no-op is never invoked).
  openInspector = () => {},
}: {
  tasks: DisplayTask[]
  approvalHref: string
  openInspector?: (key: string) => void
}) {
  if (tasks.length === 0) {
    return (
      <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-8 text-center">
        <p className="text-[15px] font-semibold text-[color:var(--color-ink)]">
          Nothing needs you.
        </p>
        <p className="mt-1 text-[13px] text-[color:var(--color-ink-soft)]">
          Every open claim, finding, and sign-off for the current issue is clear.
        </p>
        <Link
          href={approvalHref}
          className="mt-4 inline-block min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-4 py-2 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
        >
          Go to Approval
        </Link>
      </div>
    )
  }

  function renderTask(task: DisplayTask) {
    if (task.sessionState === 'resolved') {
      return (
        <li key={task.id} className={STRUCK_ROW}>
          <span className={ROW_TITLE_LINE_THROUGH}>{task.title}</span>
          <span className="font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-green)]">
            resolved {formatTaskAge(task.openedAt)}
          </span>
        </li>
      )
    }

    if (task.sessionState === 'superseded') {
      return (
        <li key={task.id} className={STRUCK_ROW}>
          <span className={ROW_TITLE_LINE_THROUGH}>{task.title}</span>
          <span className="font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-cobalt)]">
            superseded
          </span>
          <Link
            href={task.supersededBy ?? '/issues'}
            className="min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
          >
            See the new step
          </Link>
        </li>
      )
    }

    return (
      <li
        key={task.id}
        className="flex flex-col gap-2 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SeverityBadge sev={task.sev} />
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-ink-soft)]">
            Stage {task.stage}
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-ink-soft)]">
            {formatTaskAge(task.openedAt)}
          </span>
        </div>

        <p className="text-[15px] font-semibold text-[color:var(--color-ink)]">{task.title}</p>

        <p className="text-[13px] text-[color:var(--color-ink-soft)]">
          <span className="font-semibold text-[color:var(--color-ink)]">{task.where}</span>
          {' — '}
          <span>{task.why}</span>
        </p>

        {task.rec && (
          <p className="text-[13px] italic text-[color:var(--color-ink-soft)]">{task.rec}</p>
        )}

        <div className="mt-1 flex flex-wrap gap-2">
          <Link
            href={task.primary.href}
            className="min-h-[44px] rounded-[2px] bg-[color:var(--color-ink)] px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-white hover:opacity-90"
          >
            {task.primary.label}
          </Link>
          {task.insp ? (
            // Phase 44 Plan 44-08 (INS-01) — qa/claim tasks carry a
            // populated `insp` key (§44.1); the button is live.
            <button
              type="button"
              onClick={() => openInspector(task.insp!)}
              className="min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
            >
              Inspect context
            </button>
          ) : (
            // Sign-off tasks (signoff-facts/signoff-voice) have no
            // single natural artifact — the button stays reserved for
            // just those two rows (44-RESEARCH Open Question 1).
            <button
              type="button"
              disabled
              title="No single artifact anchors this sign-off — the inspector is reserved for this row."
              className="min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Inspect context
            </button>
          )}
        </div>
      </li>
    )
  }

  // quick 260722-v01 (audit item 2) — group the already severity-sorted
  // `tasks` array into Must fix / Review recommended / Information sections.
  const buckets: Record<TaskSeverity, DisplayTask[]> = {
    'must-fix': [],
    'review-recommended': [],
    information: [],
  }
  for (const task of tasks) {
    buckets[task.sev].push(task)
  }

  return (
    <div className="flex flex-col gap-6">
      {SEVERITY_SECTION_ORDER.filter(sev => buckets[sev].length > 0).map(sev => (
        <section key={sev} aria-label={SEVERITY_META[sev].label}>
          <h2 className={`${MICRO_LABEL} mb-2`}>
            {SEVERITY_META[sev].label} · {buckets[sev].length}
          </h2>
          <ul role="list" className="flex flex-col gap-3">
            {buckets[sev].map(task => renderTask(task))}
          </ul>
        </section>
      ))}
    </div>
  )
}

// ── MyTasksScreen (default — the data-fetching wrapper) ─────────────────────

// Every finding/claim task's `where` already carries the section name in a
// form `computeSessionStates` can bridge (snake_case for QA findings,
// camelCase for claims — see lib/taskSupersession.ts's qaSectionToGalleyId
// fallback). Sign-off tasks' `where` ("Approval") never matches an agentKey,
// so they are structurally never superseded — correct, since a reroll never
// touches a sign-off.
function taskSection(t: DerivedTask): string | undefined {
  return t.where
}

export default function MyTasksScreen() {
  // Phase 44 Plan 44-08 (INS-01, §44.6) — the single shared inspector
  // opener, mounted once at the (dashboard) root layout.
  const { openInspector } = useInspector()
  const latest = useQuery(api.runs.latest, { workspace_id: DEFAULT_WORKSPACE_ID })
  const pipelineRun = useQuery(
    api.pipelineRuns.byRunId,
    latest ? { runId: latest.runId } : 'skip',
  )

  const issueNumber = pipelineRun?.issueNumber ?? null
  const runId: string | null = latest?.runId ?? null

  const issueRow = useQuery(
    api.issues.byIssueNumber,
    issueNumber != null ? { workspace_id: DEFAULT_WORKSPACE_ID, issueNumber } : 'skip',
  )
  const signOffs = useQuery(api.signOffs.activeByRunId, runId ? { runId } : 'skip')
  const claimRowsRaw = useQuery(api.claimChecks.listByRunId, runId ? { runId } : 'skip')
  const qaFindings = useQuery(api.qaCorrections.byRunId, runId ? { runId } : 'skip')
  const pitchRows = useQuery(api.pitchLog.byRunId, runId ? { runId } : 'skip')

  // TSK-05 — the only queryable `run.section_rerolled` signal (§43.6).
  const auditRows = useQuery(api.auditLog.listForWorkspace, {
    workspace_id: DEFAULT_WORKSPACE_ID,
    limit: 200,
  })

  const claimRows = claimRowsRaw?.map(row => ({
    _id: row._id,
    status: row.status,
    sourceUrl: row.sourceUrl,
    sectionName: row.sectionName,
    claimText: row.text,
    // §43.5a (TSK-02) — additive passthrough for age.
    createdAt: row._creationTime,
  }))

  const derivationInputs: DerivationInputs = {
    issueNumber,
    runId,
    issue:
      issueRow === undefined
        ? undefined
        : issueRow
          ? { held: issueRow.held, published: issueRow.published }
          : null,
    signOffs,
    claimRows,
    qaFindings,
    pitchRows,
    runStatus: latest?.status,
    // §43.5a (TSK-02) — "since run start" anchor for missing-sign-off tasks.
    runStartedAt: latest?.startedAt,
  }

  const tasks = deriveTasks(derivationInputs)

  // resourceId shape: `"{runId}:{agentKey}"` (control.py `_emit_audit`,
  // rerun_agent). agentKey is everything after the first colon so it
  // survives runIds that themselves contain colons.
  const rerolls: RerollSignal[] = (auditRows ?? [])
    .filter(
      row =>
        row.action === 'run.section_rerolled' &&
        runId !== null &&
        row.resourceId !== undefined &&
        row.resourceId.startsWith(`${runId}:`),
    )
    .map(row => ({
      agentKey: row.resourceId!.slice(runId!.length + 1),
      timestamp: row.timestamp,
      // "the new step" — regenerated content lands back in Draft for
      // re-review, regardless of which stage originally surfaced the task.
      href: issueNumber != null ? issueDraftHref(issueNumber) : '/issues',
    }))

  const prevRef = useRef<DerivedTask[] | null>(null)
  const display = computeSessionStates(tasks, prevRef.current, rerolls, Date.now(), taskSection)

  // Update the snapshot AFTER this render commits, so the NEXT render's
  // `computeSessionStates` call diffs against what was actually shown.
  useEffect(() => {
    prevRef.current = tasks
  })

  const approvalHref = issueNumber != null ? issueApprovalHref(issueNumber) : '/issues'

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-[color:var(--color-ink)]">My Tasks</h1>
        <p className="mt-1 text-[13px] text-[color:var(--color-ink-soft)]">
          Every open claim, finding, and sign-off for the current issue — regardless of where it
          came from.
        </p>
      </div>
      <MyTasksList tasks={display} approvalHref={approvalHref} openInspector={openInspector} />
      {/*
        Phase 49 Plan 08 (ROL-04) — persistent, reachable comments affordance
        for the current issue. My Tasks has no "current issue" yet when no
        run has ever started (issueNumber === null) — omitted rather than
        rendered against a nonexistent issue.
      */}
      {issueNumber != null && <IssueComments issueNumber={issueNumber} />}
    </div>
  )
}
