/**
 * Phase 23 — AgentNode unit tests (jsdom, @testing-library/react).
 *
 * Covers OBS-01 (config at rest) and OBS-03 (live status/cost/duration).
 * Mock @xyflow/react so Handle renders as a plain <div> without requiring
 * a ReactFlowProvider in the test environment.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock @xyflow/react — Handle and Position are used by AgentNode but require
// a ReactFlowProvider in the real library. In jsdom tests we replace them
// with lightweight no-op implementations.
vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position }: { type: string; position: string }) => (
    <div data-testid={`handle-${type}`} data-position={position} />
  ),
  Position: { Top: 'top', Bottom: 'bottom' },
}))

import { AgentNode, type AgentNodeData } from '../app/(dashboard)/run-monitor/graph/_components/AgentNode'

// Helper: build the NodeProps shape AgentNode expects
function makeProps(data: AgentNodeData) {
  return {
    id: 'test-node',
    data,
    type: 'agent',
    selected: false,
    isConnectable: true,
    zIndex: 0,
    xPos: 0,
    yPos: 0,
    dragging: false,
  } as Parameters<typeof AgentNode>[0]
}

describe('AgentNode', () => {
  it('renders model text at rest when enabled=true (OBS-01 config at rest)', () => {
    const props = makeProps({
      agentKey: 'scout',
      displayName: 'Scout',
      model: 'claude-3-haiku',
      enabled: true,
    })

    render(<AgentNode {...props} />)

    expect(screen.getByText('Scout')).toBeDefined()
    expect(screen.getByText('claude-3-haiku')).toBeDefined()
  })

  it('applies opacity-40 and shows suppressed badge when enabled=false', () => {
    const props = makeProps({
      agentKey: 'design',
      displayName: 'Design',
      model: 'claude-3-opus',
      enabled: false,
    })

    const { container } = render(<AgentNode {...props} />)

    // The outer wrapper must carry opacity-40
    const outer = container.firstElementChild as HTMLElement
    expect(outer.className).toContain('opacity-40')

    // Suppressed badge must be visible
    expect(screen.getByText('suppressed')).toBeDefined()
  })

  it("renders cost string '$0.0420' when status='done' and costUsd=0.042", () => {
    const props = makeProps({
      agentKey: 'calibrator',
      displayName: 'Calibrator',
      enabled: true,
      status: 'done',
      costUsd: 0.042,
      durationMs: 1200,
    })

    render(<AgentNode {...props} />)

    // Cost rendered as 4 decimal places: $0.0420
    expect(screen.getByText('$0.0420 · 1.2s')).toBeDefined()
  })

  it('shows a spinner element when status=running', () => {
    const props = makeProps({
      agentKey: 'researcher',
      displayName: 'Researcher',
      enabled: true,
      status: 'running',
    })

    const { container } = render(<AgentNode {...props} />)

    // Loader2 renders an SVG; animate-spin class marks it as the spinner
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).not.toBeNull()
  })
})
