/**
 * Phase 38 (EVL-04) Plan 38-06 — Eval Center tests.
 *
 * Task 1 (D-08/D-10): the Eval Center page renders one ScenarioCard per
 * golden scenario (description + whatItCatches + "last result" = the
 * highest-ranAt eval_scores row for that scenarioId), plus a DriftScoreboard
 * that renders the FULL append-only time-series per scenario (not a single
 * latest number), and gracefully shows "never evaluated" for a scenario with
 * zero eval_scores rows.
 *
 * Runs in jsdom (environmentMatchGlobs '__tests__/*.test.tsx' -> jsdom).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within, cleanup } from '@testing-library/react'

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    evalScores: {
      listForScenario: 'evalScores:listForScenario',
      listForAgent: 'evalScores:listForAgent',
    },
  },
}))

vi.mock('@/lib/evalScenarioClient', () => ({
  fetchScenarios: vi.fn(),
}))

vi.mock('@/lib/shadowRunClient', () => ({
  runShadow: vi.fn(),
}))

import { useQuery } from 'convex/react'
import { fetchScenarios } from '@/lib/evalScenarioClient'
import EvalCenterPage from '../app/(dashboard)/eval-center/page'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    id: 'scout_normal_week',
    agentKey: 'scout',
    description: 'A routine week with no red flags.',
    whatItCatches: 'catches normal-week complacency',
    input: { featured_keys: '[]' },
    scoringTarget: { min_overall: 7 },
  },
  {
    id: 'scout_dry_well',
    agentKey: 'scout',
    description: 'No viable candidates surface.',
    whatItCatches: 'catches dry-well overreach',
    input: { featured_keys: '["a","b"]' },
    scoringTarget: { min_overall: 6.5 },
  },
]

// scout_normal_week has 2 historical rows (a time-series); scout_dry_well has none.
const SCORES: Record<string, unknown[]> = {
  scout_normal_week: [
    {
      scenarioId: 'scout_normal_week',
      agentKey: 'scout',
      promptVersion: '1',
      overall: 6.0,
      axes: '[]',
      costUsd: 0.01,
      ranAt: 1000,
      source: 'drawer',
    },
    {
      scenarioId: 'scout_normal_week',
      agentKey: 'scout',
      promptVersion: '2',
      overall: 8.5,
      axes: '[]',
      costUsd: 0.01,
      ranAt: 2000,
      source: 'commit',
    },
  ],
  scout_dry_well: [],
}

function mockConvex() {
  vi.mocked(useQuery).mockImplementation((ref: unknown, args: unknown) => {
    if (ref === 'evalScores:listForScenario') {
      const { scenarioId } = args as { scenarioId: string }
      return SCORES[scenarioId] ?? []
    }
    return undefined
  })
}

beforeEach(() => {
  vi.mocked(fetchScenarios).mockReset()
  vi.mocked(fetchScenarios).mockResolvedValue(SCENARIOS)
  mockConvex()
})

afterEach(() => {
  cleanup()
})

async function renderPage() {
  render(<EvalCenterPage />)
  await waitFor(() => {
    expect(screen.getByTestId('scenario-card-scout_normal_week')).toBeDefined()
  })
}

describe('Eval Center — scenario cards + drift scoreboard (Plan 38-06 Task 1)', () => {
  it('Test 1: renders one ScenarioCard per scenario with description + whatItCatches + latest (highest-ranAt) overall as "last result"', async () => {
    await renderPage()

    expect(screen.getByTestId('scenario-card-scout_dry_well')).toBeDefined()
    expect(fetchScenarios).toHaveBeenCalledWith(undefined, 'tok-clerk')

    const card = within(screen.getByTestId('scenario-card-scout_normal_week'))
    expect(card.getByText(/routine week with no red flags/i)).toBeDefined()
    expect(card.getByText(/catches normal-week complacency/i)).toBeDefined()

    // Highest ranAt row is the v2 row (overall 8.5, ranAt 2000) — NOT the
    // older v1 row (overall 6.0, ranAt 1000), proving max-by-ranAt selection.
    const lastResult = card.getByTestId('scenario-last-result-scout_normal_week')
    expect(lastResult.textContent).toMatch(/8\.5/)
    expect(lastResult.textContent).not.toMatch(/6\.0/)
  })

  it('Test 3: a scenario with no eval_scores rows shows a graceful "never evaluated" state (no crash)', async () => {
    await renderPage()

    const dryWellCard = within(screen.getByTestId('scenario-card-scout_dry_well'))
    expect(dryWellCard.getByTestId('scenario-never-evaluated-scout_dry_well')).toBeDefined()
    expect(dryWellCard.queryByTestId('scenario-last-result-scout_dry_well')).toBeNull()
  })

  it('Test 2: DriftScoreboard renders MORE than the latest row for a scenario with multiple eval_scores rows (time-series, not a single number)', async () => {
    await renderPage()

    const series = within(screen.getByTestId('drift-series-scout_normal_week'))
    // Both historical points must render, not just the latest.
    expect(series.getByTestId('drift-point-scout_normal_week-0')).toBeDefined()
    expect(series.getByTestId('drift-point-scout_normal_week-1')).toBeDefined()
    expect(series.getByText(/6\.0/)).toBeDefined()
    expect(series.getByText(/8\.5/)).toBeDefined()

    // The empty scenario's drift series shows "never evaluated" too, no crash.
    const dryWellSeries = within(screen.getByTestId('drift-series-scout_dry_well'))
    expect(dryWellSeries.getByTestId('drift-never-evaluated-scout_dry_well')).toBeDefined()
  })
})
