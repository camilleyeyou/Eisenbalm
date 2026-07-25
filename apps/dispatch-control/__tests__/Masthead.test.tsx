/**
 * Plan 30-04 (CHR-02) — Masthead component tests.
 * Updated in Plan 30-06 (CHR-04): Masthead now mounts `AwaitingYouInbox`
 * inside a `relative` wrapper around the trigger, which issues 4 additional
 * `useQuery` calls (`runs.listForWorkspace`, `runs.latest`,
 * `qaCorrections.byRunId`, `claimChecks.allSignedOff`). The mock dispatches
 * by query reference + args (mirrors AwaitingYouInbox.test.tsx) instead of a
 * positional `mockReturnValueOnce` sequence, so it stays correct regardless
 * of how many queries any mounted child issues or in what order.
 *
 * Updated Phase 40 Plan 40-08 (ISS-05 / D-24..D-27) — the masthead was
 * rebuilt into FOUR separate, never-blended readouts (issue status, system
 * activity, My Tasks count, cost vs budget). The old single blended
 * "pipeline-state chip" no longer exists — its tests are replaced by
 * assertions against the new System-activity readout. New query refs
 * (`issues:byIssueNumber`, `signOffs:activeByRunId`,
 * `claimChecks:listByRunId`, `pitchLog:byRunId`) feed `deriveIssueStatus` /
 * `deriveTasks` for the Issue-status and My-Tasks readouts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

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
      listByRunId: 'claimChecks:listByRunId',
    },
    issues: {
      byIssueNumber: 'issues:byIssueNumber',
    },
    signOffs: {
      activeByRunId: 'signOffs:activeByRunId',
    },
    pitchLog: {
      byRunId: 'pitchLog:byRunId',
    },
  },
}))

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <div data-testid="user-button" />,
}))

import { useQuery } from 'convex/react'
import Masthead, { MyTasksTrigger } from '../components/Masthead'
import { CommandPaletteProvider } from '../components/CommandPalette'

// quick 260723-4a6 (Task 2): Masthead now calls useCommandPalette() (the ⌘K
// chip) unconditionally, so every render needs a CommandPaletteProvider
// ancestor. The palette overlay itself only mounts (and only then issues its
// own useQuery calls) once opened — never in these tests — so no additional
// query mocking is needed here.
function renderMasthead() {
  return render(
    <CommandPaletteProvider>
      <Masthead />
    </CommandPaletteProvider>,
  )
}

interface MastheadMocks {
  latest?: unknown
  pipelineRun?: unknown
  mtd?: unknown
  configRows?: unknown[]
  runsList?: unknown[]
  qaFindings?: unknown[]
  claimStatus?: unknown
  issueRow?: unknown
  signOffs?: unknown
  claimRows?: unknown[]
  pitchRows?: unknown[]
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
      case 'claimChecks:listByRunId':
        return args === 'skip' ? undefined : (mocks.claimRows ?? [])
      case 'issues:byIssueNumber':
        return args === 'skip' ? undefined : (mocks.issueRow ?? null)
      case 'signOffs:activeByRunId':
        return args === 'skip' ? undefined : (mocks.signOffs ?? {})
      case 'pitchLog:byRunId':
        return args === 'skip' ? undefined : (mocks.pitchRows ?? [])
      default:
        return undefined
    }
  })
}

afterEach(() => {
  cleanup()
})

describe('Masthead', () => {
  it('renders four SEPARATE readouts: issue status, system activity, My Tasks, and cost vs budget', () => {
    mockMasthead({
      latest: { status: 'complete', runId: 'run-1', startedAt: 1 },
      pipelineRun: { issueNumber: 42 },
      issueRow: { held: false, published: true },
      signOffs: { 'facts-cleared': { actorId: 'a', signedAt: 1 }, 'sounds-human': { actorId: 'a', signedAt: 1 } },
      mtd: { mtdUsd: 12.4, completedCount: 3, trailingCosts: [] },
      configRows: [{ key: 'monthly_cap_usd', value: '200' }],
    })

    renderMasthead()

    // Issue status readout — derived from deriveIssueStatus (published: true)
    const issueStatus = screen.getByText('Published')
    // System activity readout — derived from runs.latest.status
    const systemActivity = screen.getByText('Complete')
    expect(issueStatus).toBeDefined()
    expect(systemActivity).toBeDefined()
    // Never the same element — two distinct state systems, never blended.
    expect(issueStatus).not.toBe(systemActivity)

    // My Tasks readout
    expect(screen.getByText(/My Tasks · \d+/)).toBeDefined()

    // Cost vs budget readout
    const { container } = renderMasthead()
    expect(container.textContent).toContain('$12.40 / $200')
  })

  it('every readout carries an icon (svg) alongside its label — never color alone', () => {
    mockMasthead({
      latest: { status: 'running', runId: 'run-1', startedAt: 1 },
      pipelineRun: { issueNumber: 42 },
      issueRow: { held: false, published: false },
      signOffs: {},
      mtd: { mtdUsd: 12.4, completedCount: 3, trailingCosts: [] },
      configRows: [{ key: 'monthly_cap_usd', value: '200' }],
    })

    renderMasthead()

    const issueStatusLabel = screen.getByText('Needs review')
    expect(issueStatusLabel.parentElement?.querySelector('svg')).not.toBeNull()

    const systemActivityLabel = screen.getByText('Running')
    expect(systemActivityLabel.parentElement?.querySelector('svg')).not.toBeNull()

    const myTasksButton = screen.getByRole('button', { name: /my tasks/i })
    expect(myTasksButton.querySelector('svg')).not.toBeNull()
  })

  it('System activity "Running" uses Loader2 (spin) — reserved exclusively to this readout', () => {
    mockMasthead({
      latest: { status: 'running', runId: 'run-1', startedAt: 1 },
      pipelineRun: { issueNumber: 42 },
    })

    const { container } = renderMasthead()
    const spinners = container.querySelectorAll('.animate-spin')
    expect(spinners.length).toBe(1)
  })

  it('renders "$12.40 / $200" for mtdUsd=12.4 and monthly_cap_usd=200', () => {
    mockMasthead({
      latest: { status: 'running', runId: 'run-1', startedAt: 1 },
      pipelineRun: { issueNumber: 42 },
      mtd: { mtdUsd: 12.4, completedCount: 3, trailingCosts: [] },
      configRows: [{ key: 'monthly_cap_usd', value: '200' }],
    })

    const { container } = renderMasthead()
    expect(container.textContent).toContain('$12.40 / $200')
  })

  it('renders "Human approval required" when auto_publish is false (D-26 rename)', () => {
    mockMasthead({
      latest: { status: 'running', runId: 'run-1', startedAt: 1 },
      pipelineRun: { issueNumber: 42 },
      configRows: [{ key: 'auto_publish', value: 'false' }],
    })

    renderMasthead()
    expect(screen.getByText('Human approval required')).toBeDefined()
  })

  it('renders the reframed ON alert (not switch-framed) with loud vermilion treatment, pointing at Administration (Phase 50-03 D-16)', () => {
    mockMasthead({
      latest: { status: 'running', runId: 'run-1', startedAt: 1 },
      pipelineRun: { issueNumber: 42 },
      configRows: [{ key: 'auto_publish', value: 'true' }],
    })

    renderMasthead()
    // The ON case never reads as a switch flipped here ("Auto-publish
    // ON/OFF") — it names where the setting lives (D-16).
    expect(screen.queryByText(/Auto-publish ON/)).toBeNull()
    const chip = screen.getByText(/Publishing automatically/)
    expect(chip).toBeDefined()
    expect(chip.textContent).toContain('managed in Administration')
    expect(chip.className).toContain('var(--color-vermilion)')
  })

  it('renders "Issue 42" when pipelineRuns.byRunId resolves an issueNumber', () => {
    mockMasthead({
      latest: { status: 'running', runId: 'run-1', startedAt: 1 },
      pipelineRun: { issueNumber: 42 },
    })

    renderMasthead()
    expect(screen.getByText('Issue 42')).toBeDefined()
  })

  it('renders a graceful "Issue —" dash when there is no resolvable issue number', () => {
    mockMasthead({})

    renderMasthead()
    expect(screen.getByText('Issue —')).toBeDefined()
  })

  it('renders the wordmark "DISPATCH" + vermilion "/" + "CONTROL"', () => {
    mockMasthead({})

    const { container } = renderMasthead()
    expect(container.textContent).toContain('DISPATCH')
    expect(container.textContent).toContain('CONTROL')
    const slash = screen.getByText('/')
    expect(slash.className).toContain('var(--color-vermilion)')
  })

  it('renders the My Tasks trigger and the sign-out UserButton', () => {
    mockMasthead({})

    renderMasthead()
    expect(screen.getByRole('button', { name: /my tasks/i })).toBeDefined()
    expect(screen.getByTestId('user-button')).toBeDefined()
  })

  // ── ISS-06: unresolved/failed issue-status inputs → "State unknown — refresh" ──
  it('shows "State unknown — refresh" (never a stale "Ready") when issue-status inputs are unresolved', () => {
    mockMasthead({
      latest: { status: 'awaiting-review', runId: 'run-1', startedAt: 1 },
      pipelineRun: { issueNumber: 42 },
      // issueRow not mocked → resolves to `null` (no issues row found).
      // deriveIssueStatus's `issue === null` branch returns 'unknown'
      // structurally — identically to the genuinely-not-loaded case — so a
      // stale "Ready to publish" can never render.
    })

    renderMasthead()
    expect(screen.getByText('State unknown — refresh')).toBeDefined()
    expect(screen.queryByText('Ready to publish')).toBeNull()
  })

  it('the My Tasks readout still opens the existing AwaitingYouInbox dropdown (D-25 — no capability lost)', () => {
    mockMasthead({})

    renderMasthead()
    const trigger = screen.getByRole('button', { name: /my tasks/i })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: /awaiting you/i })).toBeDefined()
  })

  // ── Quick 260724-x4b (Fix 1, LD-1): the signal becomes a door ────────────
  it('"Paused for you" becomes a link to the run\'s Draft desk when awaiting-review + issueNumber resolved', () => {
    mockMasthead({
      latest: { status: 'awaiting-review', runId: 'run-1', startedAt: 1 },
      pipelineRun: { issueNumber: 42 },
    })

    renderMasthead()
    const link = screen.getByRole('link', { name: /draft desk/i })
    expect(link.getAttribute('href')).toBe('/issues/42/draft')
  })

  it('stays a plain readout (never a Draft-desk link) for any other run status', () => {
    mockMasthead({
      latest: { status: 'complete', runId: 'run-1', startedAt: 1 },
      pipelineRun: { issueNumber: 42 },
    })

    renderMasthead()
    expect(screen.queryByRole('link', { name: /draft desk/i })).toBeNull()
  })
})

describe('MyTasksTrigger', () => {
  it('renders a clickable "My Tasks · N" button', () => {
    const onClick = vi.fn()
    render(<MyTasksTrigger count={3} onClick={onClick} />)
    const btn = screen.getByRole('button', { name: /my tasks · 3/i })
    btn.click()
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders "My Tasks · 0" (never a dead/omitted button) when count is 0', () => {
    render(<MyTasksTrigger count={0} />)
    expect(screen.getByText('My Tasks · 0')).toBeDefined()
  })
})
