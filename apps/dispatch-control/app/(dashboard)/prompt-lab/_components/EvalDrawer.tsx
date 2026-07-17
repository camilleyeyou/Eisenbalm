'use client'
/**
 * Phase 38 (EVL-02, D-04/D-05) + Plan 38-05 — the Agent Instructions quality
 * test drawer (Phase 50 WBN-05 renamed from "Prompt Lab eval drawer").
 *
 * Auto-selects the standard test cases for the agent being edited (agentKey
 * === this.agentKey — no manual picking, D-04), and on an explicit "Test
 * changes" click runs each scenario through the EXISTING test-run -> score
 * primitive TWICE (once against the unsaved draft, once against the
 * currently active version — D-05, scaling TestRunPanel's 1-scenario
 * draft-vs-active pattern up to N scenarios). Each scored side is persisted
 * as an append-only `eval_scores` row so the Quality Tests drift time-series
 * (§38.2) and the activation check (§38.3) can read it.
 *
 * Freshness producer (closes the plan-review Blocker 1 — see Task 3 of
 * 38-05-PLAN.md / VersionHistoryPanel.tsx): when this drawer is mounted from
 * VersionHistoryPanel's "Test changes for v{N}" affordance (Phase 50 WBN-05
 * renamed from "Run evals for v{N}"), an explicit `targetVersion` prop is
 * supplied and the caller passes THAT version's saved content as
 * `draftPrompt`. In that mode the "draft" side of each run is really
 * re-evaluating version N, so its eval_scores row is tagged `promptVersion:
 * String(N)`, `source: 'commit'` — the STORED enum value stays
 * byte-unchanged (D-14) — the exact shape §38.3's `evaluateEvalGate` queries
 * via `by_workspace_agentKey_version` before allowing Activate(N) to proceed
 * on its non-override path. With no `targetVersion` (the normal iteration
 * case, mounted from AgentPromptEditorView), the draft side stays tagged
 * `promptVersion: 'draft'`, `source: 'drawer'`. The active side is ALWAYS
 * tagged `promptVersion: String(active.version)`, `source: 'drawer'`
 * regardless of `targetVersion` — the active side is never the thing being
 * activated.
 *
 * COST NOTE (38-RESEARCH Pitfall 3): N scenarios x 4 model calls (2 of them
 * Opus-tier `score`). Runs ONLY on the explicit button click below — NEVER on
 * mount or on any prop change (an agentKey change just re-selects scenarios;
 * a draftPrompt change is not observed by any effect at all).
 */
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { fetchScenarios, type EvalScenario } from '@/lib/evalScenarioClient'
import {
  runAgentTest,
  runActiveVersionTest,
  type TestRunResult,
} from '@/lib/testRunClient'
import { scoreOutput, type ScoreResult } from '@/lib/scoreClient'

export interface EvalDrawerProps {
  workspaceId: string
  agentKey: string
  /** The CURRENT unsaved draft (normal mode) OR a saved version's content
   * (freshness-producer mode, when `targetVersion` is also supplied). */
  draftPrompt: string
  /** Freshness-producer mode (Task 3): tags the draft-side eval_scores row
   * to this version + source 'commit' instead of 'draft' / 'drawer'. */
  targetVersion?: { version: number }
}

type RowStatus = 'idle' | 'running' | 'done' | 'error'

interface ScenarioRow {
  scenario: EvalScenario
  status: RowStatus
  draftOverall: number | null
  activeOverall: number | null
  error: string | null
}

function buildInitialRows(
  scenarios: EvalScenario[],
): Record<string, ScenarioRow> {
  return Object.fromEntries(
    scenarios.map(scenario => [
      scenario.id,
      {
        scenario,
        status: 'idle' as const,
        draftOverall: null,
        activeOverall: null,
        error: null,
      },
    ]),
  )
}

/** Signed delta text + the 1c cobalt(up)/vermilion(down) color token. */
function deltaColorClass(delta: number): string {
  return delta >= 0
    ? 'text-[color:var(--color-cobalt,#253ad4)]'
    : 'text-[color:var(--color-vermilion,#e8471d)]'
}

