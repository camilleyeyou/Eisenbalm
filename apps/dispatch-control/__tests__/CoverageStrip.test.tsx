/**
 * Phase 39 (MEM-01) Plan 39-05 Task 1 — CoverageStrip tests.
 *
 * Covers:
 *   - 3 mocked coverage-strip rows render as 3 columns.
 *   - Repetition is visible: BOTH "Housing" cause chips render side by side
 *     (no computed diversity score — D-04 keeps this purely visual).
 *   - A null geo/signal chip renders a dash/empty affordance ("—"), never the
 *     literal string "undefined", and never crashes.
 *   - A loading state renders before the fetch resolves; an empty ([])
 *     response renders a graceful "no charities" message.
 *
 * Mocks coverageStripClient's fetch function (vi.mock) and @clerk/nextjs's
 * useAuth (getToken), same as EvalCenter.test.tsx / DriftStrip.test.tsx.
 *
 * Runs in jsdom (environmentMatchGlobs '__tests__/*.test.tsx' -> jsdom).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@/lib/coverageStripClient', () => ({
  fetchCoverageStrip: vi.fn(),
}))

import { fetchCoverageStrip } from '@/lib/coverageStripClient'
import { CoverageStrip } from '../app/(dashboard)/registry/_components/CoverageStrip'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const THREE_COLUMNS = [
  {
    name: 'Acme',
    sanityCharityId: 'a',
    lastFeaturedAt: 3000,
    cause: 'Housing',
    geo: 'Detroit',
    signal: 'overlooked rural housing crisis in the upper peninsula',
  },
  {
    name: 'Beta',
    sanityCharityId: 'b',
    lastFeaturedAt: 2000,
    cause: 'Housing',
    geo: 'Ohio',
    signal: null,
  },
  {
    name: 'Gamma',
    sanityCharityId: 'c',
    lastFeaturedAt: 1000,
    cause: 'Water',
    geo: null,
    signal: null,
  },
]

describe('CoverageStrip (MEM-01)', () => {
  it('renders a loading state before the fetch resolves', () => {
    let resolveFetch: (value: typeof THREE_COLUMNS) => void = () => {}
    vi.mocked(fetchCoverageStrip).mockReturnValue(
      new Promise(resolve => {
        resolveFetch = resolve
      }),
    )

    render(<CoverageStrip />)

    expect(screen.getByText(/loading/i)).toBeDefined()
    resolveFetch(THREE_COLUMNS)
  })

  it('renders 3 columns with both "Housing" cause chips visible side by side (repetition is visible)', async () => {
    vi.mocked(fetchCoverageStrip).mockResolvedValue(THREE_COLUMNS)

    render(<CoverageStrip />)

    await waitFor(() => {
      expect(screen.getByTestId('coverage-column-0')).toBeDefined()
    })
    expect(screen.getByTestId('coverage-column-1')).toBeDefined()
    expect(screen.getByTestId('coverage-column-2')).toBeDefined()

    // Both Housing chips render — the human sees the repetition directly, no
    // computed diversity score.
    const housingChips = screen.getAllByText('Housing')
    expect(housingChips.length).toBe(2)
  })

  it('renders a dash/empty affordance for null geo/signal, never the string "undefined"', async () => {
    vi.mocked(fetchCoverageStrip).mockResolvedValue(THREE_COLUMNS)

    render(<CoverageStrip />)

    await waitFor(() => {
      expect(screen.getByTestId('coverage-column-2')).toBeDefined()
    })

    const gammaColumn = screen.getByTestId('coverage-column-2')
    expect(gammaColumn.textContent).not.toMatch(/undefined/i)
    // The empty geo/signal chips render an explicit empty-chip affordance.
    const emptyChips = screen.getAllByTestId('coverage-chip-empty')
    expect(emptyChips.length).toBeGreaterThan(0)
    expect(gammaColumn.textContent).toContain('—')
  })

  it('renders a graceful empty message for an empty ([]) response', async () => {
    vi.mocked(fetchCoverageStrip).mockResolvedValue([])

    render(<CoverageStrip />)

    await waitFor(() => {
      expect(screen.getByText(/no featured charities/i)).toBeDefined()
    })
  })
})
