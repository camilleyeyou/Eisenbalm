/**
 * Plan 30-04 (CHR-02) — Masthead component tests.
 *
 * Mirrors the `convex/react` useQuery mocking precedent from
 * `runControl.test.tsx`. useQuery is called in a fixed order inside
 * Masthead: latest -> pipelineRuns.byRunId -> monthToDateCost -> pipelineConfig.getAll.
 * Each test chains `mockReturnValueOnce` in that exact order.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    runs: {
      latest: 'runs:latest',
      monthToDateCost: 'runs:monthToDateCost',
    },
    pipelineRuns: {
      byRunId: 'pipelineRuns:byRunId',
    },
    pipelineConfig: {
      getAll: 'pipelineConfig:getAll',
    },
  },
}))

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <div data-testid="user-button" />,
}))

import { useQuery } from 'convex/react'
import Masthead, { AwaitingYouTrigger } from '../components/Masthead'

function mockSequence(values: unknown[]) {
  const mocked = useQuery as ReturnType<typeof vi.fn>
  mocked.mockReset()
  for (const value of values) {
    mocked.mockReturnValueOnce(value)
  }
}

afterEach(() => {
  cleanup()
})

describe('Masthead', () => {
  it('renders a marigold "Awaiting review" pipeline-state chip', () => {
    mockSequence([
      { status: 'awaiting-review', runId: 'run-1', startedAt: 1 },
      { issueNumber: 42 },
      { mtdUsd: 0, completedCount: 0, trailingCosts: [] },
      [],
    ])

    render(<Masthead />)
    const chip = screen.getByText('Awaiting review')
    expect(chip).toBeDefined()
    expect(chip.className).toContain('var(--color-marigold)')
  })

  it('renders "$12.40 / $200" for mtdUsd=12.4 and monthly_cap_usd=200', () => {
    mockSequence([
      { status: 'running', runId: 'run-1', startedAt: 1 },
      { issueNumber: 42 },
      { mtdUsd: 12.4, completedCount: 3, trailingCosts: [] },
      [{ key: 'monthly_cap_usd', value: '200' }],
    ])

    const { container } = render(<Masthead />)
    expect(container.textContent).toContain('$12.40 / $200')
  })

  it('renders an "Auto-publish OFF" lock chip when auto_publish is false', () => {
    mockSequence([
      { status: 'running', runId: 'run-1', startedAt: 1 },
      { issueNumber: 42 },
      { mtdUsd: 0, completedCount: 0, trailingCosts: [] },
      [{ key: 'auto_publish', value: 'false' }],
    ])

    render(<Masthead />)
    expect(screen.getByText(/Auto-publish OFF/)).toBeDefined()
  })

  it('renders an "Auto-publish ON" lock chip when auto_publish is true', () => {
    mockSequence([
      { status: 'running', runId: 'run-1', startedAt: 1 },
      { issueNumber: 42 },
      { mtdUsd: 0, completedCount: 0, trailingCosts: [] },
      [{ key: 'auto_publish', value: 'true' }],
    ])

    render(<Masthead />)
    expect(screen.getByText(/Auto-publish ON/)).toBeDefined()
  })

  it('renders "Issue 42" when pipelineRuns.byRunId resolves an issueNumber', () => {
    mockSequence([
      { status: 'running', runId: 'run-1', startedAt: 1 },
      { issueNumber: 42 },
      { mtdUsd: 0, completedCount: 0, trailingCosts: [] },
      [],
    ])

    render(<Masthead />)
    expect(screen.getByText('Issue 42')).toBeDefined()
  })

  it('renders a graceful "Issue —" dash when there is no resolvable issue number', () => {
    mockSequence([null, null, { mtdUsd: 0, completedCount: 0, trailingCosts: [] }, []])

    render(<Masthead />)
    expect(screen.getByText('Issue —')).toBeDefined()
  })

  it('renders the wordmark "DISPATCH" + vermilion "/" + "CONTROL"', () => {
    mockSequence([null, null, { mtdUsd: 0, completedCount: 0, trailingCosts: [] }, []])

    const { container } = render(<Masthead />)
    expect(container.textContent).toContain('DISPATCH')
    expect(container.textContent).toContain('CONTROL')
    const slash = screen.getByText('/')
    expect(slash.className).toContain('var(--color-vermilion)')
  })

  it('renders the Awaiting-you trigger and the sign-out UserButton', () => {
    mockSequence([null, null, { mtdUsd: 0, completedCount: 0, trailingCosts: [] }, []])

    render(<Masthead />)
    expect(screen.getByRole('button', { name: /awaiting you/i })).toBeDefined()
    expect(screen.getByTestId('user-button')).toBeDefined()
  })
})

describe('AwaitingYouTrigger', () => {
  it('renders a clickable "Awaiting you" button', () => {
    const onClick = vi.fn()
    render(<AwaitingYouTrigger onClick={onClick} />)
    const btn = screen.getByRole('button', { name: /awaiting you/i })
    btn.click()
    expect(onClick).toHaveBeenCalledOnce()
  })
})
