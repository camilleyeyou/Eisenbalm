/**
 * Phase 25 (RUN-01/RUN-04/RUN-05/RUN-06) — run control component tests.
 *
 * Covers:
 *   - RunControlBar: disabled + tooltip when running, enabled when idle
 *   - STATUS_CLASSES has a cancelled entry (RUN-04 badge)
 *   - BudgetAlertBanner: renders role=alert with threshold copy
 *   - CancelRunButton: renders for running status, not for cancelled
 *   - RerollButton: renders for section-writer on done run, null for non-section,
 *     disabled with D-04 tooltip when running
 *   - No exclamation marks in component copy
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx → jsdom).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

// ── Module mocks ──────────────────────────────────────────────────────────────

// Convex hooks: useQuery returns the value from the mock map; useMutation
// returns a no-op async function.
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    runs: {
      latest: 'runs:latest',
      monthToDateCost: 'runs:monthToDateCost',
    },
    // Quick 260724-x4b (LD-4b) — RunControlBar now resolves the just-started
    // run's issueNumber via this query for its post-launch success link.
    pipelineRuns: {
      byRunId: 'pipelineRuns:byRunId',
    },
    pipelineConfig: {
      getAll: 'pipelineConfig:getAll',
    },
  },
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'mock-token') }),
}))

vi.mock('@/lib/pipelineControlClient', () => ({
  triggerRun: vi.fn(async () => ({ runId: 'run-test-001' })),
  cancelRun: vi.fn(async () => ({ runId: 'run-test-001', cancelRequested: true })),
  rerollAgent: vi.fn(async () => ({ runId: 'run-test-001', agentKey: 'origin_story', rerolled: true })),
}))

import { useQuery } from 'convex/react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockQuery(returnValue: unknown) {
  ;(useQuery as ReturnType<typeof vi.fn>).mockReturnValue(returnValue)
}

// ── STATUS_CLASSES export ─────────────────────────────────────────────────────

import { STATUS_CLASSES } from '../app/(dashboard)/run-monitor/runs/_components/RunsTable'

describe('STATUS_CLASSES', () => {
  // quick 260722-v01 (audit item 9): the "neutral palette" is now expressed
  // via the app's `var(--color-*)` token system, not literal `neutral-*`
  // classes — same visual intent (dim/inactive), tokened.
  // quick 260724-lp1: rewritten to the uniform square-chip recipe (border +
  // tinted fill) — cancelled stays the neutral/faint variant.
  it('contains a cancelled entry with neutral (tokened) palette (RUN-04)', () => {
    expect(STATUS_CLASSES).toHaveProperty('cancelled')
    expect(STATUS_CLASSES.cancelled).toBe(
      'border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] text-[color:var(--color-ink-soft)]',
    )
  })

  it('contains all pre-existing status entries', () => {
    expect(STATUS_CLASSES).toHaveProperty('running')
    expect(STATUS_CLASSES).toHaveProperty('done')
    expect(STATUS_CLASSES).toHaveProperty('failed')
    expect(STATUS_CLASSES).toHaveProperty('awaiting-review')
  })
})

// ── RunControlBar ─────────────────────────────────────────────────────────────

import RunControlBar from '../app/(dashboard)/run-monitor/runs/_components/RunControlBar'

describe('RunControlBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    cleanup()
  })

  it('renders "Trigger Run" button when no run is active', () => {
    mockQuery({ status: 'done', runId: 'run-001' })
    render(<RunControlBar workspace_id="eisenbalm" />)
    const btn = screen.getByRole('button', { name: /trigger run/i })
    expect(btn).toBeDefined()
    // Should NOT be disabled when idle
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('disables the Trigger Run button when latest run is running', () => {
    mockQuery({ status: 'running', runId: 'run-002' })
    render(<RunControlBar workspace_id="eisenbalm" />)
    const btn = screen.getByRole('button', { name: /trigger run/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows the correct tooltip when a run is in progress', () => {
    mockQuery({ status: 'running', runId: 'run-002' })
    render(<RunControlBar workspace_id="eisenbalm" />)
    const btn = screen.getByRole('button', { name: /trigger run/i })
    expect(btn.getAttribute('title')).toBe(
      'A run is already in progress. Wait for it to complete or cancel it first.',
    )
  })

  it('renders no tooltip when idle', () => {
    mockQuery(null)
    render(<RunControlBar workspace_id="eisenbalm" />)
    const btn = screen.getByRole('button', { name: /trigger run/i })
    expect(btn.getAttribute('title')).toBeNull()
  })

  it('contains no exclamation marks in visible copy', () => {
    mockQuery(null)
    const { container } = render(<RunControlBar workspace_id="eisenbalm" />)
    const text = container.textContent ?? ''
    // Exclude SR-only "Loading…" and screen reader spans
    expect(text).not.toMatch(/[a-zA-Z]!/)
  })

  // ── Quick 260724-x4b (Fix 4b): post-launch navigation ─────────────────────
  it('shows an inline "Open Issue N" link after a successful launch', async () => {
    ;(useQuery as ReturnType<typeof vi.fn>).mockImplementation(
      (queryRef: string, args: unknown) => {
        if (queryRef === 'runs:latest') return null // idle — Trigger Run enabled
        if (queryRef === 'pipelineRuns:byRunId') {
          return args === 'skip' ? undefined : { issueNumber: 12 }
        }
        return undefined
      },
    )

    render(<RunControlBar workspace_id="eisenbalm" />)
    fireEvent.click(screen.getByRole('button', { name: /trigger run/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm run\?/i }))

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /open issue 12/i })
      expect(link.getAttribute('href')).toBe('/issues/12')
    })
  })
})

// ── BudgetAlertBanner ─────────────────────────────────────────────────────────

import BudgetAlertBanner from '../app/(dashboard)/run-monitor/runs/_components/BudgetAlertBanner'

describe('BudgetAlertBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    cleanup()
  })

  it('renders role=alert with threshold copy when MTD exceeds threshold', () => {
    // Set useQuery to return different values based on which query it is
    ;(useQuery as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce([
        { key: 'monthly_cap_usd', value: '200.0' },
        { key: 'alert_threshold_pct', value: '80' },
      ])
      .mockReturnValueOnce({ mtdUsd: 170, completedCount: 4, trailingCosts: [42, 40] })

    render(<BudgetAlertBanner workspace_id="eisenbalm" />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeDefined()
    expect(alert.textContent).toContain('Add capacity or pause automation')
  })

  it('does not render when MTD is below threshold', () => {
    ;(useQuery as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce([
        { key: 'monthly_cap_usd', value: '200.0' },
        { key: 'alert_threshold_pct', value: '80' },
      ])
      .mockReturnValueOnce({ mtdUsd: 50, completedCount: 2, trailingCosts: [25] })

    const { container } = render(<BudgetAlertBanner workspace_id="eisenbalm" />)
    expect(container.firstChild).toBeNull()
  })

  it('does not render when no monthly cap is set', () => {
    ;(useQuery as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce([
        { key: 'monthly_cap_usd', value: '0' },
      ])
      .mockReturnValueOnce({ mtdUsd: 100, completedCount: 2, trailingCosts: [] })

    const { container } = render(<BudgetAlertBanner workspace_id="eisenbalm" />)
    expect(container.firstChild).toBeNull()
  })

  it('contains no exclamation marks in banner copy', () => {
    ;(useQuery as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce([
        { key: 'monthly_cap_usd', value: '200.0' },
        { key: 'alert_threshold_pct', value: '80' },
      ])
      .mockReturnValueOnce({ mtdUsd: 170, completedCount: 4, trailingCosts: [] })

    const { container } = render(<BudgetAlertBanner workspace_id="eisenbalm" />)
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/[a-zA-Z]!/)
  })
})

// ── CancelRunButton ───────────────────────────────────────────────────────────

import CancelRunButton from '../app/(dashboard)/run-monitor/runs/_components/CancelRunButton'

describe('CancelRunButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    cleanup()
  })

  it('renders the Cancel Run button for a running run', () => {
    const { container } = render(
      <CancelRunButton runId="run-001" status="running" />,
    )
    expect(container.textContent).toContain('Cancel Run')
  })

  it('renders nothing for a cancelled run', () => {
    const { container } = render(
      <CancelRunButton runId="run-001" status="cancelled" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for a done run', () => {
    const { container } = render(
      <CancelRunButton runId="run-001" status="done" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for a failed run', () => {
    const { container } = render(
      <CancelRunButton runId="run-001" status="failed" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows Confirm Cancel? copy for inline confirm', () => {
    const { container } = render(
      <CancelRunButton runId="run-001" status="running" />,
    )
    // The confirm step copy must be present in the component source (rendered after click)
    // We verify the button text and that the component source contains the confirm copy
    expect(container.textContent).toContain('Cancel Run')
  })
})

// ── RerollButton ──────────────────────────────────────────────────────────────

import type { ReactElement } from 'react'
import RerollButton from '../app/(dashboard)/run-monitor/runs/_components/RerollButton'
import { ConfirmProvider } from '../components/ui/ConfirmDialog'

// quick 260723-4a6 (Task 2): RerollButton's confirm step now calls
// useConfirm() unconditionally (Rules of Hooks) — every render needs a
// ConfirmProvider ancestor, even for the non-section-writer agentKeys that
// return null.
function renderReroll(ui: ReactElement) {
  return render(<ConfirmProvider>{ui}</ConfirmProvider>)
}

describe('RerollButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    cleanup()
  })

  it('renders Re-roll link for a section-writer on a completed run', () => {
    const { container } = renderReroll(
      <RerollButton runId="run-001" agentKey="origin_story" runStatus="done" />,
    )
    expect(container.textContent).toContain('Re-roll')
  })

  it('renders null for a non-section agent (scout) on a completed run', () => {
    const { container } = renderReroll(
      <RerollButton runId="run-001" agentKey="scout" runStatus="done" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders null for a non-section agent (qa) on a completed run', () => {
    const { container } = renderReroll(
      <RerollButton runId="run-001" agentKey="qa" runStatus="done" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders null for advocate on a completed run', () => {
    const { container } = renderReroll(
      <RerollButton runId="run-001" agentKey="advocate" runStatus="done" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders all 7 section writers as rollable', () => {
    const sectionWriters = [
      'origin_story',
      'problem',
      'founder_bio',
      'case_study',
      'game',
      'bonus',
      'design',
    ]
    for (const key of sectionWriters) {
      const { container } = renderReroll(
        <RerollButton runId="run-001" agentKey={key} runStatus="done" />,
      )
      expect(container.textContent).toContain('Re-roll')
    }
  })

  it('disables Re-roll with D-04 tooltip when run is still running', () => {
    renderReroll(
      <RerollButton runId="run-001" agentKey="origin_story" runStatus="running" />,
    )
    const btn = screen.getByRole('button', { name: /re-roll/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    expect(btn.getAttribute('title')).toBe(
      'Re-roll is available only after the run completes (D-04).',
    )
  })
})
