/**
 * Phase 30 (CHR-04, Plan 30-06) — AwaitingYouInbox component tests.
 *
 * Covers:
 *   - Awaiting-review runs render + route to /run-monitor/runs/{runId}/review
 *   - Unresolved error-severity qaCorrections render as blockers, ordered
 *     ABOVE awaiting-review items
 *   - Open claim-check sign-offs render as an item
 *   - The current-cycle failed run renders + routes to /run-monitor/runs/{runId}
 *   - Empty state renders when nothing needs the operator
 *   - Source-scan: AwaitingYouInbox.tsx contains no `mutation(` call (D-09
 *     pure-derivation guarantee)
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx → jsdom).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    runs: {
      listForWorkspace: 'runs:listForWorkspace',
      latest: 'runs:latest',
    },
    qaCorrections: {
      byRunId: 'qaCorrections:byRunId',
    },
    claimChecks: {
      allSignedOff: 'claimChecks:allSignedOff',
    },
  },
}))

import { useQuery } from 'convex/react'
import AwaitingYouInbox from '../components/AwaitingYouInbox'

// ── Helpers ───────────────────────────────────────────────────────────────────

interface MockState {
  runsList?: unknown[]
  latestRun?: unknown
  qaFindings?: unknown[]
  claimStatus?: unknown
}

function mockQueries(state: MockState) {
  ;(useQuery as ReturnType<typeof vi.fn>).mockImplementation(
    (queryRef: string, args: unknown) => {
      switch (queryRef) {
        case 'runs:listForWorkspace':
          return state.runsList ?? []
        case 'runs:latest':
          return state.latestRun ?? null
        case 'qaCorrections:byRunId':
          return args === 'skip' ? undefined : (state.qaFindings ?? [])
        case 'claimChecks:allSignedOff':
          return args === 'skip' ? undefined : state.claimStatus
        default:
          return undefined
      }
    },
  )
}

describe('AwaitingYouInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    cleanup()
  })

  it('renders nothing when closed', () => {
    mockQueries({})
    const { container } = render(<AwaitingYouInbox open={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('lists an Awaiting review item linking to /run-monitor/runs/r1/review', () => {
    mockQueries({
      runsList: [{ runId: 'r1', status: 'awaiting-review', startedAt: Date.now() }],
      latestRun: { runId: 'r1', status: 'awaiting-review' },
      qaFindings: [],
      claimStatus: { total: 0, signedOff: 0, allSignedOff: false },
    })
    render(<AwaitingYouInbox open onClose={vi.fn()} />)

    const link = screen.getByText(/awaiting review/i).closest('a')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('/run-monitor/runs/r1/review')
  })

  it('lists an error-blocker item ordered above the awaiting-review item', () => {
    mockQueries({
      runsList: [{ runId: 'r1', status: 'awaiting-review', startedAt: Date.now() }],
      latestRun: { runId: 'r1', status: 'awaiting-review' },
      qaFindings: [
        {
          _id: 'qa1',
          runId: 'r1',
          sectionName: 'originStory',
          severity: 'error',
          accepted: false,
        },
      ],
      claimStatus: { total: 0, signedOff: 0, allSignedOff: false },
    })
    render(<AwaitingYouInbox open onClose={vi.fn()} />)

    const items = screen.getAllByRole('listitem')
    expect(items.length).toBe(2)
    expect(items[0].textContent).toMatch(/qa blocker/i)
    expect(items[1].textContent).toMatch(/awaiting review/i)

    const qaLink = items[0].querySelector('a')
    expect(qaLink?.getAttribute('href')).toBe('/run-monitor/runs/r1/review')
  })

  it('lists an open sign-offs item when claim checks are incomplete', () => {
    mockQueries({
      runsList: [{ runId: 'r1', status: 'awaiting-review', startedAt: Date.now() }],
      latestRun: { runId: 'r1', status: 'awaiting-review' },
      qaFindings: [],
      claimStatus: { total: 3, signedOff: 1, allSignedOff: false },
    })
    render(<AwaitingYouInbox open onClose={vi.fn()} />)

    expect(screen.getByText(/sign-offs open \(1\/3\)/i)).toBeDefined()
  })

  it('lists a failed-run item linking to /run-monitor/runs/rf', () => {
    mockQueries({
      runsList: [],
      latestRun: { runId: 'rf', status: 'failed' },
      qaFindings: [],
      claimStatus: undefined,
    })
    render(<AwaitingYouInbox open onClose={vi.fn()} />)

    const link = screen.getByText(/run failed/i).closest('a')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('/run-monitor/runs/rf')
  })

  it('renders an empty-state message when nothing needs the operator', () => {
    mockQueries({
      runsList: [],
      latestRun: { runId: 'x', status: 'complete' },
      qaFindings: [],
      claimStatus: undefined,
    })
    render(<AwaitingYouInbox open onClose={vi.fn()} />)

    expect(screen.getByText(/nothing needs you right now/i)).toBeDefined()
  })

  it('calls onClose when an item is clicked', () => {
    const onClose = vi.fn()
    mockQueries({
      runsList: [{ runId: 'r1', status: 'awaiting-review', startedAt: Date.now() }],
      latestRun: { runId: 'r1', status: 'awaiting-review' },
      qaFindings: [],
      claimStatus: { total: 0, signedOff: 0, allSignedOff: false },
    })
    render(<AwaitingYouInbox open onClose={onClose} />)

    const link = screen.getByText(/awaiting review/i).closest('a')
    link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(onClose).toHaveBeenCalled()
  })
})

// ── Source-scan: D-09 pure-derivation guarantee ──────────────────────────────

describe('AwaitingYouInbox source scan (D-09)', () => {
  it('contains no `mutation(` call — pure client-side derivation, zero new backend', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../components/AwaitingYouInbox.tsx'),
      'utf-8',
    )
    const mutationCalls = source.match(/mutation\(/g) ?? []
    expect(mutationCalls.length).toBe(0)
  })
})
