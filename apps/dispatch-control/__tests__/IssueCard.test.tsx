/**
 * Phase 40 Plan 40-01 (§40-UI-SPEC, ISS-01/ISS-06) — RED scaffold for
 * IssueCard: a PRESENTATIONAL component — it takes already-derived values
 * as props (no Convex mock needed; the page assembles DerivationInputs and
 * passes the results in). Props per Plan 40-05:
 *
 *   { issueNumber, status: IssueStatus, stages: StageStateResult[],
 *     openTaskCount, claimCoverage: { checked, total }, voiceState: StageState,
 *     workMinutes, runCostDisplay, state?: { kind: 'loading' | 'error' | 'ok' } }
 *
 * RED until Plan 40-05 implements
 * apps/dispatch-control/app/(dashboard)/issues/_components/IssueCard.tsx.
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import IssueCard from '../app/(dashboard)/issues/_components/IssueCard'

afterEach(() => {
  cleanup()
})

const baseStages = [
  { state: 'clean' as const, openCount: 0 },
  { state: 'clean' as const, openCount: 0 },
  { state: 'needs-you' as const, openCount: 3 },
  { state: 'clean' as const, openCount: 0 },
  { state: 'in-progress' as const, openCount: 0 },
]

const okProps = {
  issueNumber: 7,
  status: 'needs-review' as const,
  stages: baseStages,
  openTaskCount: 3,
  claimCoverage: { checked: 4, total: 6 },
  voiceState: 'clean' as const,
  workMinutes: 12,
  runCostDisplay: '$4.20',
  state: { kind: 'ok' as const },
}

describe('IssueCard (§40-UI-SPEC, ISS-01)', () => {
  it('renders 5 stage segments', () => {
    render(<IssueCard {...okProps} />)
    expect(screen.getAllByTestId('stage-segment')).toHaveLength(5)
  })

  it('renders every ISS-01 readout: status label, open-task count, claim coverage, voice state, ~12 min, and $-prefixed run cost', () => {
    const { container } = render(<IssueCard {...okProps} />)
    expect(container.textContent).toContain('Needs review')
    expect(container.textContent).toContain('3 open')
    expect(container.textContent).toContain('4 of 6 claims checked')
    expect(container.textContent).toContain('~12 min')
    expect(container.textContent).toContain('$4.20')
    // voiceState renders its StageState label somewhere in the card.
    expect(container.textContent).toContain('Clean')
  })

  it('each stage segment carries a text label from the vocabulary (never color alone)', () => {
    render(<IssueCard {...okProps} />)
    const segments = screen.getAllByTestId('stage-segment')
    const allowed = ['Not generated', 'In progress', 'Needs you', 'Clean']
    for (const seg of segments) {
      expect(allowed.some(label => seg.textContent?.includes(label))).toBe(true)
    }
  })

  it('ISS-06: with state.kind="error" shows exact text "State unknown — refresh" and renders neither ready nor clean', () => {
    render(<IssueCard {...okProps} state={{ kind: 'error' }} />)
    expect(screen.getByText('State unknown — refresh')).toBeDefined()
    expect(screen.queryByText(/ready/i)).toBeNull()
    expect(screen.queryByText(/clean/i)).toBeNull()
  })

  it('ISS-06: with status="unknown" in the loaded state ALSO shows "State unknown — refresh"', () => {
    render(<IssueCard {...okProps} status="unknown" state={{ kind: 'ok' }} />)
    expect(screen.getByText('State unknown — refresh')).toBeDefined()
    expect(screen.queryByText(/ready/i)).toBeNull()
    expect(screen.queryByText(/clean/i)).toBeNull()
  })

  it('with state.kind="loading" renders a skeleton that still contains 5 stage segments (geometry preserved)', () => {
    render(<IssueCard {...okProps} state={{ kind: 'loading' }} />)
    const segments = screen.getAllByTestId('stage-segment')
    expect(segments).toHaveLength(5)
  })
})