function formatSigned(delta: number): string {
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Merge a partial row update, falling back to a fresh idle row when the
 * scenario has no prior entry — keeps every `setRows` call fully-typed as
 * `Record<string, ScenarioRow>` (no optional/undefined fields), since
 * `prev[scenario.id]` is typed as possibly-undefined even though in practice
 * `buildInitialRows` always seeds every scenario before this is called.
 */
function mergeRow(
  prev: Record<string, ScenarioRow>,
  scenario: EvalScenario,
  patch: Partial<Omit<ScenarioRow, 'scenario'>>,
): ScenarioRow {
  const existing: ScenarioRow = prev[scenario.id] ?? {
    scenario,
    status: 'idle',
    draftOverall: null,
    activeOverall: null,
    error: null,
  }
  return { ...existing, scenario, ...patch }
}

export default function EvalDrawer({
  workspaceId,
  agentKey,
  draftPrompt,
  targetVersion,
}: EvalDrawerProps) {
  const { getToken } = useAuth()

  // The active version is the "vs" side of the scoreboard AND the source of
  // the active-side eval_scores tag (promptVersion: String(active.version)).
  const active = useQuery(api.promptVersions.getActive, {
    workspace_id: workspaceId,
    agentKey,
  })

  const recordScore = useMutation(api.evalScores.record)

  const [scenarios, setScenarios] = useState<EvalScenario[] | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [rows, setRows] = useState<Record<string, ScenarioRow>>({})
  const [running, setRunning] = useState(false)

  // Auto-select by agentKey (D-04). Fetch-only — never scores anything.
  // Deliberately depends on [agentKey] only (NOT `getToken`, whose identity
  // is not guaranteed stable across renders) so this effect fires exactly on
  // mount + when the agent being edited changes, never on every render and
  // never when `draftPrompt`/`targetVersion` change.
  useEffect(() => {
    let cancelled = false
    setScenarios(null)
    setFetchError(null)
    setRows({})

    async function load() {
      try {
        const token = await getToken()
        const list = await fetchScenarios(agentKey, token)
        if (cancelled) return
        setScenarios(list)
        setRows(buildInitialRows(list))
      } catch (e) {
        if (!cancelled) setFetchError(e instanceof Error ? e.message : String(e))
      }
    }

    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey])

  const scenarioList = scenarios ?? []
  const scenarioCount = scenarioList.length

  // The N-scenario batch (D-05). Sequential per scenario — partial failure on
  // one scenario must not stop the rest (each row carries its own status).
  async function handleRunEvals() {
    if (running || scenarioCount === 0) return
    setRunning(true)
    try {
      const token = await getToken()
      for (const scenario of scenarioList) {
        setRows(prev => ({
          ...prev,
          [scenario.id]: mergeRow(prev, scenario, { status: 'running', error: null }),
        }))

        try {
          // Draft side — the same runAgentTest -> scoreOutput pair
          // TestRunPanel's default Run already does for a single scenario.
          const draftRun: TestRunResult = await runAgentTest(
            agentKey,
            { draft_prompt: draftPrompt, variables: scenario.input },
            token,
          )
          const draftScore: ScoreResult = await scoreOutput(
            agentKey,
            draftRun.output,
            token,
          )

          await recordScore({
            workspace_id: workspaceId,
            scenarioId: scenario.id,
            agentKey,
            // Freshness-producer fix (Task 3 / plan-review Blocker 1): when a
            // targetVersion is supplied this draft run IS the evaluation of
            // that version's saved content — tag it so §38.3's gate finds it.
            promptVersion: targetVersion ? String(targetVersion.version) : 'draft',
            overall: draftScore.overall,
            axes: JSON.stringify(draftScore.axes),
            costUsd: draftScore.cost_usd,
            source: targetVersion ? 'commit' : 'drawer',
          })

          // Active side — only when an active version exists to compare
          // against; TestRunPanel's runActiveVersionTest scaled to N. Always
          // tagged 'drawer' — the active side is never the commit target.
          let activeOverall: number | null = null
          if (active) {
            const activeRun: TestRunResult = await runActiveVersionTest(
              agentKey,
              active.content,
              { variables: scenario.input },
              token,
            )
            const activeScore: ScoreResult = await scoreOutput(
              agentKey,
              activeRun.output,
              token,
            )
            activeOverall = activeScore.overall

            await recordScore({
              workspace_id: workspaceId,
              scenarioId: scenario.id,
              agentKey,
              promptVersion: String(active.version),
              overall: activeScore.overall,
              axes: JSON.stringify(activeScore.axes),
              costUsd: activeScore.cost_usd,
              source: 'drawer',
            })
          }

          setRows(prev => ({
            ...prev,
            [scenario.id]: mergeRow(prev, scenario, {
              status: 'done',
              draftOverall: draftScore.overall,
              activeOverall,
              error: null,
            }),
          }))
        } catch (e) {
          // Partial-failure per row: keep the other scenarios running.
          setRows(prev => ({
            ...prev,
            [scenario.id]: mergeRow(prev, scenario, {
              status: 'error',
              error: e instanceof Error ? e.message : String(e),
            }),
          }))
        }
      }
    } finally {
      setRunning(false)
    }
  }

  const doneRows = Object.values(rows).filter(r => r.status === 'done')
  const draftValues = doneRows
    .map(r => r.draftOverall)
    .filter((v): v is number => v != null)
  const activeValues = doneRows
    .map(r => r.activeOverall)
    .filter((v): v is number => v != null)
  const pairedDeltas = doneRows
    .filter(r => r.draftOverall != null && r.activeOverall != null)
    .map(r => (r.draftOverall as number) - (r.activeOverall as number))

  const avgDraft = average(draftValues)
  const avgActive = average(activeValues)
  const avgDelta = average(pairedDeltas)

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-neutral-900">Quality test scoreboard</h2>
        {targetVersion && (
          <span className="rounded bg-[color:var(--color-cobalt,#253ad4)]/10 px-1.5 py-0.5 text-[11px] font-medium text-[color:var(--color-cobalt,#253ad4)]">
            Scoring v{targetVersion.version} for activation
          </span>
        )}
      </div>

      {fetchError && (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          {fetchError}
        </div>
      )}

      {scenarios === null && !fetchError && (
        <p className="text-xs text-neutral-400">Loading scenarios…</p>
      )}

      {scenarios !== null && scenarioCount === 0 && (
        <p className="text-xs text-neutral-400">
          No standard test cases for <span className="font-mono">{agentKey}</span> yet.
        </p>
      )}

      {scenarioCount > 0 && (
        <>
          {/* Aggregate target-metric summary (D-05) — sits ABOVE the rows. */}
          <div
            data-testid="eval-aggregate"
            className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs"
          >
            <span className="font-semibold text-neutral-900">
              {scenarioCount} scenario{scenarioCount !== 1 ? 's' : ''}
            </span>
            {avgDraft != null && (
              <span data-testid="eval-aggregate-draft" className="ml-2 text-neutral-600">
                avg draft {avgDraft.toFixed(1)}
              </span>
            )}
            {avgActive != null && (
              <span data-testid="eval-aggregate-active" className="ml-2 text-neutral-600">
                avg active {avgActive.toFixed(1)}
              </span>
            )}
            {avgDelta != null && (
              <span
                data-testid="eval-aggregate-delta"
                className={`ml-2 font-medium ${deltaColorClass(avgDelta)}`}
              >
                {avgDelta >= 0 ? '▲ target up' : '▼ target down'} {formatSigned(avgDelta)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleRunEvals}
            disabled={running}
            className="min-h-[44px] rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            {running
              ? 'Testing changes…'
              : `Test changes (${scenarioCount} scenario${scenarioCount !== 1 ? 's' : ''} · ~${scenarioCount * 4} model calls)`}
          </button>

          <ul className="divide-y divide-neutral-100 rounded border border-neutral-200 bg-white">
            {scenarioList.map(scenario => {
              const row = rows[scenario.id]
              const delta =
                row?.draftOverall != null && row?.activeOverall != null
                  ? row.draftOverall - row.activeOverall
                  : null
              return (
                <li
                  key={scenario.id}
                  data-testid={`eval-row-${scenario.id}`}
                  className="px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-neutral-900">
                      {scenario.whatItCatches}
                    </span>
                    {row?.status === 'running' && (
                      <span className="text-neutral-400">running…</span>
                    )}
                  </div>
                  {row?.error && (
                    <p role="alert" className="mt-1 text-[11px] text-red-700">
                      {row.error}
                    </p>
                  )}
                  {row?.status === 'done' && (
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-neutral-600">
                      <span data-testid={`eval-row-draft-${scenario.id}`}>
                        draft {row.draftOverall!.toFixed(1)}
                      </span>
                      {row.activeOverall != null && (
                        <span data-testid={`eval-row-active-${scenario.id}`}>
                          active {row.activeOverall.toFixed(1)}
                        </span>
                      )}
                      {delta != null && (
                        <span
                          data-testid={`eval-row-delta-${scenario.id}`}
                          className={`font-medium ${deltaColorClass(delta)}`}
                        >
                          {formatSigned(delta)}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
