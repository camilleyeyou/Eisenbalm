/**
 * Phase 42 Plan 42-06 Task 3 (FCT-02) — FactCheckScreen never-blank summary
 * regression tests.
 *
 * Replaces FactCheckPlaceholder.test.tsx (component deleted this plan — the
 * real Stage 3 screen supersedes it). Locks down the D-08/D-11 "blank never
 * means verified" guarantee at the screen level: loading, empty, and
 * zero-counter states each render an explicit, honest line — never a fake
 * verified/complete state and never an omitted counter.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { useQuery } from 'convex/react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    claimChecks: { listByRunId: 'claimChecks:listByRunId', setStatus: 'claimChecks:setStatus' },
  },
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('test-token') }),
}))

vi.mock('../app/(dashboard)/issues/_components/WorkspaceStateProvider', () => ({
  useWorkspaceState: () => ({ setPanelContent: vi.fn(), claimRows: [] }),
}))

import FactCheckScreen from '../app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('FactCheckScreen — never-blank summary (D-08/D-11, supersedes FactCheckPlaceholder)', () => {
  it('renders a loading state (never a fake verified state) while rows have not loaded', () => {
    ;(useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue(undefined)

    render(<FactCheckScreen runId="run-1" />)

    const summary = within(screen.getByRole('region', { name: 'Fact check summary' }))
    expect(summary.getByText(/loading/i)).toBeDefined()
    expect(summary.queryByText(/verified/i)).toBeNull()
    expect(summary.queryByText(/\bcomplete\b/i)).toBeNull()
  })

  it('renders "No claims extracted yet" (never blank, never fake-verified) for zero rows', () => {
    ;(useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue([])

    render(<FactCheckScreen runId="run-1" />)

    const summary = within(screen.getByRole('region', { name: 'Fact check summary' }))
    expect(summary.getByText(/no claims extracted yet/i)).toBeDefined()
    expect(summary.queryByText(/verified/i)).toBeNull()
  })

  it('renders every counter explicitly, even at zero — never omitted', () => {
    ;(useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        _id: 'cc1',
        claimIndex: 0,
        text: 'Founded in 1998 with three volunteers.',
        claimType: 'number',
        context: 'founded in 1998',
        status: 'checked',
        importance: 'Supporting',
        sourceUrl: 'https://example.org/a',
        checkedAt: Date.now(),
      },
    ])

    render(<FactCheckScreen runId="run-1" />)

    expect(screen.getByText(/checked 1 of 1/i)).toBeDefined()
    expect(screen.getByText(/0 must fix/i)).toBeDefined()
    expect(screen.getByText(/0 conflicting sources/i)).toBeDefined()
    expect(screen.getByText(/0 checks not run/i)).toBeDefined()
    expect(screen.getByText(/0 changed since check/i)).toBeDefined()
  })

  it('renders "not yet verified" (never blank) when no claim has ever been checked', () => {
    ;(useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        _id: 'cc1',
        claimIndex: 0,
        text: 'Serves over 400 families annually.',
        claimType: 'number',
        context: 'serves over 400 families',
        status: 'pending',
        importance: 'Supporting',
      },
    ])

    render(<FactCheckScreen runId="run-1" />)

    expect(screen.getByText(/not yet verified/i)).toBeDefined()
  })

  it('renders the 7 filter chips once claims have loaded', () => {
    ;(useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        _id: 'cc1',
        claimIndex: 0,
        text: 'Serves over 400 families annually.',
        claimType: 'number',
        context: 'serves over 400 families',
        status: 'pending',
        importance: 'Supporting',
      },
    ])

    render(<FactCheckScreen runId="run-1" />)

    expect(screen.getByRole('button', { name: 'Must fix' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Unchecked' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Changed' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Numbers & dates' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'People & titles' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Organization claims' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Weak source' })).toBeDefined()
  })
})
