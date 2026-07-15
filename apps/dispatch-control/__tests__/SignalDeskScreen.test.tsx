/**
 * Phase 41 (WSP-01, Plan 41-04) — SignalDeskScreen issue-keying tests.
 *
 * Pitfall 2 guard (41-RESEARCH.md §Pattern 6): SignalDeskScreen was built in
 * Phase 37 keyed ONLY to `api.runs.latest` via `workspace_id`. This test
 * proves the additive `runId?` prop now lets it be scoped to a SPECIFIC
 * issue's run — and that omitting the prop preserves the exact legacy
 * `runs.latest` fallback the top-level `/signal-desk` route depends on.
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
    runs: { latest: 'runs:latest' },
    pipelineRuns: { byRunId: 'pipelineRuns:byRunId' },
    pitchLog: { byRunId: 'pitchLog:byRunId' },
    deliberationEvents: { byRunIdAndType: 'deliberationEvents:byRunIdAndType' },
  },
}))

import { SignalDeskScreen } from '../app/(dashboard)/signal-desk/_components/SignalDeskScreen'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// One distinct pitchLog candidate per run so a wrongly-resolved effective
// runId is immediately visible in the rendered output (not just a passed
// spy-call assertion).
const pitchRowsByRun: Record<string, Array<Record<string, unknown>>> = {
  'run-OLD': [
    {
      charityId: 'c-old',
      charityName: 'Old Run Charity',
      charityLocation: 'Ames, IA',
      scoutSummary: 'summary-old-run',
      selected: false,
    },
  ],
  'run-NEW': [
    {
      charityId: 'c-new',
      charityName: 'New Run Charity',
      charityLocation: 'Reno, NV',
      scoutSummary: 'summary-new-run',
      selected: false,
    },
  ],
}

function mockConvex({ latestRunId }: { latestRunId: string | null }) {
  ;(useQuery as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (query: unknown, args: unknown) => {
      if (args === 'skip') return undefined

      if (query === 'runs:latest') {
        return latestRunId ? { runId: latestRunId } : null
      }
      if (query === 'pipelineRuns:byRunId') {
        // Not paused at Gate 1 for either test — DecisionPanel renders.
        return { status: 'complete', completedAt: 123 }
      }
      if (query === 'pitchLog:byRunId') {
        const runId = (args as { runId?: string } | undefined)?.runId
        return runId ? (pitchRowsByRun[runId] ?? []) : []
      }
      if (query === 'deliberationEvents:byRunIdAndType') {
        // No advocate/editor-decision rows needed for this test's assertions.
        return []
      }
      return undefined
    },
  )
}

describe('SignalDeskScreen issue-keying (WSP-01, Pitfall 2 guard)', () => {
  it('uses a passed non-latest runId for its subscriptions, ignoring api.runs.latest entirely', () => {
    mockConvex({ latestRunId: 'run-NEW' })

    render(<SignalDeskScreen workspace_id="eisenbalm" runId="run-OLD" />)

    // The passed run's candidate renders...
    expect(screen.getByText('summary-old-run')).toBeDefined()
    // ...and the workspace's latest run's candidate must NOT appear.
    expect(screen.queryByText('summary-new-run')).toBeNull()

    // api.runs.latest must have been explicitly skipped, never queried with
    // real args, when a runId is passed.
    const calls = (useQuery as unknown as ReturnType<typeof vi.fn>).mock.calls
    const latestCalls = calls.filter(([query]) => query === 'runs:latest')
    expect(latestCalls.length).toBeGreaterThan(0)
    for (const [, args] of latestCalls) {
      expect(args).toBe('skip')
    }
  })

  it('falls back to api.runs.latest exactly as before when no runId prop is passed (legacy /signal-desk route)', () => {
    mockConvex({ latestRunId: 'run-NEW' })

    render(<SignalDeskScreen workspace_id="eisenbalm" />)

    // No runId prop -> legacy behavior -> the workspace's latest run's
    // candidate renders.
    expect(screen.getByText('summary-new-run')).toBeDefined()
    expect(screen.queryByText('summary-old-run')).toBeNull()

    // api.runs.latest must have been queried with real args (workspace_id),
    // never skipped, in the legacy path.
    const calls = (useQuery as unknown as ReturnType<typeof vi.fn>).mock.calls
    const latestCalls = calls.filter(([query]) => query === 'runs:latest')
    expect(latestCalls.length).toBeGreaterThan(0)
    for (const [, args] of latestCalls) {
      expect(args).toEqual({ workspace_id: 'eisenbalm' })
    }
  })

  it('shows the "No runs yet" empty state when no runId is passed and no run is latest', () => {
    mockConvex({ latestRunId: null })

    render(<SignalDeskScreen workspace_id="eisenbalm" />)

    expect(screen.getByText(/no runs yet/i)).toBeDefined()
  })
})
