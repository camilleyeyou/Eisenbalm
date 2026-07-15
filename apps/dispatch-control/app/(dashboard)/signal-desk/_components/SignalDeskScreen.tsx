'use client'
/**
 * Phase 37 (SIG-01/02/03, Plan 37-05 Task 3) — SignalDeskScreen: the Client
 * Component shell for the Signal Desk. Mirrors run-monitor/graph/page.tsx's
 * Server→Client split (Pitfall 3-style reasoning there: Convex `useQuery`
 * subscriptions need a live ConvexProvider context, so this shell — not
 * page.tsx — owns them).
 *
 * Composition:
 *   - CandidateSlate is ALWAYS shown (SIG-01) — the operator should always
 *     be able to see the slate, paused or not.
 *   - When the run is paused at Gate 1 (`status === 'awaiting-review' &&
 *     completedAt == null` — API_CONTRACTS §37.4(c), Research Pitfall 4),
 *     AdjudicationPanel replaces the resolved DecisionPanel (SIG-03).
 *   - Otherwise the resolved DecisionPanel (winner/confidence/reasoning)
 *     renders (SIG-02) — this covers both a finished run and a run that
 *     hasn't reached Gate 1 yet (DecisionPanel's own empty state handles
 *     the latter).
 *
 * The candidate list handed to AdjudicationPanel reuses CandidateSlate's own
 * `joinCandidates` helper (SIG-01's join) rather than re-deriving advocate
 * data a second way — one join, two consumers.
 */
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import {
  CandidateSlate,
  joinCandidates,
  type PitchLogRow,
  type AdvocateArgumentRow,
} from './CandidateSlate'
import { DecisionPanel } from './DecisionPanel'
import { AdjudicationPanel } from './AdjudicationPanel'

export interface SignalDeskScreenProps {
  workspace_id: string
  /**
   * Plan 41-04 (D-09, Pitfall 2 guard): ADDITIVE optional issue-keyed run.
   * When provided, SignalDeskScreen scopes ENTIRELY to this run — it skips
   * `api.runs.latest` altogether — so Stage 1 (Story, Plan 41-07) can mount
   * the Signal Desk for a SPECIFIC issue's run, not the workspace's latest
   * run. When absent, behavior is byte-identical to the legacy `/signal-desk`
   * route (which passes only `workspace_id`): `runs.latest` resolves the
   * run to show.
   */
  runId?: string
}

interface LatestRun {
  runId: string
}

interface PipelineRunRow {
  status: string
  completedAt?: number
}

export function SignalDeskScreen({ workspace_id, runId: passedRunId }: SignalDeskScreenProps) {
  // Legacy path (no runId prop): resolve the workspace's latest run exactly
  // as before. Issue-keyed path (runId prop present): skip this query
  // entirely — the passed run is authoritative and must never be silently
  // overridden by whatever run happens to be latest.
  const latestRun = useQuery(api.runs.latest, passedRunId ? 'skip' : { workspace_id }) as
    | LatestRun
    | null
    | undefined
  const effectiveRunId = passedRunId ?? latestRun?.runId

  const run = useQuery(api.pipelineRuns.byRunId, effectiveRunId ? { runId: effectiveRunId } : 'skip') as
    | PipelineRunRow
    | null
    | undefined

  const pitchRows = useQuery(api.pitchLog.byRunId, effectiveRunId ? { runId: effectiveRunId } : 'skip') as
    | PitchLogRow[]
    | undefined
  const advocateRows = useQuery(
    api.deliberationEvents.byRunIdAndType,
    effectiveRunId ? { runId: effectiveRunId, eventType: 'advocate-argument' } : 'skip',
  ) as AdvocateArgumentRow[] | undefined

  if (!effectiveRunId) {
    return (
      <div className="p-6">
        <p className="text-[13px] text-[color:var(--color-ink-soft)]">No runs yet.</p>
      </div>
    )
  }

  // Gate-1-paused detection (SIG-03, §37.4(c)): 'awaiting-review' with no
  // completedAt means the run is paused inside editor_gate_1's interrupt();
  // 'awaiting-review' WITH completedAt is the finished-run Review Desk flow
  // (a different screen entirely) — never enter adjudication for that case.
  const isPausedAtGate1 = run?.status === 'awaiting-review' && run?.completedAt == null

  const candidates = pitchRows && advocateRows ? joinCandidates(pitchRows, advocateRows) : []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[color:var(--color-ink)]">
          Signal Desk
        </h1>
        <p className="mt-0.5 text-[13px] text-[color:var(--color-ink-soft)]">
          The charity decision — candidate slate, Gate 1 verdict, and adjudication when paused.
        </p>
      </div>

      <CandidateSlate runId={effectiveRunId} />

      {isPausedAtGate1 ? (
        <AdjudicationPanel
          runId={effectiveRunId}
          candidates={candidates.map(c => ({
            charityName: c.charityName,
            advocateScore: c.advocateScore,
          }))}
        />
      ) : (
        <DecisionPanel runId={effectiveRunId} />
      )}
    </div>
  )
}
