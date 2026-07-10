'use client'
/**
 * Phase 24 (PRM-05) + Phase 28 (PRC-08, PRC-09) — single-agent test-run panel.
 *
 * Test-runs the CURRENT unsaved editor draft (D-03 — draft_prompt /
 * draft_user_template, NOT a saved version) against one of four input modes
 * (D-04) and shows the raw output + cost. It does NOT trigger a pipeline run;
 * it POSTs to POST /agents/{key}/test-run via testRunClient with a Clerk token.
 *
 * Four input modes (labeled in the UI as "Rehearsal"):
 *   (1) Replay a real run (prior) — pick a prior run → sets prior_run_id.
 *   (2) Your own input (manual) — a form generated from VARIABLE_REGISTRY[agentKey].
 *   (3) Sample week (fixture) — "use sample": leaves variables empty + no
 *       prior_run_id, so the server fills from SAMPLE_FIXTURES.
 *   (4) Unsaved draft — implicit: the draft is ALWAYS sent.
 *
 * Phase 28 authoring loop (the standout guardrail):
 *   - PRC-09: every draft run is SCORED against the live voice rubric and shows a
 *     per-axis breakdown + overall headline + 1-2 line rationale. ADVISORY ONLY —
 *     the score never gates any action (D-05/D-06).
 *   - PRC-08 (D-07): a "compare against active" action runs the ACTIVE version's
 *     prompt ON DEMAND (the default Run stays 1×), scores it too, and renders both
 *     outputs + costs side-by-side with the score delta (D-08).
 *
 * Output display reuses the AgentIOPanel metrics/output style.
 */
import { useState } from 'react'
import { useQuery } from 'convex/react'
import { useAuth } from '@clerk/nextjs'
import { api } from '@convex/_generated/api'
import { VARIABLE_REGISTRY } from './VariableRegistry'
import {
  runAgentTest,
  runActiveVersionTest,
  type TestRunResult,
  type TestRunBody,
} from '@/lib/testRunClient'
import { scoreOutput, type ScoreResult } from '@/lib/scoreClient'

type InputMode = 'prior' | 'manual' | 'fixture'

/**
 * Per-mode descriptor shown beneath the Rehearsal mode radiogroup (Prompt Lab
 * Nomenclature Proposal, quick 260710-k8y). Copied verbatim from PROPOSAL.md.
 */
const MODE_DESCRIPTORS: Record<InputMode, string> = {
  fixture: 'Runs the draft on a stored example input. Quick smoke test.',
  manual:
    'You supply the values — paste a real dossier or candidate list and see what the draft does with it.',
  prior:
    'The exact input this agent received in a past run. Same input, new prompt — any difference is your edit. The gold standard.',
}

interface TestRunPanelProps {
  workspaceId: string
  agentKey: string
  /** The CURRENT unsaved system-prompt draft (D-03). */
  draftPrompt: string
  /** The CURRENT unsaved user-template draft, when the agent has one. */
  draftUserTemplate?: string
}

