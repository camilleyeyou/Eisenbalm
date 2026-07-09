/**
 * Phase 37 (SIG-02, Plan 37-05 Task 2) — DecisionPanel behavior tests.
 *
 * Covers:
 *   - Winner + confidence meter (from the persisted `confidence` field,
 *     37-01) + editor reasoning rendered IN FULL from an `editor-decision`
 *     deliberationEvents row.
 *   - Graceful empty state when no editor-decision row exists yet.
 *   - `confidence == null` (older runs pre-37-01) hides the meter but still
 *     shows winner + rationale.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { useQuery } from 'convex/react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    deliberationEvents: { byRunIdAndType: 'deliberationEvents:byRunIdAndType' },
  },
}))

import { DecisionPanel } from '../app/(dashboard)/signal-desk/_components/DecisionPanel'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function mockRows(rows: Array<Record<string, unknown>> | undefined) {
  ;(useQuery as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => rows)
}

describe('DecisionPanel (SIG-02)', () => {
  it('renders the winner, a confidence meter reflecting 0.72, and the full rationale', () => {
    const longRationale =
      'The winning charity was chosen for its unusually rigorous financial transparency, ' +
      'a founder with a decade of unglamorous on-the-ground work, and a scout summary that ' +
      'held up under every follow-up question the Advocate raised — this reasoning must ' +
      'appear in full with no clipping whatsoever.'

    mockRows([
      {
        payload: JSON.stringify({
          winner: 'Acme Foundation',
          rationale: longRationale,
          confidence: 0.72,
          runnerUpNotes: 'Beacon Trust was a close second on local impact.',
        }),
      },
    ])

    render(<DecisionPanel runId="run-1" />)

    expect(screen.getByTestId('decision-winner').textContent).toBe('Acme Foundation')
    expect(screen.getByTestId('decision-confidence-label').textContent).toBe('72%')
    expect(screen.getByTestId('decision-confidence-meter').style.width).toBe('72%')
    expect(screen.getByTestId('decision-rationale').textContent).toBe(longRationale)
    expect(screen.getByTestId('decision-rationale').className).not.toMatch(/line-clamp|truncate/)
    expect(screen.getByTestId('decision-runner-up-notes').textContent).toBe(
      'Beacon Trust was a close second on local impact.',
    )
  })

  it('renders a graceful empty state when no editor-decision row exists yet', () => {
    mockRows([])

    render(<DecisionPanel runId="run-1" />)

    expect(screen.getByText(/no decision yet/i)).toBeDefined()
    expect(screen.queryByTestId('decision-winner')).toBeNull()
    expect(screen.queryByTestId('decision-confidence-meter')).toBeNull()
  })

  it('hides the confidence meter but still shows winner + rationale when confidence is null', () => {
    mockRows([
      {
        payload: JSON.stringify({
          winner: 'Acme Foundation',
          rationale: 'A strong, if unquantified, case.',
          confidence: null,
        }),
      },
    ])

    render(<DecisionPanel runId="run-1" />)

    expect(screen.getByTestId('decision-winner').textContent).toBe('Acme Foundation')
    expect(screen.getByTestId('decision-rationale').textContent).toBe(
      'A strong, if unquantified, case.',
    )
    expect(screen.queryByTestId('decision-confidence-meter')).toBeNull()
  })
})
