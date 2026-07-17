'use client'
/**
 * Phase 23 — AgentIOPanel: slide-over panel for per-agent I/O + error + cost.
 * Phase 37 (MON-02) — extended into the upstream→step→downstream handoff
 * inspector.
 *
 * OBS-05: Operator can inspect per-agent input/output and any error/retry.
 *
 * Queries agent_run_payloads on step click (NOT subscribed — keeps live
 * subscription lean, per RESEARCH Pattern 4 / Pitfall 2). Renders:
 *   - error message when status === 'failed'
 *   - costUsd / durationMs / tokensIn / tokensOut from the agentRun row
 *   - the handoff (MON-02): upstream step's output → this step's
 *     input/output → downstream step's input, resolved from PIPELINE_EDGES.
 *     Human-readable summary first; raw JSON (the existing prettyJson <pre>
 *     blocks) sits behind a "Show raw JSON" toggle. Snapshots are truncated
 *     ~2000 chars server-side (Phase 23 OBS-05) — the truncation is noted
 *     in the UI, not hidden.
 *
 * A step with no upstream (calibrator) or multiple upstream/downstream
 * (verify_research/validate_sections fan-out/fan-in) degrades gracefully:
 * renders whatever exists, never crashes.
 *
 * Read-only panel — no mutating actions.
 *
 * Phase 50 (WBN-02): operator-facing copy in this panel says "step", per the
 * binding nomenclature table's Old->new column. Component/identifier names
 * (`HandoffNode`, `agentKey`) are unchanged per D-01.
 */
import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { PIPELINE_EDGES } from './pipelineTopology'
import { summarize, prettyJson } from '@/lib/inspector/summarize'

interface AgentRun {
  agentKey: string
  status: string
  costUsd?: number
  durationMs?: number
  tokensIn?: number
  tokensOut?: number
  error?: string
}

interface AgentIOPanelProps {
  runId: string | null
  agentKey: string
  agentRun: AgentRun | undefined
  onClose: () => void
}

// ── HandoffNode ──────────────────────────────────────────────────────────────

/**
 * Fetches + renders one upstream/downstream step's payload snapshot as a
 * compact human-readable summary. Kept as its own component (one useQuery
 * call per instance) so the hook count stays stable regardless of how many
 * upstream/downstream edges the selected step has (MON-02 fan-out/fan-in).
 */
function HandoffNode({
  runId,
  agentKey,
  direction,
}: {
  runId: string
  agentKey: string
  direction: 'upstream' | 'downstream'
}) {
  const payload = useQuery(api.agentRuns.payloadByRunIdAgentKey, { runId, agentKey })

  if (payload === undefined) {
    return <p className="text-[10px] text-neutral-400">{agentKey}: loading…</p>
  }
  if (payload === null) {
    return <p className="text-[10px] text-neutral-400">{agentKey}: no snapshot stored</p>
  }

  // Upstream: we care about what it produced (its output).
  // Downstream: we care about what it receives (its input).
  const snapshot = direction === 'upstream' ? payload.outputSnapshot : payload.inputSnapshot

  return (
    <p className="text-[10px] text-neutral-600">
      <span className="font-medium text-neutral-700">{agentKey}</span>
      {': '}
      {summarize(snapshot ?? undefined)}
    </p>
  )
}

// ── AgentIOPanel ─────────────────────────────────────────────────────────────

