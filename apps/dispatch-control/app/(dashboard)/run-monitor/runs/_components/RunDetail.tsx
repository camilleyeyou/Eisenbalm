'use client'
/**
 * Phase 23 — OBS-04 + Phase 25 RUN-04/RUN-05: Run detail view.
 *
 * Displays full information for a single run:
 *   - Run header: status, trigger source, who triggered, duration, cost
 *   - Cancel Run button (running-only, two-step inline confirm — RUN-04)
 *   - Per-step table: action name + agent, status, costUsd, durationMs,
 *     tokensIn, tokensOut, error, Re-roll (section writers only — RUN-05)
 *   - Reconciliation panel: per-agent sum (from parseCostJson(run.cost).agents)
 *     vs. runs.cost.total — both rendered side-by-side for OBS-04 visibility
 *
 * Data sources:
 *   api.runs.byRunId       → run header + cost.total
 *   api.agentRuns.byRunId  → per-agent live status rows
 *
 * Phase 50 (WBN-02, D-07/D-08/D-09): the per-step table no longer shows the
 * raw `agentKey` as the step name. Each row is keyed off `runStepFor()`
 * (`lib/nomenclature.ts`) — action label PRIMARY, agent secondary. The seven
 * section writers (+ the `validate_sections` join point) collapse into ONE
 * "Draft sections" row, expandable to the per-writer detail (mirrors the
 * Graph spine's `WriterExpansion.tsx` precedent). `calibrator`/`chronicler`
 * have no §7 entry (`named: false`) — they render as dimmed "supporting
 * step" rows, never invented as one of the 11 named steps, never blank. The
 * header states plainly whether this is a **historical record** (finished
 * run) or a **live run** (in-flight) — the legacy idle-state term is banned
 * here per the nomenclature table's Old->new column.
 *
 * quick 260722-v01 (audit item 9): mechanical class-token swap onto the
 * `var(--color-*)` / bracket-pixel system used across the issues/workspace
 * surfaces — no structural change, no testid/behavior change.
 */
import { Fragment, useState } from 'react'
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { parseCostJson } from '@/lib/costRollup'
import { runStepFor } from '@/lib/nomenclature'
import { issueHref, issueDraftHref } from '@/lib/issueRouteResolver'
import { PIPELINE_NODES } from '../../graph/_components/pipelineTopology'
import CancelRunButton from './CancelRunButton'
import RerollButton from './RerollButton'
import RecoveryRail from './RecoveryRail'

interface RunDetailProps {
  runId: string
}

