/**
 * Phase 37 (MON-04, Plan 37-04 Task 3) — DriftStrip behavior tests.
 *
 * Covers:
 *   - Current run vs trailing-8 completed runs: an over/under % delta for
 *     BOTH cost and duration.
 *   - Fewer than 8 prior completed runs → compares against the n that exist
 *     and labels the n.
 *   - Gate-1-paused ('awaiting-review' with no completedAt) rows are
 *     excluded from the trailing set (Pitfall 4 disambiguator).
 *   - Reads cost via parseCostJson(pipelineRuns.byRunId(...).cost).total —
 *     not a raw numeric field on the dashboard `runs` row.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { useQuery } from 'convex/react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    runs: { listForWorkspace: 'runs:listForWorkspace' },
    pipelineRuns: { byRunId: 'pipelineRuns:byRunId' },
  },
}))

import { DriftStrip } from '../app/(dashboard)/run-monitor/graph/_components/DriftStrip'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

type PipelineRunRow = { cost?: string; durationMs?: number }

function makeCost(total: number): string {
  return JSON.stringify({ total, agents: {} })
}

function mockConvex({
  runs,
  pipelineRunsByRunId,
}: {
  runs: Array<Record<string, unknown>>
  pipelineRunsByRunId: Record<string, PipelineRunRow>
}) {
  ;(useQuery as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (query: unknown, args: unknown) => {
      if (query === 'runs:listForWorkspace') return runs
      if (query === 'pipelineRuns:byRunId') {
        const { runId } = args as { runId: string }
        return pipelineRunsByRunId[runId] ?? null
      }
      return undefined
    },
  )
}

describe('DriftStrip (MON-04)', () => {
  it('computes an over/under % delta for cost + duration vs the trailing 8', async () => {
    const trailingRunIds = Array.from({ length: 8 }, (_, i) => `trail-${i}`)
    const runs = [
      { runId: 'current', status: 'complete', completedAt: 900, startedAt: 900 },
      ...trailingRunIds.map((id, i) => ({
        runId: id,
        status: 'complete',
        completedAt: 800 - i,
        startedAt: 800 - i,
      })),
    ]
    const pipelineRunsByRunId: Record<string, PipelineRunRow> = {
      current: { cost: makeCost(2.0), durationMs: 200_000 },
    }
    for (const id of trailingRunIds) {
      pipelineRunsByRunId[id] = { cost: makeCost(1.0), durationMs: 100_000 }
    }

    mockConvex({ runs, pipelineRunsByRunId })

    render(<DriftStrip currentRunId="current" workspace_id="ws-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('drift-trailing-count').textContent).toBe('vs last 8')
    })

    // Current cost $2.00 vs trailing mean $1.00 -> +100% over.
    expect(screen.getByTestId('drift-cost-delta').textContent).toBe('100% over')
    // Current duration 200s vs trailing mean 100s -> +100% over.
    expect(screen.getByTestId('drift-duration-delta').textContent).toBe('100% over')
  })

  it('labels the n when fewer than 8 completed prior runs exist', async () => {
    const runs = [
      { runId: 'current', status: 'complete', completedAt: 900, startedAt: 900 },
      { runId: 'trail-1', status: 'complete', completedAt: 800, startedAt: 800 },
      { runId: 'trail-2', status: 'complete', completedAt: 700, startedAt: 700 },
      { runId: 'trail-3', status: 'complete', completedAt: 600, startedAt: 600 },
    ]
    mockConvex({
      runs,
      pipelineRunsByRunId: {
        current: { cost: makeCost(1.0), durationMs: 100_000 },
        'trail-1': { cost: makeCost(1.0), durationMs: 100_000 },
        'trail-2': { cost: makeCost(1.0), durationMs: 100_000 },
        'trail-3': { cost: makeCost(1.0), durationMs: 100_000 },
      },
    })

    render(<DriftStrip currentRunId="current" workspace_id="ws-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('drift-trailing-count').textContent).toBe('vs last 3')
    })
  })

  it('excludes the current run and a Gate-1-paused (no completedAt) run from the trailing set', async () => {
    const runs = [
      { runId: 'current', status: 'complete', completedAt: 900, startedAt: 900 },
      { runId: 'gate1-paused', status: 'awaiting-review', startedAt: 850 }, // no completedAt — excluded
      { runId: 'trail-1', status: 'complete', completedAt: 800, startedAt: 800 },
    ]
    mockConvex({
      runs,
      pipelineRunsByRunId: {
        current: { cost: makeCost(1.0), durationMs: 100_000 },
        'trail-1': { cost: makeCost(1.0), durationMs: 100_000 },
      },
    })

    render(<DriftStrip currentRunId="current" workspace_id="ws-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('drift-trailing-count').textContent).toBe('vs last 1')
    })
  })

  it('reads cost via parseCostJson(pipelineRuns.byRunId(...).cost).total, not a raw numeric field', async () => {
    const runs = [
      { runId: 'current', status: 'complete', completedAt: 900, startedAt: 900 },
      { runId: 'trail-1', status: 'complete', completedAt: 800, startedAt: 800 },
    ]
    mockConvex({
      runs,
      pipelineRunsByRunId: {
        current: { cost: makeCost(3.5), durationMs: 50_000 },
        'trail-1': { cost: makeCost(3.5), durationMs: 50_000 },
      },
    })

    render(<DriftStrip currentRunId="current" workspace_id="ws-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('drift-cost').textContent).toContain('$3.5000')
    })
    expect(screen.getByTestId('drift-cost-delta').textContent).toBe('on par')
  })
})
