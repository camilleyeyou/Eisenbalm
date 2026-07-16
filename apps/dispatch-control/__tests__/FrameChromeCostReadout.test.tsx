/**
 * Phase 45 Plan 45-06 (REV-05, D-12/D-13/D-15) — FrameChrome cost-vs-budget
 * readout tests.
 *
 * Covers REV-05 — the workspace header cost-vs-budget readout
 * (docs/API_CONTRACTS.md §45.5, D-15). Renders the REAL
 * `IssueWorkspaceLayout` (mirrors WorkspaceLayout.test.tsx's established
 * pattern: mock `next/navigation` + `@clerk/nextjs` + `@convex/_generated/api`
 * + `convex/react`'s `useQuery`/`useMutation`, so the real
 * `WorkspaceStateProvider` + `deriveRunCostUsd`/`deriveRunCapUsd` actually run)
 * so the never-blank contract is proven end to end, not just at the pure-fn
 * layer (already covered by derivedState.test.ts).
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// ── next/navigation: fixed params + a Draft-stage pathname ──────────────────
vi.mock('next/navigation', () => ({
  useParams: () => ({ issueNumber: '7' }),
  usePathname: () => '/issues/7/draft',
}))

// ── @clerk/nextjs: the provider + controls both call useAuth().getToken() ───
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

// ── The authoritative-draft fetch the provider runs (blocker fix) — resolve
// with an empty draft so sectionStates derives; irrelevant to this readout. ──
vi.mock('@/lib/contentPatchClient', () => {
  class ContentPatchError extends Error {}
  return {
    ContentPatchError,
    getDraft: vi.fn(async () => ({
      sections: {},
      bonus: null,
      game: null,
      podcast: null,
      conversation: null,
      theme: null,
    })),
  }
})

// ── The Convex api reference object (string handles the useQuery mock keys on) ─
vi.mock('@convex/_generated/api', () => ({
  api: {
    issues: {
      byIssueNumber: 'issues:byIssueNumber',
      setLastVisitedStage: 'issues:setLastVisitedStage',
      hold: 'issues:hold',
      reopen: 'issues:reopen',
    },
    pipelineRuns: {
      byIssueNumber: 'pipelineRuns:byIssueNumber',
      listByIssueNumber: 'pipelineRuns:listByIssueNumber',
    },
    signOffs: { activeByRunId: 'signOffs:activeByRunId' },
    claimChecks: { listByRunId: 'claimChecks:listByRunId' },
    qaCorrections: { byRunId: 'qaCorrections:byRunId' },
    pitchLog: { byRunId: 'pitchLog:byRunId' },
    runs: { byRunId: 'runs:byRunId' },
    agentRuns: { byRunId: 'agentRuns:byRunId' },
    pipelineConfig: { getAll: 'pipelineConfig:getAll' },
    // Phase 47 Plan 47-05 (BRF-01/02/03/05) — Story & Brief stage subscriptions
    // WorkspaceStateProvider now also fires; unmapped in fixtureFor() below so
    // they resolve to the harmless `undefined` default (irrelevant to this test).
    storyLeads: { byRunId: 'storyLeads:byRunId' },
    verificationRecords: { byRunId: 'verificationRecords:byRunId' },
    briefs: { byRunId: 'briefs:byRunId' },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

import { useQuery, useMutation } from 'convex/react'
import IssueWorkspaceLayout from '../app/(dashboard)/issues/[issueNumber]/layout'

// A control object each test mutates BEFORE render — lets the same fixture
// function serve every test (loading vs known agentRuns/pipelineConfig rows).
const control: {
  agentRunRows: Array<{ costUsd?: number }> | undefined
  pipelineConfigRows: Array<{ key: string; value: string }> | undefined
} = {
  agentRunRows: undefined,
  pipelineConfigRows: [],
}

function fixtureFor(ref: unknown): unknown {
  switch (ref) {
    case 'issues:byIssueNumber':
      return { held: false, published: false, heldReason: undefined, heldBy: undefined, heldAt: undefined }
    case 'pipelineRuns:byIssueNumber':
      return { runId: 'run-7', startedAt: Date.now() }
    case 'pipelineRuns:listByIssueNumber':
      return []
    case 'signOffs:activeByRunId':
      return {}
    case 'claimChecks:listByRunId':
      return []
    case 'qaCorrections:byRunId':
      return []
    case 'pitchLog:byRunId':
      return [{ selected: true }]
    case 'runs:byRunId':
      return { status: 'complete' }
    case 'agentRuns:byRunId':
      return control.agentRunRows
    case 'pipelineConfig:getAll':
      return control.pipelineConfigRows
    default:
      return undefined
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  control.agentRunRows = undefined
  control.pipelineConfigRows = []
  ;(useQuery as unknown as Mock).mockImplementation((ref: unknown, args: unknown) => {
    if (args === 'skip') return undefined
    return fixtureFor(ref)
  })
  ;(useMutation as unknown as Mock).mockImplementation(() => vi.fn(async () => null))
})

afterEach(() => {
  cleanup()
})

describe('FrameChrome cost-vs-budget readout (§45.5)', () => {
  it('loading state renders a refresh affordance, never a stale or fabricated zero (never-blank honesty)', () => {
    control.agentRunRows = undefined // agentRuns:byRunId still loading
    control.pipelineConfigRows = [{ key: 'per_run_cap_usd', value: '10' }]
    render(
      <IssueWorkspaceLayout>
        <div>stage canvas</div>
      </IssueWorkspaceLayout>,
    )
    const readout = screen.getByTestId('cost-vs-budget')
    expect(readout.textContent).toMatch(/cost unknown/i)
    expect(readout.textContent).toMatch(/refresh/i)
    expect(readout.textContent).not.toMatch(/\$0/)
  })

  it('renders "$spent / $cap" once both values are known', () => {
    control.agentRunRows = [{ costUsd: 1.2 }, { costUsd: 0.55 }]
    control.pipelineConfigRows = [{ key: 'per_run_cap_usd', value: '25' }]
    render(
      <IssueWorkspaceLayout>
        <div>stage canvas</div>
      </IssueWorkspaceLayout>,
    )
    const readout = screen.getByTestId('cost-vs-budget')
    expect(readout.textContent).toBe('$1.75 / $25.00')
  })

  it('renders next to the existing "{tasks.length} open · ~{workMinutes} min" line', () => {
    control.agentRunRows = []
    control.pipelineConfigRows = [{ key: 'per_run_cap_usd', value: '10' }]
    render(
      <IssueWorkspaceLayout>
        <div>stage canvas</div>
      </IssueWorkspaceLayout>,
    )
    const readout = screen.getByTestId('cost-vs-budget')
    const tasksLine = screen.getByText(/open · ~.*min/)
    // Same immediate parent (the header's flex row) — proves placement
    // beside the tasks/minutes line, not somewhere unrelated in the frame.
    expect(readout.parentElement).toBe(tasksLine.parentElement)
  })
})
