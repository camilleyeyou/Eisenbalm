/**
 * Phase 23 — dagre-based auto-layout for the static pipeline DAG.
 *
 * computeLayout() is a pure function (no React hooks) that assigns x/y
 * positions to nodes using @dagrejs/dagre. The topology is static, so this
 * is called once when the canvas mounts.
 *
 * Layout parameters:
 *   rankdir: 'TB' — top-to-bottom (sequential spine reads naturally)
 *   nodesep: 60   — horizontal gap between nodes in the same rank
 *   ranksep: 80   — vertical gap between ranks
 *   node size: 176×72 — matches AgentNode CSS dimensions (w-44 = 176px)
 */
import dagre from '@dagrejs/dagre'
import type { Node, Edge } from '@xyflow/react'

const NODE_WIDTH = 176
const NODE_HEIGHT = 72

/**
 * Assign x/y positions to nodes using dagre's TB layout.
 * Returns a new array of nodes with position set; edges are returned unchanged.
 */
export function computeLayout(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 })

  // Register every node with its dimensions so dagre can compute ranks.
  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  // Register every edge.
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  // Run the layout algorithm.
  dagre.layout(g)

  // Map dagre-computed positions back onto React Flow nodes.
  // dagre returns the center (x, y); React Flow expects top-left origin.
  const layoutedNodes = nodes.map((node) => {
    const { x, y } = g.node(node.id)
    return {
      ...node,
      position: {
        x: x - NODE_WIDTH / 2,
        y: y - NODE_HEIGHT / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}
