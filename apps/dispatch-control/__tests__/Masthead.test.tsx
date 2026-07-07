/**
 * Plan 30-04 (CHR-02) — Masthead component tests.
 * Updated in Plan 30-06 (CHR-04): Masthead now mounts `AwaitingYouInbox`
 * inside a `relative` wrapper around the trigger, which issues 4 additional
 * `useQuery` calls (`runs.listForWorkspace`, `runs.latest`,
 * `qaCorrections.byRunId`, `claimChecks.allSignedOff`). The mock dispatches
 * by query reference + args (mirrors AwaitingYouInbox.test.tsx) instead of a
 * positional `mockReturnValueOnce` sequence, so it stays correct regardless
 * of how many queries any mounted child issues or in what order.
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
      listForWorkspace: 'runs:listForWorkspace',
    },
    pipelineRuns: {
      byRunId: 'pipelineRuns:byRunId',
    },
    pipelineConfig: {
      getAll: 'pipelineConfig:getAll',
    },
    qaCorrections: {
      byRunId: 'qaCorrections:byRunId',
    },
    claimChecks: {
      allSignedOff: 'claimChecks:allSignedOff',
    },
  },
}))

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <div data-testid="user-button" />,
}))

import { useQuery } from 'convex/react'
import Masthead, { AwaitingYouTrigger } from '../components/Masthead'

interface MastheadMocks {
  latest?: unknown
  pipelineRun?: unknown
  mtd?: unknown
  configRows?: unknown[]
  runsList?: unknown[]
  qaFindings?: unknown[]
  claimStatus?: unknown
}

function mockMasthead(mocks: MastheadMocks) {
  const mocked = useQuery as ReturnType<typeof vi.fn>
  mocked.mockReset()
  mocked.mockImplementation((queryRef: string, args: unknown) => {
    switch (queryRef) {
      case 'runs:latest':
        return mocks.latest ?? null
      case 'pipelineRuns:byRunId':
        return mocks.pipelineRun ?? null
      case 'runs:monthToDateCost':
        return mocks.mtd ?? { mtdUsd: 0, completedCount: 0, trailingCosts: [] }
      case 'pipelineConfig:getAll':
        return mocks.configRows ?? []
      case 'runs:listForWorkspace':
        return mocks.runsList ?? []
      case 'qaCorrections:byRunId':
        return args === 'skip' ? undefined : (mocks.qaFindings ?? [])
      case 'claimChecks:allSignedOff':
        return args === 'skip' ? undefined : mocks.claimStatus
      default:
        return undefined
    }
  })
}

afterEach(() => {
  cleanup()
})

describe('Masthead', () => {
  it('renders a marigold "Awaiting review" pipeline-state chip', () => {
    mockMasthead({
      latest: { status: 'awaiting-review', runId: 'run-1', startedAt: 1 },
      pipelineRun: { issueNumber: 42 },
    })

    render(<Masthead />)
    const chip = screen.getByText('Awaiting review')
    expect(chip).toBeDefined()
    expect(chip.className).toContain('var(--color-marigold)')
  })

  it('renders "$12.40 / $200" for mtdUsd=12.4 and monthly_cap_usd=200', () => {
    mockMasthead({
      latest: { status: 'running', runId: 'run-1', startedAt: 1 },
      pipelineRun: { issueNumber: 42 },
      mtd: { mtdUsd: 12.4, completedCount: 3, trailingCosts: [] },
      configRows: [{ key: 'monthly_cap_usd', value: '200' }],
    })

    const { container } = render(<Masthead />)
    expect(container.textContent).toContain('$12.40 / $200')
  })

  it('renders an "Auto-publish OFF" lock chip when auto_publish is false', () => {
    mockMasthead({
      latest: { status: 'running', runId: 'run-1', startedAt: 1 },
      pipelineRun: { issueNumber: 42 },
      configRows: [{ key: 'auto_publish', value: 'false' }],
    })

    render(<Masthead />)
    expect(screen.getByText(/Auto-publish OFF/)).toBeDefined()
  })

  it('renders an "Auto-publish ON" lock chip when auto_publish is true', () => {
    mockMasthead({
      latest: { status: 'running', runId: 'run-1', startedAt: 1 },
      pipelineRun: { issueNumber: 42 },
      configRows: [{ key: 'auto_publish', value: 'true' }],
    })

    render(<Masthead />)
    expect(screen.getByText(/Auto-publish ON/)).toBeDefined()
  })

  it('renders "Issue 42" when pipelineRuns.byRunId resolves an issueNumber', () => {
    mockMasthead({
      latest: { status: 'running', runId: 'run-1', startedAt: 1 },
      pipelineRun: { issueNumber: 42 },
    })

    render(<Masthead />)
    expect(screen.getByText('Issue 42')).toBeDefined()
  })

  it('renders a graceful "Issue —" dash when there is no resolvable issue number', () => {
    mockMasthead({})

    render(<Masthead />)
    expect(screen.getByText('Issue —')).toBeDefined()
  })

  it('renders the wordmark "DISPATCH" + vermilion "/" + "CONTROL"', () => {
    mockMasthead({})

    const { container } = render(<Masthead />)
    expect(container.textContent).toContain('DISPATCH')
    expect(container.textContent).toContain('CONTROL')
    const slash = screen.getByText('/')
    expect(slash.className).toContain('var(--color-vermilion)')
  })

  it('renders the Awaiting-you trigger and the sign-out UserButton', () => {
    mockMasthead({})

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
