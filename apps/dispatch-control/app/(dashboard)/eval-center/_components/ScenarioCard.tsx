'use client'
/**
 * ScenarioCard — one golden-scenario card (Phase 38, EVL-04, D-08).
 *
 * Shows the scenario's agentKey/id chip, description, whatItCatches, and its
 * "last result" — the latest (max `ranAt`) `eval_scores` row for this
 * scenarioId, read directly via `listForScenario` (Task 1's action explicitly
 * specifies this query + take-the-max-ranAt-overall shape). This card is
 * DELIBERATELY a single-number readout — the FULL time-series across every
 * historical run lives in DriftScoreboard.tsx (D-10), never here.
 *
 * A scenario with zero eval_scores rows renders a "never evaluated" empty
 * state rather than crashing (Task 1, Test 3).
 */
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import type { EvalScenario } from '@/lib/evalScenarioClient'

/** The §38.2 eval_scores row shape (mirrors evalScores.ts's `record` args + ranAt). */
export interface EvalScoreRow {
  scenarioId: string
  agentKey: string
  promptVersion: string
  overall: number
  axes: string
  costUsd: number
  ranAt: number
  source: string
}

export interface ScenarioCardProps {
  workspaceId: string
  scenario: EvalScenario
}

export default function ScenarioCard({ workspaceId, scenario }: ScenarioCardProps) {
  const rows = useQuery(api.evalScores.listForScenario, {
    workspace_id: workspaceId,
    scenarioId: scenario.id,
  }) as EvalScoreRow[] | undefined

  // Max-by-ranAt, NOT "last item in the array" — defensive against any future
  // change to listForScenario's ordering guarantee (currently ascending).
  const latest =
    rows && rows.length > 0
      ? rows.reduce((max, row) => (row.ranAt > max.ranAt ? row : max))
      : null

  return (
    <div
      data-testid={`scenario-card-${scenario.id}`}
      className="flex flex-col gap-2 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
          {scenario.agentKey}
        </span>
        <span className="font-mono text-[10px] text-[color:var(--color-faint)]">
          {scenario.id}
        </span>
      </div>

      <p className="text-[13px] leading-relaxed text-[color:var(--color-ink)]">
        {scenario.description}
      </p>

      <p className="text-[12px] italic leading-relaxed text-[color:var(--color-ink-soft)]">
        Catches: {scenario.whatItCatches}
      </p>

      <div className="mt-1 border-t border-[color:var(--color-faint)] pt-2">
        {rows === undefined ? (
          <p className="text-[12px] text-[color:var(--color-ink-soft)]">Loading…</p>
        ) : latest === null ? (
          <p
            data-testid={`scenario-never-evaluated-${scenario.id}`}
            className="text-[12px] italic text-[color:var(--color-faint)]"
          >
            Never evaluated
          </p>
        ) : (
          <p
            data-testid={`scenario-last-result-${scenario.id}`}
            className="text-[12px] font-semibold text-[color:var(--color-cobalt)]"
          >
            Last result: {latest.overall.toFixed(1)} (v{latest.promptVersion} · {latest.source})
          </p>
        )}
      </div>
    </div>
  )
}
