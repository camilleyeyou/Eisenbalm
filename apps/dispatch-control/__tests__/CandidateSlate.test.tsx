/**
 * Phase 37 (SIG-01, Plan 37-05 Task 1) — CandidateSlate behavior tests.
 *
 * Covers:
 *   - Client-side join: pitchLog.byRunId (scout data) + deliberationEvents
 *     byRunIdAndType('advocate-argument') (advocate data), joined on
 *     charityId — renders one card per candidate with scoutSummary,
 *     advocateScore, and primaryConcern.
 *   - primaryConcern renders in FULL — no line-clamp/truncate class, full
 *     text present (anti-truncation rule).
 *   - The advocateArgument is collapsed by default and expands on click.
 *   - The winning/selected candidate is marked.
 *   - A candidate with no matching advocate row still renders gracefully.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { useQuery } from 'convex/react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    pitchLog: { byRunId: 'pitchLog:byRunId' },
    deliberationEvents: { byRunIdAndType: 'deliberationEvents:byRunIdAndType' },
  },
}))

import { CandidateSlate } from '../app/(dashboard)/signal-desk/_components/CandidateSlate'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function advocatePayload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    charityName: 'Acme Foundation',
    score: 8,
    argument: 'A compelling, overlooked cause with real local traction.',
    keyStrengths: ['Local roots', 'Transparent books'],
    primaryConcern: 'Small volunteer base may struggle to scale outreach.',
    ...overrides,
  })
}

function mockConvex({
  pitchRows,
  advocateRows,
}: {
  pitchRows: Array<Record<string, unknown>>
  advocateRows: Array<Record<string, unknown>>
}) {
  ;(useQuery as unknown as ReturnType<typeof vi.fn>).mockImplementation((query: unknown) => {
    if (query === 'pitchLog:byRunId') return pitchRows
    if (query === 'deliberationEvents:byRunIdAndType') return advocateRows
    return undefined
  })
}

describe('CandidateSlate (SIG-01)', () => {
  it('joins pitchLog + advocate-argument on charityId and renders scoutSummary, advocateScore, primaryConcern', () => {
    mockConvex({
      pitchRows: [
        {
          charityId: 'c1',
          charityName: 'Acme Foundation',
          charityLocation: 'Duluth, MN',
          scoutSummary: 'A quiet food-security nonprofit with a decade of unglamorous work.',
          selected: false,
        },
      ],
      advocateRows: [{ charityId: 'c1', payload: advocatePayload() }],
    })

    render(<CandidateSlate runId="run-1" />)

    expect(
      screen.getByText('A quiet food-security nonprofit with a decade of unglamorous work.'),
    ).toBeDefined()
    expect(screen.getByTestId('advocate-score-Acme Foundation').textContent).toContain('8/10')
    expect(screen.getByTestId('primary-concern-Acme Foundation').textContent).toBe(
      'Small volunteer base may struggle to scale outreach.',
    )
  })

  it('renders primaryConcern in FULL with no line-clamp/truncate class', () => {
    const longConcern =
      'This is a deliberately long primary concern paragraph meant to simulate a real ' +
      'advocate write-up that would normally tempt a UI into truncating it with an ' +
      'ellipsis or a line-clamp utility class, but the anti-truncation rule requires ' +
      'the full text to always render without any clipping whatsoever, in full.'

    mockConvex({
      pitchRows: [
        {
          charityId: 'c1',
          charityName: 'Acme Foundation',
          charityLocation: 'Duluth, MN',
          scoutSummary: 'summary',
          selected: false,
        },
      ],
      advocateRows: [{ charityId: 'c1', payload: advocatePayload({ primaryConcern: longConcern }) }],
    })

    render(<CandidateSlate runId="run-1" />)

    const concernEl = screen.getByTestId('primary-concern-Acme Foundation')
    expect(concernEl.textContent).toBe(longConcern)
    expect(concernEl.className).not.toMatch(/line-clamp|truncate/)
  })

  it('collapses the advocateArgument by default and expands it on click', () => {
    mockConvex({
      pitchRows: [
        {
          charityId: 'c1',
          charityName: 'Acme Foundation',
          charityLocation: 'Duluth, MN',
          scoutSummary: 'summary',
          selected: false,
        },
      ],
      advocateRows: [{ charityId: 'c1', payload: advocatePayload() }],
    })

    render(<CandidateSlate runId="run-1" />)

    expect(screen.queryByTestId('advocate-argument-Acme Foundation')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /show argument/i }))

    expect(screen.getByTestId('advocate-argument-Acme Foundation').textContent).toBe(
      'A compelling, overlooked cause with real local traction.',
    )
  })

  it('marks the selected candidate', () => {
    mockConvex({
      pitchRows: [
        {
          charityId: 'c1',
          charityName: 'Acme Foundation',
          charityLocation: 'Duluth, MN',
          scoutSummary: 'summary',
          selected: true,
        },
        {
          charityId: 'c2',
          charityName: 'Beacon Trust',
          charityLocation: 'Reno, NV',
          scoutSummary: 'summary 2',
          selected: false,
        },
      ],
      advocateRows: [],
    })

    render(<CandidateSlate runId="run-1" />)

    expect(screen.getByTestId('selected-badge-Acme Foundation')).toBeDefined()
    expect(screen.queryByTestId('selected-badge-Beacon Trust')).toBeNull()
  })

  it('still renders a candidate with no matching advocate row (graceful degrade)', () => {
    mockConvex({
      pitchRows: [
        {
          charityId: 'c3',
          charityName: 'No Match Charity',
          charityLocation: 'Ames, IA',
          scoutSummary: 'An overlooked literacy program.',
          selected: false,
        },
      ],
      advocateRows: [{ charityId: 'c-other', payload: advocatePayload({ charityName: 'Someone Else' }) }],
    })

    render(<CandidateSlate runId="run-1" />)

    expect(screen.getByText('An overlooked literacy program.')).toBeDefined()
    expect(screen.queryByTestId('advocate-score-No Match Charity')).toBeNull()
    // primaryConcern degrades to an empty-state dash, never a crash.
    expect(screen.getByTestId('primary-concern-No Match Charity').textContent).toBe('—')
  })
})
