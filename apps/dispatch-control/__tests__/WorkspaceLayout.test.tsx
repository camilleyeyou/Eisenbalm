/**
 * Phase 41 Plan 41-06 (WSP-01, D-01/D-02) — Issue Workspace frame tests.
 *
 * Proves the frame's stage tabs are LIVE (derived from the real provider
 * derivation, not hard-coded): convex/react `useQuery` is mocked to feed the
 * REAL `WorkspaceStateProvider` a fixture, so `deriveStageStates` actually
 * runs and the 5 tabs render their derived state marks. `useParams`/
 * `usePathname` are mocked so the active-tab (`aria-current`) logic can be
 * asserted against a pathname of `/issues/7/draft`.
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
// with an empty draft so sectionStates derives (all not-generated); the tabs
// don't depend on it, but this keeps the provider's useEffect from throwing. ─
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
import { STAGE_STATE_LABELS } from '../app/(dashboard)/issues/_components/StageStrip'

const STAGE_LABELS = ['Story', 'Draft', 'Fact Check', 'Voice', 'Approval']
const STAGE_SEGMENTS = ['story', 'draft', 'fact-check', 'voice', 'approval']

// A fixture that gives every stage a real, distinct derived mark: run exists,
// pitch selected (Story = clean), no findings/claims (Draft/Fact Check =
// not-generated), no voice sign-off on a completed run (Voice = needs-you),
// no sign-offs (Approval = in-progress).
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
    default:
      return undefined
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(useQuery as unknown as Mock).mockImplementation((ref: unknown, args: unknown) => {
    if (args === 'skip') return undefined
    return fixtureFor(ref)
  })
  ;(useMutation as unknown as Mock).mockImplementation(() => vi.fn(async () => null))
})

afterEach(() => {
  cleanup()
})

describe('IssueWorkspaceLayout stage tabs (WSP-01, D-02)', () => {
  it('renders exactly 5 stage tabs, one per STAGE_LABELS entry', () => {
    render(
      <IssueWorkspaceLayout>
        <div>stage canvas</div>
      </IssueWorkspaceLayout>,
    )
    for (const segment of STAGE_SEGMENTS) {
      expect(screen.getByTestId(`workspace-tab-${segment}`)).toBeDefined()
    }
    for (const label of STAGE_LABELS) {
      // The label text renders inside its tab (getAllByText tolerates the
      // outline/other chrome that may repeat a word).
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('every tab carries a live state mark (a derived STAGE_STATE_LABELS value)', () => {
    render(
      <IssueWorkspaceLayout>
        <div>stage canvas</div>
      </IssueWorkspaceLayout>,
    )
    const allStateLabels = Object.values(STAGE_STATE_LABELS)
    for (const segment of STAGE_SEGMENTS) {
      const tab = screen.getByTestId(`workspace-tab-${segment}`)
      const hasMark = allStateLabels.some(label => tab.textContent?.includes(label))
      expect(hasMark, `tab ${segment} should show a derived state mark`).toBe(true)
    }
  })

  it('marks the active tab (pathname /issues/7/draft) with aria-current="page"', () => {
    render(
      <IssueWorkspaceLayout>
        <div>stage canvas</div>
      </IssueWorkspaceLayout>,
    )
    const draftTab = screen.getByTestId('workspace-tab-draft')
    expect(draftTab.getAttribute('aria-current')).toBe('page')

    // And no OTHER tab claims to be the active page.
    for (const segment of STAGE_SEGMENTS.filter(s => s !== 'draft')) {
      const tab = screen.getByTestId(`workspace-tab-${segment}`)
      expect(tab.getAttribute('aria-current')).toBeNull()
    }
  })
})
