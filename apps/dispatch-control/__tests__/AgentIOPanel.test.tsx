/**
 * Phase 37 (MON-02, Plan 37-03 Task 3) — AgentIOPanel handoff inspector tests.
 *
 * Covers the upstream→node→downstream handoff view:
 *   - Three labelled handoff regions (From / This node / To), resolved from
 *     the real PIPELINE_EDGES topology (not mocked — exercises the actual
 *     graph shape).
 *   - Human-readable summary renders by default; raw JSON <pre> only after
 *     the "Show technical details" toggle is activated.
 *   - The ~2000-char truncation note is present.
 *   - Degrades gracefully for a node with no upstream (calibrator) and a
 *     node with many downstream (verify_research fan-out) — renders what
 *     exists, never crashes.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { plainNameForKey } from '../lib/editorState'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { useQuery } from 'convex/react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    agentRuns: {
      payloadByRunIdAgentKey: 'agentRuns:payloadByRunIdAgentKey',
    },
  },
}))

import { AgentIOPanel } from '../app/admin/runs/graph/_components/AgentIOPanel'
import { SECTION_WRITER_KEYS } from '../app/admin/runs/graph/_components/pipelineTopology'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

type Payload = { inputSnapshot?: string; outputSnapshot?: string } | null | undefined

/** Default payload used for any agentKey not explicitly overridden. */
function defaultPayload(agentKey: string): Payload {
  return {
    inputSnapshot: JSON.stringify({ from: agentKey, note: 'input' }),
    outputSnapshot: JSON.stringify({ from: agentKey, note: 'output' }),
  }
}

function mockPayloads(overrides: Record<string, Payload> = {}) {
  ;(useQuery as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (query: unknown, args: unknown) => {
      if (query !== 'agentRuns:payloadByRunIdAgentKey') return undefined
      if (args === 'skip') return undefined
      const { agentKey } = args as { runId: string; agentKey: string }
      return agentKey in overrides ? overrides[agentKey] : defaultPayload(agentKey)
    },
  )
}

describe('AgentIOPanel handoff inspector (MON-02)', () => {
  it('renders the three labelled handoff regions for a mid-pipeline node', () => {
    // chronicler: upstream = editor_gate_1, downstream = researcher
    mockPayloads()
    render(
      <AgentIOPanel
        runId="run-1"
        agentKey="chronicler"
        agentRun={{ agentKey: 'chronicler', status: 'done' }}
        onClose={() => {}}
      />,
    )

    expect(screen.getByText(/What came in from before/i)).toBeDefined()
    expect(screen.getByText(/This step \(given → wrote\)/i)).toBeDefined()
    expect(screen.getByText(/What goes on to the next step/i)).toBeDefined()

    // Upstream/downstream keys resolved from the real PIPELINE_EDGES topology.
    expect(screen.getAllByText("Choose this week's charity", { exact: false }).length).toBeGreaterThan(0)
    expect(screen.getByText('Research the charity', { exact: false })).toBeDefined()
  })

  it('renders a human-readable summary by default and reveals raw JSON only after the toggle', () => {
    mockPayloads({
      chronicler: {
        inputSnapshot: JSON.stringify({ uniqueInputKey: 'abc' }),
        outputSnapshot: JSON.stringify({ uniqueOutputKey: 'def' }),
      },
    })
    render(
      <AgentIOPanel
        runId="run-1"
        agentKey="chronicler"
        agentRun={{ agentKey: 'chronicler', status: 'done' }}
        onClose={() => {}}
      />,
    )

    // Raw JSON (pretty-printed, multi-line) not present before toggle.
    expect(screen.queryByText(/"uniqueInputKey"/)).toBeNull()
    // Human-readable summary (key name) is present.
    expect(screen.getByText(/uniqueInputKey/)).toBeDefined()

    const toggle = screen.getByRole('button', { name: /show technical details/i })
    fireEvent.click(toggle)

    // Raw JSON now visible.
    expect(screen.getByText(/"uniqueInputKey"/)).toBeDefined()
    expect(screen.getByRole('button', { name: /hide technical details/i })).toBeDefined()
  })

  it('shows the ~2000-char truncation note', () => {
    mockPayloads()
    render(
      <AgentIOPanel
        runId="run-1"
        agentKey="chronicler"
        agentRun={{ agentKey: 'chronicler', status: 'done' }}
        onClose={() => {}}
      />,
    )

    expect(screen.getByText(/cut short/i)).toBeDefined()
  })

  it('degrades gracefully for a node with no upstream (calibrator)', () => {
    mockPayloads()
    expect(() =>
      render(
        <AgentIOPanel
          runId="run-1"
          agentKey="calibrator"
          agentRun={{ agentKey: 'calibrator', status: 'done' }}
          onClose={() => {}}
        />,
      ),
    ).not.toThrow()

    expect(screen.getByText(/Nothing comes before/i)).toBeDefined()
    // calibrator's one downstream is now signal_editor (Phase 50 D-08
    // topology reconciliation — calibrator -> signal_editor -> scout).
    expect(screen.getByText('Find story leads', { exact: false })).toBeDefined()
  })

  it('degrades gracefully for a node with many downstream (verify_research fan-out)', () => {
    mockPayloads()
    expect(() =>
      render(
        <AgentIOPanel
          runId="run-1"
          agentKey="verify_research"
          agentRun={{ agentKey: 'verify_research', status: 'done' }}
          onClose={() => {}}
        />,
      ),
    ).not.toThrow()

    // All 7 section-writer fan-out targets render under "To".
    for (const writerKey of SECTION_WRITER_KEYS) {
      expect(screen.getAllByText(plainNameForKey(writerKey), { exact: false }).length).toBeDefined()
    }
  })

  it('renders nothing handoff-related when no run is active', () => {
    mockPayloads()
    render(
      <AgentIOPanel
        runId={null}
        agentKey="chronicler"
        agentRun={undefined}
        onClose={() => {}}
      />,
    )

    expect(screen.queryByText(/What came in from before/i)).toBeNull()
    expect(screen.getByText(/Nothing is running/i)).toBeDefined()
  })
})