export default function TestRunPanel({
  workspaceId,
  agentKey,
  draftPrompt,
  draftUserTemplate,
}: TestRunPanelProps) {
  const { getToken } = useAuth()
  const allowedVariables = VARIABLE_REGISTRY[agentKey] ?? []

  // Replay a real run: list runs for the workspace so the operator can pick one.
  const runs = useQuery(api.runs.listForWorkspace, {
    workspace_id: workspaceId,
  })

  // Active version content for the compare side (PRC-08, D-07). null until loaded
  // or when no active version exists — the compare button is disabled in that case.
  const active = useQuery(api.promptVersions.getActive, {
    workspace_id: workspaceId,
    agentKey,
  })

  const [mode, setMode] = useState<InputMode>('fixture')
  const [priorRunId, setPriorRunId] = useState<string>('')
  const [variables, setVariables] = useState<Record<string, string>>({})

  const [running, setRunning] = useState(false)
  // Draft side
  const [result, setResult] = useState<TestRunResult | null>(null)
  const [draftScore, setDraftScore] = useState<ScoreResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Active side (only populated by "compare against active")
  const [comparing, setComparing] = useState(false)
  const [activeResult, setActiveResult] = useState<TestRunResult | null>(null)
  const [activeScore, setActiveScore] = useState<ScoreResult | null>(null)
  const [compareError, setCompareError] = useState<string | null>(null)

  function setVar(name: string, value: string) {
    setVariables(prev => ({ ...prev, [name]: value }))
  }

  /** The shared input shape for BOTH the draft run and the active-version run. */
  function buildInputBody(): Omit<TestRunBody, 'draft_prompt'> {
    return {
      draft_user_template: draftUserTemplate,
      // Mode 2 sends collected variables; modes 1/3 leave them empty so the
      // server pulls from the prior run or SAMPLE_FIXTURES respectively.
      variables: mode === 'manual' ? variables : {},
      // Mode 1 sets prior_run_id; modes 2/3 leave it undefined.
      prior_run_id: mode === 'prior' && priorRunId ? priorRunId : undefined,
    }
  }

  // Default Run (PRC-09): runs ONLY the draft (1× — does NOT auto-run active),
  // then scores the draft output. Score errors are non-fatal.
  async function handleRun() {
    setRunning(true)
    setError(null)
    setResult(null)
    setDraftScore(null)
    // Clear any stale compare side so the layout returns to single-column.
    setActiveResult(null)
    setActiveScore(null)
    setCompareError(null)
    try {
      const token = await getToken()
      const body: TestRunBody = {
        draft_prompt: draftPrompt,
        ...buildInputBody(),
      }
      const res = await runAgentTest(agentKey, body, token)
      setResult(res)
      // Score the draft output (advisory — failures must not hide the output).
      try {
        const score = await scoreOutput(agentKey, res.output, token)
        setDraftScore(score)
      } catch {
        setDraftScore(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  // Compare against active (PRC-08, D-07): runs the ACTIVE version's prompt ON
  // DEMAND (only this handler calls runActiveVersionTest), then scores it.
  async function handleCompare() {
    if (!active) return
    setComparing(true)
    setCompareError(null)
    setActiveResult(null)
    setActiveScore(null)
    try {
      const token = await getToken()
      const res = await runActiveVersionTest(
        agentKey,
        active.content,
        buildInputBody(),
        token,
      )
      setActiveResult(res)
      try {
        const score = await scoreOutput(agentKey, res.output, token)
        setActiveScore(score)
      } catch {
        setActiveScore(null)
      }
    } catch (e) {
      setCompareError(e instanceof Error ? e.message : String(e))
    } finally {
      setComparing(false)
    }
  }

  const canRun = !running && (mode !== 'prior' || priorRunId.length > 0)
  // Compare is available once a draft result exists and an active version is
  // loaded. NOTE: disabled state never references a SCORE (advisory-only, D-06).
  const canCompare =
    !running && !comparing && result != null && active != null

  // Score delta (D-08): draft.overall − active.overall, when BOTH sides scored.
  const scoreDelta =
    draftScore != null && activeScore != null
      ? draftScore.overall - activeScore.overall
      : null

  const sideBySide = activeResult != null

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900">Rehearsal</h2>
        <span className="text-xs text-neutral-400">
          Tests the unsaved draft — does not run the pipeline
        </span>
      </div>

      {/* Input-mode selector (four modes; (4) unsaved-draft is implicit). */}
      <div
        className="flex flex-wrap gap-2 text-xs"
        role="radiogroup"
        aria-label="Test-run input mode"
      >
        {(
          [
            ['fixture', 'Sample week'],
            ['manual', 'Your own input'],
            ['prior', 'Replay a real run'],
          ] as [InputMode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`rounded border px-2.5 py-1 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 ${
              mode === m
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-neutral-400">{MODE_DESCRIPTORS[mode]}</p>

      {/* Mode 1: prior-real run picker → prior_run_id */}
      {mode === 'prior' && (
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Prior run</label>
          <select
            className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
            value={priorRunId}
            onChange={e => setPriorRunId(e.target.value)}
            aria-label="Prior run"
          >
            <option value="">Select a run…</option>
            {(runs ?? []).map(r => (
              <option key={r._id} value={r.runId}>
                {r.runId} · {r.status}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-neutral-400">
            Loads this run&apos;s real inputs for {agentKey} (prior_run_id).
          </p>
        </div>
      )}

      {/* Mode 2: manual variable-entry form from VARIABLE_REGISTRY[agentKey] */}
      {mode === 'manual' && (
        <div className="space-y-2">
          {allowedVariables.length === 0 ? (
            <p className="text-xs text-neutral-400">
              This agent has no template variables — use a fixture or prior run.
            </p>
          ) : (
            allowedVariables.map(name => (
              <div key={name} className="space-y-0.5">
                <label className="font-mono text-[11px] text-neutral-600">
                  {`{${name}}`}
                </label>
                <input
                  type="text"
                  value={variables[name] ?? ''}
                  onChange={e => setVar(name, e.target.value)}
                  className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                  placeholder={`value for ${name}`}
                />
              </div>
            ))
          )}
        </div>
      )}

      {/* Mode 3: Sample week — server fills SAMPLE_FIXTURES when empty. */}
      {mode === 'fixture' && (
        <p className="text-xs text-neutral-500">
          Uses the stored sample input for{' '}
          <span className="font-mono">{agentKey}</span> (no variables or prior
          run needed).
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleRun}
          disabled={!canRun}
          className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
        >
          {running ? 'Running…' : 'Run'}
        </button>

        {/* PRC-08 / D-07: on-demand active-version run (1× default preserved). */}
        <button
          type="button"
          onClick={handleCompare}
          disabled={!canCompare}
          title={
            active == null
              ? 'No active version to compare against'
              : result == null
                ? 'Run the draft first, then compare'
                : 'Run the active version and compare side-by-side'
          }
          className="rounded border border-neutral-900 bg-white px-3 py-2 text-sm font-medium text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 min-h-[44px] hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
        >
          {comparing ? 'Comparing…' : 'Draft vs. live'}
        </button>
      </div>
      <p className="text-[11px] text-neutral-400">
        Runs both on the same input, side by side. Answers: did my edit help?
      </p>

      {error && (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          {error}
        </div>
      )}
      {compareError && (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          Compare failed: {compareError}
        </div>
      )}

      {/* Score delta headline (D-08) — only when BOTH sides scored. */}
      {scoreDelta != null && (
        <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs">
          <span className="font-semibold text-neutral-900">Voice score Δ </span>
          <span
            className={
              scoreDelta >= 0 ? 'text-emerald-700' : 'text-amber-700'
            }
          >
            {scoreDelta >= 0 ? '+' : ''}
            {scoreDelta.toFixed(1)} vs live
          </span>
          <span className="ml-1 text-neutral-400">
            (draft {draftScore!.overall.toFixed(1)} · live{' '}
            {activeScore!.overall.toFixed(1)})
          </span>
        </div>
      )}

      {/* Output + cost + score. Side-by-side (2-col) when the active side ran. */}
      {result && (
        <div
          className={
            sideBySide
              ? 'grid grid-cols-1 gap-4 md:grid-cols-2'
              : 'space-y-3'
          }
        >
          <ResultColumn
            label={sideBySide ? 'Draft' : undefined}
            result={result}
            score={draftScore}
            scored
          />
          {sideBySide && (
            <ResultColumn
              label="Live"
              result={activeResult}
              score={activeScore}
              scored
            />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * One output column: raw output + cost <dl> + (optional) voice-score block.
 * Reused for both the draft and active sides so the markup stays identical.
 */
function ResultColumn({
  label,
  result,
  score,
  scored,
}: {
  label?: string
  result: TestRunResult | null
  score: ScoreResult | null
  /** Whether scoring was attempted for this side (drives the "unavailable" note). */
  scored: boolean
}) {
  if (!result) return null
  return (
    <div className="space-y-3">
      {label && (
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-900">
          {label}
        </h3>
      )}

      <section>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Output
        </h4>
        <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded border border-neutral-200 bg-neutral-50 p-2 text-[11px] text-neutral-700">
          {result.output}
        </pre>
      </section>

      <section>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Cost
        </h4>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-neutral-500">Cost</dt>
          <dd className="text-neutral-800">${result.cost_usd.toFixed(4)}</dd>
          <dt className="text-neutral-500">Model</dt>
          <dd className="font-mono text-neutral-800">{result.model}</dd>
          <dt className="text-neutral-500">Tokens in</dt>
          <dd className="text-neutral-800">
            {result.tokens_in.toLocaleString()}
          </dd>
          <dt className="text-neutral-500">Tokens out</dt>
          <dd className="text-neutral-800">
            {result.tokens_out.toLocaleString()}
          </dd>
          <dt className="text-neutral-500">Duration</dt>
          <dd className="text-neutral-800">
            {(result.duration_ms / 1000).toFixed(1)}s
          </dd>
        </dl>
      </section>

      {/* Voice-rubric score (PRC-09). Advisory only — never gates (D-05/D-06). */}
      <section>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Voice score
        </h4>
        {score ? (
          <div className="space-y-2 rounded border border-neutral-200 p-2">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold text-neutral-900">
                {score.overall.toFixed(1)}
              </span>
              <span className="text-[11px] text-neutral-400">/ 10 overall</span>
            </div>
            <ul className="space-y-1">
              {score.axes.map(a => (
                <li
                  key={a.axis}
                  className="flex items-start gap-2 text-[11px] text-neutral-700"
                >
                  <span
                    aria-hidden
                    className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                      a.pass ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <span>
                    <span className="font-medium text-neutral-900">
                      {a.axis}
                    </span>{' '}
                    · {a.score.toFixed(1)}{' '}
                    <span className="text-neutral-400">
                      ({a.pass ? 'pass' : 'flag'})
                    </span>
                    {a.note ? (
                      <span className="text-neutral-500"> — {a.note}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-neutral-600">{score.rationale}</p>
            <p className="text-[10px] text-neutral-400">
              rubric: {score.rubric_source} · advisory — does not gate
            </p>
          </div>
        ) : (
          scored && (
            <p className="text-[11px] text-neutral-400">
              scoring unavailable — output still shown
            </p>
          )
        )}
      </section>
    </div>
  )
}
