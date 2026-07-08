/**
 * Phase 33 (D-04, Plan 33-05 Task 2) — ResolvedFindingsList tests.
 *
 * The collapsed resolved-findings list at the foot of the decision rail —
 * the ONLY operator surface exposing accepted/dismissed findings (the galley
 * hides them per D-03), and therefore the only place reopenFinding is
 * reachable:
 *   (a) the disclosure shows the resolved count and expands to list them
 *   (b) Reopen invokes reopenFinding(runId, findingId, token)
 *   (c) an all-open dataset renders "No resolved findings yet" (never blank)
 *   (d) the accepted-vs-dismissed badge derives correctly, including the
 *       legacy `accepted===true` + no `resolution` case ⇒ "accepted"
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    qaCorrections: { byRunId: 'qaCorrections:byRunId' },
  },
}))

vi.mock('@/lib/findingsClient', () => {
  class FindingsError extends Error {
    constructor(
      public readonly status: number,
      public readonly reason: string,
      message: string,
    ) {
      super(message)
      this.name = 'FindingsError'
    }
  }
  return {
    FindingsError,
    acceptFinding: vi.fn(),
    dismissFinding: vi.fn(),
    reopenFinding: vi.fn(async () => ({ findingId: 'f-dis', resolution: null })),
  }
})

import { useQuery } from 'convex/react'
import { reopenFinding, FindingsError } from '@/lib/findingsClient'
import ResolvedFindingsList from '../app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList'

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

const openFinding = {
  _id: 'f-open',
  findingId: 'f-open',
  sectionName: 'origin_story',
  severity: 'error' as const,
  reason: 'Still open.',
}

const dismissedFinding = {
  _id: 'f-dis',
  findingId: 'f-dis',
  sectionName: 'problem',
  severity: 'warning' as const,
  reason: 'Anchor was stale; text already rewritten.',
  resolution: 'dismissed' as const,
  resolutionReason: 'fixed by my edit',
}

const acceptedFinding = {
  _id: 'f-acc',
  findingId: 'f-acc',
  sectionName: 'case_study',
  severity: 'error' as const,
  reason: 'Applied the suggested fix.',
  resolution: 'accepted' as const,
}

// Legacy row: accepted flag only, no §33.1 resolution value.
const legacyAcceptedFinding = {
  _id: 'f-legacy',
  findingId: 'f-legacy',
  sectionName: 'founder_bio',
  severity: 'warning' as const,
  reason: 'Accepted before Phase 33 landed.',
  accepted: true,
}

function mockRows(rows: unknown) {
  ;(useQuery as unknown as Mock).mockReturnValue(rows)
}

// ── (a) Disclosure + count ──────────────────────────────────────────────────

describe('ResolvedFindingsList disclosure', () => {
  it('shows the resolved count in the collapsed toggle and expands to list findings', () => {
    mockRows([openFinding, dismissedFinding, acceptedFinding])
    render(<ResolvedFindingsList runId="run-1" />)

    const toggle = screen.getByRole('button', { name: /resolved \(2\)/i })
    // Collapsed by default — resolved rows are not visible yet.
    expect(screen.queryByText(dismissedFinding.reason)).toBeNull()

    fireEvent.click(toggle)
    expect(screen.getByText(dismissedFinding.reason)).toBeDefined()
    expect(screen.getByText(acceptedFinding.reason)).toBeDefined()
    // Open findings never appear in the resolved list.
    expect(screen.queryByText(openFinding.reason)).toBeNull()
  })

  it('renders "Loading…" while rows are undefined', () => {
    mockRows(undefined)
    render(<ResolvedFindingsList runId="run-1" />)
    expect(screen.getByText(/loading/i)).toBeDefined()
  })
})

// ── (b) Reopen action (D-04) ────────────────────────────────────────────────

describe('ResolvedFindingsList reopen (D-04)', () => {
  it('clicking Reopen calls reopenFinding(runId, findingId, token)', async () => {
    mockRows([dismissedFinding])
    render(<ResolvedFindingsList runId="run-1" />)

    fireEvent.click(screen.getByRole('button', { name: /resolved \(1\)/i }))
    fireEvent.click(screen.getByRole('button', { name: /reopen/i }))

    await waitFor(() => {
      expect(reopenFinding).toHaveBeenCalledWith('run-1', 'f-dis', 'tok-clerk')
    })
  })

  it('surfaces an inline "already open" note on a not_resolved 409 without crashing', async () => {
    mockRows([dismissedFinding])
    ;(reopenFinding as unknown as Mock).mockRejectedValueOnce(
      new FindingsError(409, 'not_resolved', 'Finding is not resolved.'),
    )
    render(<ResolvedFindingsList runId="run-1" />)

    fireEvent.click(screen.getByRole('button', { name: /resolved \(1\)/i }))
    fireEvent.click(screen.getByRole('button', { name: /reopen/i }))

    await waitFor(() => {
      expect(screen.getByText(/already open/i)).toBeDefined()
    })
  })
})

// ── (c) Never-blank empty state ─────────────────────────────────────────────

describe('ResolvedFindingsList empty state', () => {
  it('renders "No resolved findings yet" when every finding is open — never blank', () => {
    mockRows([openFinding])
    render(<ResolvedFindingsList runId="run-1" />)
    expect(screen.getByText(/no resolved findings yet/i)).toBeDefined()
  })
})

// ── (d) Badge derivation ────────────────────────────────────────────────────

describe('ResolvedFindingsList badges', () => {
  it('derives accepted vs dismissed badges from resolution', () => {
    mockRows([dismissedFinding, acceptedFinding])
    render(<ResolvedFindingsList runId="run-1" />)

    fireEvent.click(screen.getByRole('button', { name: /resolved \(2\)/i }))
    expect(screen.getByText(/^dismissed$/i)).toBeDefined()
    expect(screen.getAllByText(/^accepted$/i).length).toBeGreaterThan(0)
  })

  it('legacy accepted===true with no resolution value still badges as "accepted"', () => {
    mockRows([legacyAcceptedFinding])
    render(<ResolvedFindingsList runId="run-1" />)

    fireEvent.click(screen.getByRole('button', { name: /resolved \(1\)/i }))
    expect(screen.getByText(/^accepted$/i)).toBeDefined()
  })
})
