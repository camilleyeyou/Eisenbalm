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

import { PIPELINE_NODES, PIPELINE_EDGES, GATE_KEYS } from './pipelineTopology'
import { computeLayout } from './useGraphLayout'
import { AgentNode, type AgentNodeData } from './AgentNode'
import { AgentIOPanel } from './AgentIOPanel'

// Register the custom AgentNode type with React Flow.
const nodeTypes = { agent: AgentNode }

// ── helpers ──────────────────────────────────────────────────────────────────

/** Convert agentKey → display name (Title Case with underscores → spaces). */
function toDisplayName(key: string): string {
  return key
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

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

      const data: AgentNodeData = {
        agentKey,
        displayName: toDisplayName(agentKey),
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
    <div className="relative h-full w-full">
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
