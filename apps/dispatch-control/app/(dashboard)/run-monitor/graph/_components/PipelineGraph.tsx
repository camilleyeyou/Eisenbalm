'use client'
/**
 * Phase 23 — PipelineGraph: React Flow canvas with live Convex subscription.
 *
 * Wires together:
 *   - agents.listForWorkspace  → config at rest (model, enabled, description)
 *   - runs.latest              → most recent run to identify runId
 *   - agentRuns.byRunId        → live per-agent status/cost/duration (subscribed)
 *   - PIPELINE_NODES/EDGES     → static topology from pipelineTopology.ts
 *   - computeLayout            → dagre TB layout positions
 *   - AgentNode                → custom React Flow node
 *   - AgentIOPanel             → slide-over on node click (OBS-05)
 *
 * Pitfall 3 note: ReactFlow MUST be inside <ReactFlowProvider> in a Client
 * Component. This is the Client Component; graph/page.tsx is the Server
 * Component that resolves workspace_id and renders this.
 *
 * At rest (latest run = null): all nodes show config-at-rest with no status.
 * During a run: nodes repaint live as agent_runs rows change status.
 *
 * Phase 50 (WBN-02, D-07): node labels now come from `runStepFor()`
 * (`lib/nomenclature.ts`) — the §7 ACTION label is primary (`displayName`),
 * the agent/mechanism name is secondary (`agentLabel`). `isGate` still comes
 * from `GATE_KEYS` (reconciled in 50-00 to {verify_candidates,
 * verify_research, publisher}) — no visual change to diamond-vs-dot render.
 */
import { useCallback, useMemo, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'

import { PIPELINE_NODES, PIPELINE_EDGES, GATE_KEYS, SECTION_WRITER_KEYS } from './pipelineTopology'
import { computeLayout } from './useGraphLayout'
import { AgentNode, type AgentNodeData } from './AgentNode'
import { AgentIOPanel } from './AgentIOPanel'
import { DriftStrip } from './DriftStrip'
import { WriterExpansion } from './WriterExpansion'
import { runStepFor } from '@/lib/nomenclature'

// Register the custom AgentNode type with React Flow.
const nodeTypes = { agent: AgentNode }

// ── PipelineGraphInner (needs ReactFlowProvider in parent) ───────────────────

interface PipelineGraphInnerProps {
  workspace_id: string
}

function PipelineGraphInner({ workspace_id }: PipelineGraphInnerProps) {
  // ── Convex subscriptions ──────────────────────────────────────────────────

  // Agent config at rest (model, enabled, description).
  const agents = useQuery(api.agents.listForWorkspace, { workspace_id })

  // Most recent run for this workspace.
  const latestRun = useQuery(api.runs.latest, { workspace_id })
  const runId = latestRun?.runId

  // Live per-agent status subscription (skipped when no run is active).
  const agentRuns = useQuery(
    api.agentRuns.byRunId,
    runId ? { runId } : 'skip',
  )

  // ── Selected node state for I/O panel ────────────────────────────────────
  const [selectedAgentKey, setSelectedAgentKey] = useState<string | null>(null)

  // ── Build React Flow nodes ────────────────────────────────────────────────

  const { nodes, edges } = useMemo(() => {
    // Build a lookup map from agentKey → agents row for O(1) merge.
    const agentMap = new Map(
      (agents ?? []).map(a => [a.agentKey, a]),
    )

    // Build a lookup map from agentKey → agent_runs row for live status.
    const runMap = new Map(
      (agentRuns ?? []).map(r => [r.agentKey, r]),
    )

    // Build React Flow nodes from the static topology.
    const rfNodes: Node[] = PIPELINE_NODES.map(agentKey => {
      const config = agentMap.get(agentKey)
      const run = runMap.get(agentKey)
      const step = runStepFor(agentKey)

      const data: AgentNodeData = {
        agentKey,
        displayName: step.actionLabel,
        agentLabel: step.agentLabel,
        model: config?.model ?? undefined,
        enabled: config?.enabled ?? true,
        description: config?.description ?? undefined,
        // Live status fields (undefined when no run active):
        status: run?.status as AgentNodeData['status'] | undefined,
        costUsd: run?.costUsd ?? undefined,
        durationMs: run?.durationMs ?? undefined,
        // Phase 37 (MON-01): retryCount now lives on the agent_runs row
        // (37-01); isGate drives the dot vs marigold-diamond shape marker.
        retryCount: run?.retryCount ?? undefined,
        isGate: GATE_KEYS.has(agentKey),
      }

      return {
        id: agentKey,
        type: 'agent',
        position: { x: 0, y: 0 }, // will be overwritten by computeLayout
        data,
        selected: agentKey === selectedAgentKey,
      }
    })

    // Build React Flow edges from the static topology.
    const rfEdges: Edge[] = PIPELINE_EDGES.map(([source, target]) => ({
      id: `${source}->${target}`,
      source,
      target,
      type: 'smoothstep',
    }))

    // Apply dagre layout to assign x/y positions.
    return computeLayout(rfNodes, rfEdges)
  }, [agents, agentRuns, selectedAgentKey])

  // ── Node click handler ───────────────────────────────────────────────────

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedAgentKey(prev => (prev === node.id ? null : node.id))
  }, [])

  // ── Resolve selected agent run for the I/O panel ─────────────────────────

  const selectedAgentRun = useMemo(
    () =>
      selectedAgentKey
        ? (agentRuns ?? []).find(r => r.agentKey === selectedAgentKey)
        : undefined,
    [agentRuns, selectedAgentKey],
  )

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full flex-col">
      {/* Run-summary area (MON-04): current run vs the trailing 8 completed
          runs, cost + duration. Only meaningful once at least one run exists. */}
      {runId && <DriftStrip currentRunId={runId} workspace_id={workspace_id} />}

      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          nodesConnectable={false}
          nodesDraggable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>

        {/* I/O slide-over panel — shown when a node is selected */}
        {selectedAgentKey && (
          <AgentIOPanel
            runId={runId ?? null}
            agentKey={selectedAgentKey}
            agentRun={selectedAgentRun}
            onClose={() => setSelectedAgentKey(null)}
          />
        )}

        {/* 7-writers strength expansion (MON-03) — shown when the selected
            node is one of the section-writer fan-out nodes. Docked
            bottom-left so it doesn't collide with the right-hand
            AgentIOPanel slide-over (MON-02). */}
        {selectedAgentKey && runId && SECTION_WRITER_KEYS.includes(selectedAgentKey) && (
          <div className="absolute bottom-4 left-4 right-104 z-10 max-h-72 overflow-y-auto">
            <WriterExpansion runId={runId} runStatus={latestRun?.status} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── PipelineGraph (exported — wrapped in ReactFlowProvider per Pitfall 3) ────

export interface PipelineGraphProps {
  workspace_id: string
}

export function PipelineGraph({ workspace_id }: PipelineGraphProps) {
  return (
    <ReactFlowProvider>
      <PipelineGraphInner workspace_id={workspace_id} />
    </ReactFlowProvider>
  )
}