export function AgentIOPanel({
  runId,
  agentKey,
  agentRun,
  onClose,
}: AgentIOPanelProps) {
  // Fetch this step's own I/O payload on demand (NOT subscribed — see
  // OBS-05 / Pattern 4).
  const payload = useQuery(
    api.agentRuns.payloadByRunIdAgentKey,
    runId && agentKey ? { runId, agentKey } : 'skip',
  )

  // Raw JSON is hidden by default — human-readable summary renders first
  // (MON-02).
  const [showRawJson, setShowRawJson] = useState(false)

  // Resolve upstream/downstream keys from the static topology. A step can
  // have zero (calibrator has no upstream; publisher has no downstream),
  // one, or many (verify_research fans out to 7; validate_sections fans in
  // from 7) — all degrade gracefully below.
  const upstreamKeys = PIPELINE_EDGES.filter(([, tgt]) => tgt === agentKey).map(([src]) => src)
  const downstreamKeys = PIPELINE_EDGES.filter(([src]) => src === agentKey).map(([, tgt]) => tgt)

  return (
    <div
      className="absolute right-0 top-0 h-full w-96 bg-white border-l border-neutral-200 shadow-lg overflow-y-auto z-10 flex flex-col"
      role="complementary"
      aria-label={`${agentKey} details`}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 sticky top-0 bg-white z-10">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{agentKey}</h2>
          {agentRun && (
            <p className="text-xs text-neutral-500 mt-0.5">
              {agentRun.status}
              {agentRun.costUsd != null && ` · $${agentRun.costUsd.toFixed(4)}`}
              {agentRun.durationMs != null &&
                ` · ${(agentRun.durationMs / 1000).toFixed(1)}s`}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* Error block — shown when status=failed */}
        {agentRun?.status === 'failed' && agentRun.error && (
          <section>
            <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">
              Error
            </h3>
            <pre className="text-xs bg-red-50 border border-red-200 rounded p-2 whitespace-pre-wrap break-words text-red-800">
              {agentRun.error}
            </pre>
          </section>
        )}

        {/* Cost + token metrics */}
        {agentRun && (
          <section>
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
              Metrics
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <dt className="text-neutral-500">Cost</dt>
              <dd className="text-neutral-800">
                {agentRun.costUsd != null
                  ? `$${agentRun.costUsd.toFixed(4)}`
                  : '—'}
              </dd>
              <dt className="text-neutral-500">Duration</dt>
              <dd className="text-neutral-800">
                {agentRun.durationMs != null
                  ? `${(agentRun.durationMs / 1000).toFixed(1)}s`
                  : '—'}
              </dd>
              <dt className="text-neutral-500">Tokens in</dt>
              <dd className="text-neutral-800">
                {agentRun.tokensIn?.toLocaleString() ?? '—'}
              </dd>
              <dt className="text-neutral-500">Tokens out</dt>
              <dd className="text-neutral-800">
                {agentRun.tokensOut?.toLocaleString() ?? '—'}
              </dd>
            </dl>
          </section>
        )}

        {/* No run active */}
        {!runId && (
          <p className="text-xs text-neutral-400">
            No run active. Start a run to see I/O snapshots.
          </p>
        )}

        {/* Handoff — upstream output → this step's input/output → downstream
            input (MON-02). Human-readable summary first; raw JSON behind
            the toggle below. */}
        {runId && (
          <section>
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
              Handoff
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">
                  From (upstream output)
                </p>
                {upstreamKeys.length > 0 ? (
                  <div className="space-y-1">
                    {upstreamKeys.map(key => (
                      <HandoffNode key={key} runId={runId} agentKey={key} direction="upstream" />
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-neutral-400">
                    No upstream step (start of pipeline)
                  </p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">
                  This step (input → output)
                </p>
                {payload === undefined ? (
                  <p className="text-[10px] text-neutral-400">Loading…</p>
                ) : payload === null ? (
                  <p className="text-[10px] text-neutral-400">
                    No I/O snapshot stored for this agent in this run.
                  </p>
                ) : (
                  <p className="text-[10px] text-neutral-600">
                    {summarize(payload.inputSnapshot ?? undefined)}
                    {' → '}
                    {summarize(payload.outputSnapshot ?? undefined)}
                  </p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">
                  To (downstream input)
                </p>
                {downstreamKeys.length > 0 ? (
                  <div className="space-y-1">
                    {downstreamKeys.map(key => (
                      <HandoffNode key={key} runId={runId} agentKey={key} direction="downstream" />
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-neutral-400">
                    No downstream step (end of pipeline)
                  </p>
                )}
              </div>
            </div>

            <p className="mt-3 text-[9px] italic text-neutral-400">
              Snapshots truncated to ~2000 characters.
            </p>

            <button
              type="button"
              onClick={() => setShowRawJson(v => !v)}
              className="mt-2 text-[10px] font-medium text-neutral-600 underline hover:text-neutral-900"
            >
              {showRawJson ? 'Hide raw JSON' : 'Show raw JSON'}
            </button>
          </section>
        )}

        {/* Raw JSON — this step's own input/output snapshots, behind the
            toggle above. */}
        {showRawJson && payload !== undefined && payload !== null && (
          <>
            <section>
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                Input Snapshot (raw)
              </h3>
              <pre className="text-[10px] bg-neutral-50 border border-neutral-200 rounded p-2 whitespace-pre-wrap break-words text-neutral-700 max-h-64 overflow-y-auto">
                {prettyJson(payload.inputSnapshot ?? undefined)}
              </pre>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                Output Snapshot (raw)
              </h3>
              <pre className="text-[10px] bg-neutral-50 border border-neutral-200 rounded p-2 whitespace-pre-wrap break-words text-neutral-700 max-h-64 overflow-y-auto">
                {prettyJson(payload.outputSnapshot ?? undefined)}
              </pre>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
