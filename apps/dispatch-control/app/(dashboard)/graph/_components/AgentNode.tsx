'use client'
/**
 * Phase 23 — AgentNode custom React Flow node.
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
 */
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AgentNodeData = {
  agentKey: string
  displayName: string
  model?: string
  enabled: boolean
  description?: string
  // Live status fields (undefined when no run is active):
  status?: 'queued' | 'running' | 'done' | 'failed'
  costUsd?: number
  durationMs?: number
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

      {/* Node header row: spinner (if running) + agent name */}
      <div className="flex items-center gap-1.5">
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
      </div>

      {/* At rest: model label + truncated description */}
      {!nodeData.status && (
        <div className="mt-1 space-y-0.5">
          {nodeData.model && (
            <p className="text-[10px] text-neutral-400 truncate">{nodeData.model}</p>
          )}
          {nodeData.description && (
            <p className="text-[10px] text-neutral-500 truncate">{nodeData.description}</p>
          )}
        </div>
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
