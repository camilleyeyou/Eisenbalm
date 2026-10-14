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
 *
 * Phase 44 (INS-01, Plan 44-07 Task 2): the screen now calls `useInspector()`
 * (to supply `ClaimProvenanceCard`'s `onInspect`), so every render below is
 * wrapped in `<InspectorProvider>` — mirroring `InspectorProvider.test.tsx`'s
 * own wrapping convention. `activeKey` stays null throughout (no test here
 * clicks Inspect), so the provider renders no panel and adds no new Convex
 * reads.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { InspectorProvider } from '../components/inspector/InspectorProvider'

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

function renderScreen() {
  return render(
    <InspectorProvider>
      <FactCheckScreen runId="run-1" />
    </InspectorProvider>,
  )
}

describe('FactCheckScreen — never-blank summary (D-08/D-11, supersedes FactCheckPlaceholder)', () => {
  it('renders a loading state (never a fake verified state) while rows have not loaded', () => {
    ;(useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue(undefined)

    renderScreen()

    const summary = within(screen.getByRole('region', { name: 'Fact check summary' }))
    // quick 260723-4a6 (Task 1): the loading state is now a shimmer skeleton
    // (components/ui/Skeleton.tsx), not a "Loading…" text string — queried by
    // its stable testid instead of text content.
    expect(summary.getByTestId('fact-check-coverage-loading')).toBeDefined()
    expect(summary.queryByText(/verified/i)).toBeNull()
    expect(summary.queryByText(/\bcomplete\b/i)).toBeNull()
  })

  it('renders "No claims extracted yet" (never blank, never fake-verified) for zero rows', () => {
    ;(useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue([])

    renderScreen()

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

    renderScreen()

    // quick 260722-n5r: scoped to the summary region — the claim table's new
    // per-section group header (below) legitimately repeats "0 must fix" /
    // "0 unchecked" in its own counts line, so an unscoped getByText would
    // now match two elements.
    const summary = within(screen.getByRole('region', { name: 'Fact check summary' }))
    expect(summary.getByText(/0 need you · 0 contradicted/i)).toBeDefined()
    expect(summary.getByText(/0 conflicting sources/i)).toBeDefined()
    expect(summary.getByText(/0 checks not run/i)).toBeDefined()
    expect(summary.getByText(/0 changed since check/i)).toBeDefined()
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

    renderScreen()

    expect(screen.getByText(/not yet verified/i)).toBeDefined()
  })

  it('renders the 8 filter chips once claims have loaded', () => {
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

    renderScreen()

    expect(screen.getByRole('button', { name: 'Needs you' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Contradicted' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'No editor action (audit)' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Changed' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Numbers & dates' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'People & titles' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Organization claims' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Weak source' })).toBeDefined()
  })
})

describe('FactCheckScreen — flagged by default with audit toggle (Phase 51.1)', () => {
  const base = { claimType: 'number', context: 'c', importance: 'Supporting' }
  const rows = [
    { ...base, _id: 'a', claimIndex: 0, text: 'Contradicted claim.', status: 'pending', verdict: 'contradicted', verdictEvidence: 'Source says otherwise.' },
    { ...base, _id: 'b', claimIndex: 1, text: 'Load-bearing unverifiable claim.', status: 'pending', verdict: 'unverifiable', importance: 'Load-bearing' },
    { ...base, _id: 'c', claimIndex: 2, text: 'Verified claim.', status: 'pending', verdict: 'verified' },
    { ...base, _id: 'd', claimIndex: 3, text: 'Legacy claim.', status: 'pending' },
  ]

  it('opens on the 2 claims that need the editor and toggles to the audit list', () => {
    ;(useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue(rows)
    renderScreen()
    expect(screen.getAllByTestId(/^fact-check-row-/)).toHaveLength(2)
    expect(
      within(screen.getByRole('region', { name: 'Fact check summary' })).getByText(
        /2 need you · 1 contradicted/i,
      ),
    ).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Show all 4 claims (audit)' }))
    expect(screen.getAllByTestId(/^fact-check-row-/)).toHaveLength(4)
    expect(screen.getByText(/Audit: \d of 4 claims have an editor action/)).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Show only claims that need you' }))
    expect(screen.getAllByTestId(/^fact-check-row-/)).toHaveLength(2)
  })

  it('says nothing needs the editor when no claim is flagged', () => {
    ;(useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue([rows[2], rows[3]])
    renderScreen()
    expect(screen.getByText(/^Nothing needs you\./)).toBeDefined()
    expect(screen.queryByText(/no claims match the active filters/i)).toBeNull()
    expect(document.body.textContent).not.toMatch(/checked \d+ of \d+/i)
  })
})