interface AgentRunRow {
  _id: string
  agentKey: string
  status: string
  costUsd?: number
  durationMs?: number
  tokensIn?: number
  tokensOut?: number
  error?: string
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(ms: number | undefined | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}

// quick 260724-lp1: geometry square-off only — same color-token mapping as
// before (running/done/failed/awaiting-review/cancelled), a matching-hue
// border added so the rounded-full pill converts cleanly to a hard-edged
// square chip. No hue/opacity recolor.
const STATUS_CLASSES: Record<string, string> = {
  running: 'border-[color:var(--color-cobalt)] bg-[color:var(--color-cobalt)]/15 text-[color:var(--color-cobalt)]',
  queued: 'border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] text-[color:var(--color-ink-soft)]',
  done: 'border-[color:var(--color-green)] bg-[color:var(--color-green)]/15 text-[color:var(--color-green)]',
  failed: 'border-[color:var(--color-vermilion)] bg-[color:var(--color-vermilion)]/15 text-[color:var(--color-vermilion)]',
  'awaiting-review': 'border-[color:var(--color-marigold)] bg-[color:var(--color-marigold)]/20 text-[color:var(--color-marigold-text)]',
  cancelled: 'border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] text-[color:var(--color-ink-soft)]',
}

/** Uniform square-chip base classes (mono caps, hard edge, thin border). */
const CHIP_BASE =
  'inline-flex items-center border px-2 py-[3px] font-[family-name:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[.09em]'

// ── §7 step-state vocabulary (DERIVED-STATE-CONTRACT.md §7) ──────────────────
// "Waiting · Running · Complete · Paused — done · Failed · Skipped." The
// `agent_runs.status` column only ever carries queued/running/done/failed
// (convex/schema.ts) — Paused/Skipped are the failed-run recovery rail's
// vocabulary (WBN-03, Plan 50-05) and are not produced at this layer.
const STEP_STATE_LABELS: Record<string, string> = {
  queued: 'Waiting',
  running: 'Running',
  done: 'Complete',
  failed: 'Failed',
}

function stepStateLabel(status: string): string {
  return STEP_STATE_LABELS[status] ?? status
}

// ── historical-record vs live-run framing (D-09) ──────────────────────────────

/** Run statuses that mean "still in flight" — everything else is finished. */
const LIVE_RUN_STATUSES = new Set(['running', 'queued', 'awaiting-review'])

function isLiveRun(status: string): boolean {
  return LIVE_RUN_STATUSES.has(status)
}

// ── Draft-sections collapse (D-07 / Pitfall 4) ────────────────────────────────

/** Per-writer labels shown only inside the expanded "Draft sections" group. */
const WRITER_SUB_LABELS: Record<string, string> = {
  origin_story: 'Origin Story',
  problem: 'Problem',
  founder_bio: 'Founder Bio',
  case_study: 'Case Study',
  game: 'Game',
  bonus: 'Bonus',
  design: 'Design',
  validate_sections: 'Section validation',
}

interface StepGroup {
  /** Stable identity for React keys — the group's first agentKey. */
  groupKey: string
  actionLabel: string
  agentLabel: string
  named: boolean
  /** True only for the collapsed 7-writers + validate_sections unit. */
  isDraftSections: boolean
  members: AgentRunRow[]
}

/**
 * Groups the flat `agent_runs` rows into the 11 §7 steps (+ supporting
 * calibrator/chronicler rows), ordered by the real pipeline topology
 * (`PIPELINE_NODES`) rather than Convex's insertion order. The 7 section
 * writers and `validate_sections` all share the §7 "Draft sections" action
 * label (`lib/nomenclature.ts`), so grouping by actionLabel collapses them
 * into ONE group automatically — no separate writer-detection logic needed.
 */
function buildStepGroups(agentRuns: AgentRunRow[]): StepGroup[] {
  const runByKey = new Map(agentRuns.map(r => [r.agentKey, r]))
  // Pipeline-order keys first (the common case), then any stray agentKey
  // not present in the static topology (degrades gracefully, never drops
  // a row).
  const orderedKeys = [
    ...PIPELINE_NODES.filter(k => runByKey.has(k)),
    ...agentRuns.map(r => r.agentKey).filter(k => !PIPELINE_NODES.includes(k)),
  ]

  // Map preserves insertion order (per spec), so `.values()` below yields
  // groups in the same order their first member was first encountered.
  const groupsByKey = new Map<string, StepGroup>()

  for (const agentKey of orderedKeys) {
    const run = runByKey.get(agentKey)
    if (!run) continue
    const step = runStepFor(agentKey)
    const isDraftSections = step.actionLabel === 'Draft sections'
    // Every writer + validate_sections shares ONE group; every other step
    // (including the two supporting nodes) gets its own group.
    const groupKey = isDraftSections ? 'draft-sections' : agentKey

    let group = groupsByKey.get(groupKey)
    if (!group) {
      group = {
        groupKey,
        actionLabel: step.actionLabel,
        agentLabel: step.agentLabel,
        named: step.named,
        isDraftSections,
        members: [],
      }
      groupsByKey.set(groupKey, group)
    }
    group.members.push(run)
  }

  return Array.from(groupsByKey.values())
}

/** Worst-of aggregate: failed beats running beats waiting beats complete. */
function aggregateStatus(members: AgentRunRow[]): string {
  if (members.some(m => m.status === 'failed')) return 'failed'
  if (members.some(m => m.status === 'running')) return 'running'
  if (members.some(m => m.status === 'queued')) return 'queued'
  return 'done'
}

function sumCost(members: AgentRunRow[]): number | undefined {
  const values = members.map(m => m.costUsd).filter((v): v is number => v != null)
  if (values.length === 0) return undefined
  return values.reduce((acc, v) => acc + v, 0)
}

/** Writers fan out in parallel — the group's wall-clock cost is the slowest
 * member, not the sum. */
function maxDuration(members: AgentRunRow[]): number | undefined {
  const values = members.map(m => m.durationMs).filter((v): v is number => v != null)
  if (values.length === 0) return undefined
  return Math.max(...values)
}

function sumTokens(members: AgentRunRow[], field: 'tokensIn' | 'tokensOut'): number | undefined {
  const values = members.map(m => m[field]).filter((v): v is number => v != null)
  if (values.length === 0) return undefined
  return values.reduce((acc, v) => acc + v, 0)
}

export default function RunDetail({ runId }: RunDetailProps) {
  const run = useQuery(api.runs.byRunId, { runId })
  const agentRuns = useQuery(api.agentRuns.byRunId, { runId })
  // Quick 260724-x4b (LD-4) — the `runs` row does NOT carry issueNumber
  // (only `pipelineRuns` does); resolves runId -> issueNumber for the "Open
  // issue →" link below.
  const pipelineRun = useQuery(api.pipelineRuns.byRunId, { runId })
  const issueNumber = pipelineRun?.issueNumber
  const [draftSectionsExpanded, setDraftSectionsExpanded] = useState(false)

  if (run === undefined || agentRuns === undefined) {
    return (
      <div className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)] py-4">
        Loading run details…
      </div>
    )
  }

  if (run === null) {
    return (
      <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-8 text-center">
        <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
          Run{' '}
          <code className="font-[family-name:var(--font-mono)] text-[color:var(--color-ink)]">
            {runId}
          </code>{' '}
          not found.
        </p>
        <Link
          href="/run-monitor/runs"
          className="mt-4 inline-block font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-cobalt)] hover:underline"
        >
          ← Back to Runs
        </Link>
      </div>
    )
  }

  const cost = parseCostJson(run.cost)
  const runStatusClass =
    STATUS_CLASSES[run.status] ?? 'bg-[color:var(--color-card-alt)] text-[color:var(--color-ink-soft)]'
  const liveRun = isLiveRun(run.status)

  // Per-agent sum: sum of agents[agentKey].usd values from runs.cost.agents
  const perAgentSum = Object.values(cost.agents).reduce(
    (acc, entry) => acc + (entry.usd ?? 0),
    0,
  )

  const stepGroups = buildStepGroups(agentRuns as AgentRunRow[])

  // quick 260719-w6o (F4) — the §37.4(c) paused-at-Gate-1 predicate,
  // computed from this `runs`-table row (has status + completedAt,
  // convex/schema.ts:254-256). Mutually exclusive with status==='failed'
  // (mirrors deriveState.ts's isPausedAtGate1 shape against a run object
  // rather than DerivationInputs — 47-RESEARCH/§scope_notes: intentional,
  // not cross-boundary duplication worth a shared helper).
  const isPausedAtGate1 = run.status === 'awaiting-review' && run.completedAt == null

  return (
    <div className="space-y-6">
      {/* Back link + Open issue link (LD-4: connects this run back to the issue workspace) */}
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/run-monitor/runs"
          className="flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-cobalt)] hover:text-[color:var(--color-cobalt-dark)] hover:underline"
        >
          ← Back to all runs
        </Link>
        {issueNumber != null && (
          <Link
            href={
              run.status === 'awaiting-review' || run.status === 'complete'
                ? issueDraftHref(issueNumber)
                : issueHref(issueNumber)
            }
            className="flex min-h-[44px] items-center font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-cobalt)] hover:text-[color:var(--color-cobalt-dark)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-cobalt)]"
          >
            Open issue →
          </Link>
        )}
      </div>

      {/* Run header */}
      <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-5 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-[15px] font-semibold text-[color:var(--color-ink)]">
            Run Details
          </h2>
          {/* D-09: state plainly whether this is a historical record or a
              live run — the banned legacy idle-state term never appears. */}
          <span
            className={`font-[family-name:var(--font-ui)] text-[11px] font-medium ${liveRun ? 'text-[color:var(--color-cobalt)]' : 'text-[color:var(--color-ink-soft)]'}`}
          >
            {liveRun
              ? 'Live run — steps update as they complete'
              : 'Historical record — this run has finished'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 font-[family-name:var(--font-ui)] text-[13px] sm:grid-cols-3">
          <div>
            <p className="text-[11px] text-[color:var(--color-ink-soft)] uppercase tracking-wide mb-1">
              Run ID
            </p>
            <p className="font-[family-name:var(--font-mono)] text-[color:var(--color-ink)] break-all">
              {run.runId}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[color:var(--color-ink-soft)] uppercase tracking-wide mb-1">
              Status
            </p>
            <span
              className={`${CHIP_BASE} ${runStatusClass}`}
            >
              {run.status}
            </span>
          </div>
          <div>
            <p className="text-[11px] text-[color:var(--color-ink-soft)] uppercase tracking-wide mb-1">
              Trigger
            </p>
            <p className="text-[color:var(--color-ink)]">{run.triggerSource}</p>
          </div>
          <div>
            <p className="text-[11px] text-[color:var(--color-ink-soft)] uppercase tracking-wide mb-1">
              Triggered By
            </p>
            <p className="text-[color:var(--color-ink)]">{run.triggeredBy ?? '—'}</p>
          </div>
          <div>
            <p className="text-[11px] text-[color:var(--color-ink-soft)] uppercase tracking-wide mb-1">
              Started
            </p>
            <p className="text-[color:var(--color-ink)]">{formatTimestamp(run.startedAt)}</p>
          </div>
          <div>
            <p className="text-[11px] text-[color:var(--color-ink-soft)] uppercase tracking-wide mb-1">
              Duration
            </p>
            <p className="text-[color:var(--color-ink)]">{formatDuration(run.durationMs)}</p>
          </div>
        </div>
      </div>

      {/* Failed-run recovery rail (Phase 50, WBN-03, D-10/D-11/D-12) — the
          plain-language what-happened / what-completed / what-didn't-happen /
          recommended-recovery explanation, mounted whenever this run's
          status is "failed". */}
      {run.status === 'failed' && (
        <RecoveryRail
          runId={runId}
          agentRuns={agentRuns as AgentRunRow[]}
          // §37.4(c)'s paused-at-Gate-1 predicate is status==='awaiting-review'
          // && completedAt==null — mutually exclusive with status==='failed',
          // so this mount is always false here. Left explicit (not omitted)
          // so the honesty matrix's contract stays visible at the call site.
          isPausedAtGate1={false}
        />
      )}

      {/* quick 260719-w6o (F4) — a genuinely paused run gets its own reachable
          recovery rail (Signal Desk adjudication link), unhardcoding the dead
          nomenclature editor_gate_1 'live' branch for the first time in the
          shipped app. Failed and paused are mutually exclusive, so this
          mount never overlaps the one above. */}
      {isPausedAtGate1 && (
        <RecoveryRail
          runId={runId}
          agentRuns={agentRuns as AgentRunRow[]}
          isPausedAtGate1={true}
        />
      )}

      {/* Cancel Run button (running-only — RUN-04) */}
      <CancelRunButton runId={runId} status={run.status} />

      {/* Per-step table (Phase 50, D-07: action-primary/agent-secondary rows) */}
      <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] overflow-x-auto">
        <div className="px-5 py-3 border-b border-[color:var(--color-ink)]/10">
          <h3 className="font-[family-name:var(--font-display)] text-[15px] font-semibold text-[color:var(--color-ink)]">
            Per-Step Status
          </h3>
        </div>
        {stepGroups.length === 0 ? (
          <div className="px-5 py-6 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
            No agent runs recorded for this run yet.
          </div>
        ) : (
          <table className="w-full font-[family-name:var(--font-ui)] text-[13px]">
            <thead>
              <tr className="border-b border-[color:var(--color-ink)]/10 bg-[color:var(--color-card-alt)] text-left">
                <th className="px-4 py-3 font-medium text-[color:var(--color-ink-soft)]">Step</th>
                <th className="px-4 py-3 font-medium text-[color:var(--color-ink-soft)]">Status</th>
                <th className="px-4 py-3 font-medium text-[color:var(--color-ink-soft)]">Cost</th>
                <th className="px-4 py-3 font-medium text-[color:var(--color-ink-soft)]">Duration</th>
                <th className="px-4 py-3 font-medium text-[color:var(--color-ink-soft)]">Tokens In</th>
                <th className="px-4 py-3 font-medium text-[color:var(--color-ink-soft)]">Tokens Out</th>
                <th className="px-4 py-3 font-medium text-[color:var(--color-ink-soft)]">Error</th>
                <th className="px-4 py-3 font-medium text-[color:var(--color-ink-soft)]">Re-roll</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-ink)]/10">
              {stepGroups.map(group => {
                // ── Draft sections: ONE collapsible top-level row ───────────
                if (group.isDraftSections) {
                  const status = aggregateStatus(group.members)
                  const statusClass =
                    STATUS_CLASSES[status] ??
                    'bg-[color:var(--color-card-alt)] text-[color:var(--color-ink-soft)]'
                  const failedCount = group.members.filter(m => m.status === 'failed').length

                  return (
                    <Fragment key={group.groupKey}>
                      <tr className="hover:bg-[color:var(--color-card-alt)] transition-colors">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setDraftSectionsExpanded(v => !v)}
                            className="flex items-center gap-1.5 text-left font-medium text-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
                            aria-expanded={draftSectionsExpanded}
                          >
                            <span aria-hidden="true">{draftSectionsExpanded ? '▾' : '▸'}</span>
                            {group.actionLabel}
                          </button>
                          <p className="ml-4 text-[11px] text-[color:var(--color-faint)]">
                            — {group.agentLabel} ({group.members.length})
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`${CHIP_BASE} ${statusClass}`}
                          >
                            {stepStateLabel(status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[color:var(--color-ink-soft)]">
                          {(() => {
                            const total = sumCost(group.members)
                            return total != null ? `$${total.toFixed(4)}` : '—'
                          })()}
                        </td>
                        <td className="px-4 py-3 text-[color:var(--color-ink-soft)]">
                          {formatDuration(maxDuration(group.members))}
                        </td>
                        <td className="px-4 py-3 text-[color:var(--color-ink-soft)]">
                          {sumTokens(group.members, 'tokensIn')?.toLocaleString() ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-[color:var(--color-ink-soft)]">
                          {sumTokens(group.members, 'tokensOut')?.toLocaleString() ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-[color:var(--color-vermilion)] text-[11px]">
                          {failedCount > 0 ? `${failedCount} of ${group.members.length} failed` : '—'}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[color:var(--color-faint)]">
                          Expand for per-section re-roll
                        </td>
                      </tr>
                      {draftSectionsExpanded &&
                        group.members.map(ar => {
                          const arStatusClass =
                            STATUS_CLASSES[ar.status] ??
                            'bg-[color:var(--color-card-alt)] text-[color:var(--color-ink-soft)]'
                          const subLabel = WRITER_SUB_LABELS[ar.agentKey] ?? ar.agentKey
                          return (
                            <tr
                              key={ar._id}
                              className="bg-[color:var(--color-card-alt)]/60 hover:bg-[color:var(--color-card-alt)] transition-colors"
                            >
                              <td className="px-4 py-2 pl-10 text-[11px] text-[color:var(--color-ink-soft)]">
                                {subLabel}
                              </td>
                              <td className="px-4 py-2">
                                <span
                                  className={`${CHIP_BASE} ${arStatusClass}`}
                                >
                                  {stepStateLabel(ar.status)}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-[11px] text-[color:var(--color-ink-soft)]">
                                {ar.costUsd != null ? `$${ar.costUsd.toFixed(4)}` : '—'}
                              </td>
                              <td className="px-4 py-2 text-[11px] text-[color:var(--color-ink-soft)]">
                                {formatDuration(ar.durationMs)}
                              </td>
                              <td className="px-4 py-2 text-[11px] text-[color:var(--color-ink-soft)]">
                                {ar.tokensIn?.toLocaleString() ?? '—'}
                              </td>
                              <td className="px-4 py-2 text-[11px] text-[color:var(--color-ink-soft)]">
                                {ar.tokensOut?.toLocaleString() ?? '—'}
                              </td>
                              <td className="px-4 py-2 text-[color:var(--color-vermilion)] text-[11px]">
                                {ar.error ?? '—'}
                              </td>
                              <td className="px-4 py-2">
                                <RerollButton
                                  runId={runId}
                                  agentKey={ar.agentKey}
                                  runStatus={run.status}
                                />
                              </td>
                            </tr>
                          )
                        })}
                    </Fragment>
                  )
                }

                // ── Every other step: one row, action-primary/agent-secondary ──
                const ar = group.members[0]
                if (!ar) return null // unreachable — non-Draft-sections groups always have exactly 1 member
                const arStatusClass =
                  STATUS_CLASSES[ar.status] ??
                  'bg-[color:var(--color-card-alt)] text-[color:var(--color-ink-soft)]'

                return (
                  <tr
                    key={group.groupKey}
                    className={`hover:bg-[color:var(--color-card-alt)] transition-colors ${!group.named ? 'opacity-70' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[color:var(--color-ink)]">{group.actionLabel}</div>
                      {group.named ? (
                        <p className="text-[11px] text-[color:var(--color-faint)]">
                          — {group.agentLabel}
                        </p>
                      ) : (
                        <p className="text-[11px] italic text-[color:var(--color-faint)]">
                          supporting step
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`${CHIP_BASE} ${arStatusClass}`}
                      >
                        {stepStateLabel(ar.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-ink-soft)]">
                      {ar.costUsd != null ? `$${ar.costUsd.toFixed(4)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-ink-soft)]">
                      {formatDuration(ar.durationMs)}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-ink-soft)]">
                      {ar.tokensIn?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-ink-soft)]">
                      {ar.tokensOut?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-vermilion)] text-[11px]">
                      {ar.error ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <RerollButton
                        runId={runId}
                        agentKey={ar.agentKey}
                        runStatus={run.status}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Cost reconciliation panel (OBS-04) */}
      <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-5">
        <h3 className="font-[family-name:var(--font-display)] text-[15px] font-semibold text-[color:var(--color-ink)] mb-4">
          Cost Reconciliation
        </h3>
        <div className="flex gap-8">
          <div>
            <p className="text-[11px] text-[color:var(--color-ink-soft)] uppercase tracking-wide mb-1">
              Per-Agent Sum
            </p>
            <p className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[color:var(--color-ink)]">
              {perAgentSum > 0 ? `$${perAgentSum.toFixed(4)}` : '$0.00'}
            </p>
            <p className="text-[11px] text-[color:var(--color-faint)] mt-0.5">
              Sum of agents in runs.cost
            </p>
          </div>
          <div className="w-px bg-[color:var(--color-faint)]" />
          <div>
            <p className="text-[11px] text-[color:var(--color-ink-soft)] uppercase tracking-wide mb-1">
              runs.cost.total
            </p>
            <p className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[color:var(--color-ink)]">
              {cost.total > 0 ? `$${cost.total.toFixed(4)}` : '$0.00'}
            </p>
            <p className="text-[11px] text-[color:var(--color-faint)] mt-0.5">
              Recorded by pipeline recorder
            </p>
          </div>
          {Math.abs(perAgentSum - cost.total) > 0.0001 && (
            <div>
              <p className="text-[11px] text-[color:var(--color-ink-soft)] uppercase tracking-wide mb-1">
                Discrepancy
              </p>
              <p className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[color:var(--color-vermilion)]">
                ${Math.abs(perAgentSum - cost.total).toFixed(4)}
              </p>
              <p className="text-[11px] text-[color:var(--color-faint)] mt-0.5">
                Investigate double-count
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
