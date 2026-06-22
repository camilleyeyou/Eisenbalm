'use client'
/**
 * Phase 24 (PRM-05) — single-agent test-run panel.
 *
 * Test-runs the CURRENT unsaved editor draft (D-03 — draft_prompt /
 * draft_user_template, NOT a saved version) against one of four input modes
 * (D-04) and shows the raw output + cost. It does NOT trigger a pipeline run;
 * it POSTs to POST /agents/{key}/test-run via testRunClient with a Clerk token.
 *
 * Four input modes:
 *   (1) Prior-real input — pick a prior run → sets prior_run_id.
 *   (2) Manual variable entry — a form generated from VARIABLE_REGISTRY[agentKey].
 *   (3) Canned fixture — "use sample": leaves variables empty + no prior_run_id,
 *       so the server fills from SAMPLE_FIXTURES.
 *   (4) Unsaved draft — implicit: the draft is ALWAYS sent.
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
  type TestRunResult,
  type TestRunBody,
} from '@/lib/testRunClient'

type InputMode = 'prior' | 'manual' | 'fixture'

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

  // Prior-real input: list runs for the workspace so the operator can pick one.
  const runs = useQuery(api.runs.listForWorkspace, {
    workspace_id: workspaceId,
  })

  const [mode, setMode] = useState<InputMode>('fixture')
  const [priorRunId, setPriorRunId] = useState<string>('')
  const [variables, setVariables] = useState<Record<string, string>>({})

  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<TestRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function setVar(name: string, value: string) {
    setVariables(prev => ({ ...prev, [name]: value }))
  }

  async function handleRun() {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const token = await getToken()
      const body: TestRunBody = {
        draft_prompt: draftPrompt,
        draft_user_template: draftUserTemplate,
        // Mode 2 sends collected variables; modes 1/3 leave them empty so the
        // server pulls from the prior run or SAMPLE_FIXTURES respectively.
        variables: mode === 'manual' ? variables : {},
        // Mode 1 sets prior_run_id; modes 2/3 leave it undefined.
        prior_run_id: mode === 'prior' && priorRunId ? priorRunId : undefined,
      }
      const res = await runAgentTest(agentKey, body, token)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const canRun =
    !running && (mode !== 'prior' || priorRunId.length > 0)

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900">Test run</h2>
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
            ['fixture', 'Canned fixture'],
            ['manual', 'Manual variables'],
            ['prior', 'Prior-real input'],
          ] as [InputMode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`rounded border px-2.5 py-1 min-h-[44px] ${
              mode === m
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

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

      {/* Mode 3: canned fixture — server fills SAMPLE_FIXTURES when empty. */}
      {mode === 'fixture' && (
        <p className="text-xs text-neutral-500">
          Uses the canned sample fixture for{' '}
          <span className="font-mono">{agentKey}</span> (no variables or prior
          run needed).
        </p>
      )}

      <button
        type="button"
        onClick={handleRun}
        disabled={!canRun}
        className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 min-h-[44px]"
      >
        {running ? 'Running…' : 'Run'}
      </button>

      {error && (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          {error}
        </div>
      )}

      {/* Output + cost (reuses the AgentIOPanel display style). */}
      {result && (
        <div className="space-y-3">
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Output
            </h3>
            <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded border border-neutral-200 bg-neutral-50 p-2 text-[11px] text-neutral-700">
              {result.output}
            </pre>
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Cost
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <dt className="text-neutral-500">Cost</dt>
              <dd className="text-neutral-800">
                ${result.cost_usd.toFixed(4)}
              </dd>
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
        </div>
      )}
    </div>
  )
}
