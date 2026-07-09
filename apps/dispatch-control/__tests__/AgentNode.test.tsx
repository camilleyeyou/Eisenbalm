/**
 * Phase 23 — AgentNode unit tests (jsdom, @testing-library/react).
 *
 * Covers OBS-01 (config at rest) and OBS-03 (live status/cost/duration).
 * Mock @xyflow/react so Handle renders as a plain <div> without requiring
 * a ReactFlowProvider in the test environment.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

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

afterEach(() => {
  cleanup()
})

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

  // ── Phase 37 (MON-01): dot vs marigold diamond ─────────────────────────────

  it('renders the diamond variant with the marigold token when isGate=true', () => {
    const props = makeProps({
      agentKey: 'verify_research',
      displayName: 'Verify Research',
      enabled: true,
      isGate: true,
    })

    render(<AgentNode {...props} />)

    const shape = screen.getByTestId('agent-node-diamond')
    expect(shape).not.toBeNull()
    expect(shape.className).toContain('marigold')
    expect(screen.queryByTestId('agent-node-dot')).toBeNull()
  })

  it('renders the dot variant (no diamond) when isGate is false or undefined', () => {
    const props = makeProps({
      agentKey: 'scout',
      displayName: 'Scout',
      enabled: true,
    })

    render(<AgentNode {...props} />)

    expect(screen.getByTestId('agent-node-dot')).not.toBeNull()
    expect(screen.queryByTestId('agent-node-diamond')).toBeNull()
  })

  // ── Phase 37 (MON-01): retry chip ───────────────────────────────────────────

  it('renders the retry chip with the count when retryCount > 0', () => {
    const props = makeProps({
      agentKey: 'origin_story',
      displayName: 'Origin Story',
      enabled: true,
      status: 'done',
      retryCount: 2,
    })

    render(<AgentNode {...props} />)

    expect(screen.getByTestId('retry-chip').textContent).toContain('2')
  })

  it('renders no retry chip when retryCount is 0 or undefined', () => {
    const zeroProps = makeProps({
      agentKey: 'origin_story',
      displayName: 'Origin Story',
      enabled: true,
      status: 'done',
      retryCount: 0,
    })
    const { rerender } = render(<AgentNode {...zeroProps} />)
    expect(screen.queryByTestId('retry-chip')).toBeNull()

    const undefinedProps = makeProps({
      agentKey: 'origin_story',
      displayName: 'Origin Story',
      enabled: true,
      status: 'done',
    })
    rerender(<AgentNode {...undefinedProps} />)
    expect(screen.queryByTestId('retry-chip')).toBeNull()
  })

  // ── Phase 37 (MON-01 plan-review fix): all chips render TOGETHER ────────────

  it('renders model chip + cost/duration + retry chip SIMULTANEOUSLY on an executed node (not mutually exclusive)', () => {
    const props = makeProps({
      agentKey: 'qa',
      displayName: 'QA',
      enabled: true,
      model: 'anthropic/claude-x',
      status: 'done',
      costUsd: 0.12,
      durationMs: 3400,
      retryCount: 2,
    })

    render(<AgentNode {...props} />)

    // Model chip present
    expect(screen.getByText('anthropic/claude-x')).toBeDefined()
    // Cost + duration line present
    expect(screen.getByText('$0.1200 · 3.4s')).toBeDefined()
    // Retry chip present
    expect(screen.getByTestId('retry-chip').textContent).toContain('2')
  })
})
