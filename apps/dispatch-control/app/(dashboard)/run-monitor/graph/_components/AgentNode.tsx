'use client'
/**
 * Phase 23 — AgentNode custom React Flow node.
 * Phase 37 (MON-01) — forensic spine upgrade: dot vs marigold diamond,
 * unconditional model chip, retry chip.
 *
 * Renders in two modes:
 *
 * 1. At rest (no active run — status undefined):
 *    - White border, agent name + model + truncated description
 *    - If enabled=false: opacity-40 + "suppressed" badge (D-03 / Pitfall 4)
 *
 * 2. During a run (status set):
 *    - queued  → neutral/grey border + "queued" label
 *    - running → blue border + Loader2 spinner (animate-spin)
 *    - done    → green border + inline cost ($0.0042) and duration (1.2s)
 *    - failed  → red border + inline cost/duration if available
 *
 * OBS-01: at-rest config (model, enabled, description) from agents table.
 * OBS-03: live status/cost/duration from agent_runs table via PipelineGraph.
 * D-03: disabled agents rendered visually dimmed (opacity-40).
 *
 * Phase 37 additions (D-02, D-03):
 *  - `isGate`: the reconciled deterministic-check set (`verify_candidates`,
 *    `verify_research`, `publisher` — Phase 50 D-08) renders as a rotated
 *    marigold (`#f2b01e`) diamond; every other node renders as a plain dot
 *    ("agents = black dots" per design brief).
 *  - `retryCount`: renders a small badge when > 0 (0/undefined → no chip).
 *  - The model chip renders UNCONDITIONALLY (not only at-rest) so an
 *    executed node still shows model + cost/duration + retry TOGETHER —
 *    these must not be mutually exclusive (MON-01 plan-review fix).
 *
 * Phase 50 (WBN-02, D-07): `displayName` now carries the §7 ACTION label
 * (e.g. "Find story leads") sourced from `lib/nomenclature.ts`'s
 * `runStepFor()` — the agent is demoted to `agentLabel`, rendered as small
 * secondary metadata under the title (e.g. "— Signal Editor").
 */
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AgentNodeData = {
  agentKey: string
  displayName: string
  /** Secondary metadata — the agent/mechanism name (Phase 50 D-07). */
  agentLabel?: string
  model?: string
  enabled: boolean
  description?: string
  // Live status fields (undefined when no run is active):
  status?: 'queued' | 'running' | 'done' | 'failed'
  costUsd?: number
  durationMs?: number
  // Phase 37 (MON-01) additions:
  retryCount?: number
  isGate?: boolean
}

const STATUS_COLORS: Record<NonNullable<AgentNodeData['status']>, string> = {
  queued: 'border-neutral-300 bg-neutral-50',
  running: 'border-blue-400 bg-blue-50',
  done: 'border-green-400 bg-green-50',
  failed: 'border-red-400 bg-red-50',
}

export function AgentNode({ data, selected }: NodeProps) {
  const nodeData = data as AgentNodeData

  // Resolve border/background class:
  // - At rest + enabled: white border
  // - At rest + disabled: neutral + opacity-40 (applied via wrapper)
  // - During run: status-based color
  const borderClass = nodeData.status
    ? STATUS_COLORS[nodeData.status]
    : nodeData.enabled
      ? 'border-neutral-200 bg-white'
      : 'border-neutral-100 bg-neutral-50'

  const isDisabled = !nodeData.enabled
  const showCostDuration =
    nodeData.status && nodeData.status !== 'queued'

  return (
    <div
      className={cn(
        'rounded-lg border-2 p-3 w-44 cursor-pointer select-none',
        borderClass,
        isDisabled && !nodeData.status && 'opacity-40',
        selected && 'ring-2 ring-neutral-900 ring-offset-1',
      )}
    >
      {/* Source handle — hidden visually but required for React Flow edge routing */}
      <Handle type="target" position={Position.Top} />

      {/* Node header row: shape marker (dot/diamond) + spinner (if running) + agent name */}
      <div className="flex items-center gap-1.5">
        {/* Phase 37 (D-02), reconciled Phase 50 (D-08): dot for agents,
            marigold diamond for the deterministic-check set
            (verify_candidates, verify_research, publisher). Marigold =
            --color-marigold (#f2b01e, see app/globals.css @theme) — the 1c
            design system token (docs/design/dispatch-control-v2/README.md). */}
        <span
          data-testid={nodeData.isGate ? 'agent-node-diamond' : 'agent-node-dot'}
          aria-hidden="true"
          className={cn(
            'inline-block h-2 w-2 shrink-0',
            nodeData.isGate ? 'rotate-45 bg-marigold' : 'rounded-full bg-neutral-900',
          )}
        />
        {nodeData.status === 'running' && (
          <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />
        )}
        <span className="text-xs font-semibold text-neutral-800 truncate">
          {nodeData.displayName}
        </span>
        {/* Suppressed badge — only shown at rest when agent is disabled */}
        {isDisabled && !nodeData.status && (
          <span className="ml-auto shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide bg-neutral-200 text-neutral-500">
            suppressed
          </span>
        )}
        {/* Retry chip (Phase 37, D-03) — only rendered when retryCount > 0 */}
        {nodeData.retryCount != null && nodeData.retryCount > 0 && (
          <span
            data-testid="retry-chip"
            className="ml-auto shrink-0 rounded px-1 py-0.5 text-[9px] font-medium bg-amber-100 text-amber-700"
            title="Retry count"
          >
            ↻{nodeData.retryCount}
          </span>
        )}
      </div>

      {/* Agent secondary metadata (Phase 50, D-07) — the action label above
          is primary; the agent/mechanism name renders as its own small,
          dashed caption line so it never crowds the title on the narrow
          w-44 node. */}
      {nodeData.agentLabel && (
        <p className="mt-0.5 text-[10px] text-neutral-400 truncate">
          — {nodeData.agentLabel}
        </p>
      )}

      {/* Model chip — config-at-rest field (Research Pitfall 7), renders
          UNCONDITIONALLY so an executed node shows model alongside
          cost/duration/retry TOGETHER, not mutually exclusive (MON-01 fix). */}
      {nodeData.model && (
        <p className="mt-1 text-[10px] text-neutral-400 truncate">{nodeData.model}</p>
      )}

      {/* At rest only: truncated description (model chip now renders above) */}
      {!nodeData.status && nodeData.description && (
        <p className="mt-0.5 text-[10px] text-neutral-500 truncate">{nodeData.description}</p>
      )}

      {/* During run (not queued): inline cost + duration */}
      {showCostDuration && (
        <p className="mt-1 text-[10px] text-neutral-600">
          {nodeData.costUsd != null
            ? `$${nodeData.costUsd.toFixed(4)}`
            : '—'}
          {nodeData.durationMs != null
            ? ` · ${(nodeData.durationMs / 1000).toFixed(1)}s`
            : ''}
        </p>
      )}

      {/* Queued label */}
      {nodeData.status === 'queued' && (
        <p className="mt-1 text-[10px] text-neutral-400">queued</p>
      )}

      {/* Target handle */}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
