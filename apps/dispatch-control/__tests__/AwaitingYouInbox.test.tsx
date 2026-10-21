/**
 * Phase 30 (CHR-04, Plan 30-06) — AwaitingYouInbox component tests.
 * Rewritten by quick 261021-ind: agents close every finding, so QA findings and
 * contradicted claims never appear; the inbox lists only the run awaiting
 * review ("ready to publish" / legacy Gate 1 "choose the charity") and the
 * failed run, with issue numbers instead of raw run ids.
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
    pipelineRuns: {
      byRunId: 'pipelineRuns:byRunId',
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
  pipelineRuns?: Record<string, { issueNumber: number }>
}

function mockQueries(state: MockState) {
  ;(useQuery as ReturnType<typeof vi.fn>).mockImplementation(
    (queryRef: string, args: unknown) => {
      switch (queryRef) {
        case 'runs:listForWorkspace':
          return state.runsList ?? []
        case 'runs:latest':
          return state.latestRun ?? null
        case 'pipelineRuns:byRunId':
          return args === 'skip'
            ? undefined
            : (state.pipelineRuns?.[(args as { runId: string }).runId] ?? undefined)
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

  it('a finished awaiting-review run reads "Issue N is ready to publish" and links to /', () => {
    mockQueries({
      runsList: [
        { runId: 'r1', status: 'awaiting-review', startedAt: Date.now(), completedAt: Date.now() },
      ],
      latestRun: { runId: 'r1', status: 'awaiting-review' },
      pipelineRuns: { r1: { issueNumber: 7 } },
    })
    render(<AwaitingYouInbox open onClose={vi.fn()} />)

    const link = screen.getByText('Issue 7 is ready to publish').closest('a')
    expect(link?.getAttribute('href')).toBe('/')
    expect(screen.queryByText(/r1/)).toBeNull()
  })

  it('a legacy run paused at Gate 1 (no completedAt) reads "choose the charity"', () => {
    mockQueries({
      runsList: [{ runId: 'r1', status: 'awaiting-review', startedAt: Date.now() }],
      latestRun: { runId: 'r1', status: 'awaiting-review' },
      pipelineRuns: { r1: { issueNumber: 7 } },
    })
    render(<AwaitingYouInbox open onClose={vi.fn()} />)

    const link = screen.getByText('Issue 7: choose the charity').closest('a')
    expect(link?.getAttribute('href')).toBe('/issues/7/story')
  })

  it('never lists QA findings or contradicted claims', () => {
    mockQueries({
      runsList: [
        { runId: 'r1', status: 'awaiting-review', startedAt: Date.now(), completedAt: Date.now() },
      ],
      latestRun: { runId: 'r1', status: 'awaiting-review' },
      pipelineRuns: { r1: { issueNumber: 7 } },
    })
    render(<AwaitingYouInbox open onClose={vi.fn()} />)

    expect(screen.getAllByRole('listitem').length).toBe(1)
    expect(screen.queryByText(/qa blocker|contradicted/i)).toBeNull()
    const queried = (useQuery as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0])
    expect(queried).not.toContain('qaCorrections:byRunId')
    expect(queried).not.toContain('claimChecks:allSignedOff')
  })

  it('lists a failed-run item linking to /run-monitor/runs/rf, labelled by issue number', () => {
    mockQueries({
      runsList: [],
      latestRun: { runId: 'rf', status: 'failed' },
      pipelineRuns: { rf: { issueNumber: 9 } },
    })
    render(<AwaitingYouInbox open onClose={vi.fn()} />)

    const link = screen.getByText('Issue 9: the run failed').closest('a')
    expect(link?.getAttribute('href')).toBe('/run-monitor/runs/rf')
  })

  it('renders an empty-state message when nothing needs the operator', () => {
    mockQueries({
      runsList: [],
      latestRun: { runId: 'x', status: 'complete' },
    })
    render(<AwaitingYouInbox open onClose={vi.fn()} />)

    expect(screen.getByText(/nothing needs you right now/i)).toBeDefined()
  })

  it('calls onClose when an item is clicked', () => {
    const onClose = vi.fn()
    mockQueries({
      runsList: [
        { runId: 'r1', status: 'awaiting-review', startedAt: Date.now(), completedAt: Date.now() },
      ],
      latestRun: { runId: 'r1', status: 'awaiting-review' },
      pipelineRuns: { r1: { issueNumber: 7 } },
    })
    render(<AwaitingYouInbox open onClose={onClose} />)

    const link = screen.getByText(/ready to publish/i).closest('a')
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
