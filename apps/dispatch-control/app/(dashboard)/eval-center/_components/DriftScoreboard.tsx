'use client'
/**
 * DriftScoreboard — the append-only `eval_scores` TIME-SERIES render
 * (Phase 38, EVL-04, D-09/D-10). This is the editorial drift detector: for
 * each standard test case it renders the FULL history of scored runs (overall,
 * promptVersion, source, ranAt) across prompt versions — never collapsed to
 * a single latest number (that's ScenarioCard's job, D-08). Reads
 * `listForScenario` directly (ascending by `ranAt`, oldest-first — the
 * Convex index's own order, per §38.2) once per scenario.
 *
 * Each scenario's series is its own child component (`ScenarioDriftSeries`)
 * so every scenario gets its own `useQuery` hook instance — the correct React
 * pattern for a per-item subscription over a dynamic list, rather than
 * calling `useQuery` inside a `.map()` in this component's own body.
 *
 * quick 260722-tv1: each series' table now wraps in `overflow-x-auto` and
 * caps to its latest 20 rows (rows are ascending oldest-first, so `slice(-20)`
 * is the latest 20) with a per-scenario "Show all" toggle — an unbounded
 * history table ran indefinitely long for a scenario with a long eval history.
 */
import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import type { EvalScenario } from '@/lib/evalScenarioClient'
import type { EvalScoreRow } from './ScenarioCard'

export interface DriftScoreboardProps {
  workspaceId: string
  scenarios: EvalScenario[]
}

export default function DriftScoreboard({ workspaceId, scenarios }: DriftScoreboardProps) {
  return (
    <section
      aria-label="Drift scoreboard"
      className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4"
    >
      <h2 className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[.09em] text-[color:var(--color-ink-soft)]">
        Drift scoreboard
      </h2>
      <p className="mt-1 text-[12px] text-[color:var(--color-ink-soft)]">
        Append-only time-series across prompt versions — the full history, not
        a single latest number.
      </p>

      {scenarios.length === 0 ? (
        <p className="mt-3 text-[13px] italic text-[color:var(--color-ink-soft)]">
          No standard test cases yet.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {scenarios.map(scenario => (
            <ScenarioDriftSeries key={scenario.id} workspaceId={workspaceId} scenario={scenario} />
          ))}
        </div>
      )}
    </section>
  )
}

function ScenarioDriftSeries({
  workspaceId,
  scenario,
}: {
  workspaceId: string
  scenario: EvalScenario
}) {
  const rows = useQuery(api.evalScores.listForScenario, {
    workspace_id: workspaceId,
    scenarioId: scenario.id,
  }) as EvalScoreRow[] | undefined
  // Called unconditionally so hook order stays stable across the
  // loading/empty/populated renders below.
  const [showAll, setShowAll] = useState(false)
  const visibleRows = rows === undefined ? [] : showAll ? rows : rows.slice(-20)

  return (
    <div data-testid={`drift-series-${scenario.id}`}>
      <h3 className="font-[family-name:var(--font-ui)] text-[12px] font-semibold text-[color:var(--color-ink)]">
        {scenario.whatItCatches}
      </h3>

      {rows === undefined ? (
        <p className="mt-1 text-[12px] text-[color:var(--color-ink-soft)]">Loading…</p>
      ) : rows.length === 0 ? (
        <p
          data-testid={`drift-never-evaluated-${scenario.id}`}
          className="mt-1 text-[12px] italic text-[color:var(--color-faint)]"
        >
          Never evaluated
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="mt-1 w-full min-w-[420px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-[color:var(--color-faint)] text-left text-[10px] uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
                  <th className="py-1 pr-2 font-medium">Ran at</th>
                  <th className="py-1 pr-2 font-medium">Version</th>
                  <th className="py-1 pr-2 font-medium">Source</th>
                  <th className="py-1 font-medium">Overall</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, i) => (
                  <tr
                    key={`${row.promptVersion}-${row.ranAt}-${i}`}
                    data-testid={`drift-point-${scenario.id}-${i}`}
                    className="border-b border-[color:var(--color-faint)]/40"
                  >
                    <td className="py-1 pr-2 text-[color:var(--color-ink-soft)]">
                      {new Date(row.ranAt).toLocaleString()}
                    </td>
                    <td className="py-1 pr-2 font-mono">{row.promptVersion}</td>
                    <td className="py-1 pr-2">{row.source}</td>
                    <td className="py-1 font-semibold text-[color:var(--color-ink)]">
                      {row.overall.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 20 && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-1 text-[11px] font-medium text-[color:var(--color-cobalt)] hover:underline"
            >
              Show all ({rows.length})
            </button>
          )}
        </>
      )}
    </div>
  )
}
