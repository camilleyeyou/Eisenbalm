/**
 * Phase 41 Plan 41-11 (WSP-03 gap closure) — ContextPanel slot regression.
 *
 * Proves the mechanism end-to-end: a nested stage route can publish content
 * into the frame's single persistent ContextPanel via
 * `useWorkspaceState().setPanelContent`, and the frame renders it — the
 * panel no longer hardcodes `{null}`. Also proves the honest-empty default:
 * when no stage publishes, the panel still shows its never-blank
 * placeholder (not a crash, not stale content).
 *
 * Mirrors WorkspaceLayout.test.tsx's mock block verbatim (same 5 vi.mock
 * calls + fixture) so the REAL provider + REAL layout render end-to-end.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { useEffect } from 'react'
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

// ── Quick 260721-qdx: IssueWorkspaceLayout now mounts StageHintStrip, which
// reads the shell-level onboarding context (@/components/onboarding/
// OnboardingProvider) — NOT mounted by this test (it only renders the Issue
// Workspace layout in isolation, not the full dashboard shell). Mock
// useOnboarding() directly; this test has no assertions about onboarding. ───
vi.mock('@/components/onboarding/OnboardingProvider', () => ({
  useOnboarding: () => ({ onboarding: null }),
}))

// ── The authoritative-draft fetch the provider runs (blocker fix) — resolve
// with an empty draft so sectionStates derives (all not-generated); the slot
// doesn't depend on it, but this keeps the provider's useEffect from throwing. ─
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
    // Phase 49 Plan 08 (ROL-04) — the persistent Comments affordance FrameChrome
    // now mounts; unmapped in fixtureFor() below so it resolves to the
    // harmless `undefined` default (irrelevant to this file's assertions).
    comments: { listByIssueNumber: 'comments:listByIssueNumber', add: 'comments:add' },
    // Quick 260721-qdx — StageHintStrip (now mounted by IssueWorkspaceLayout)
    // unconditionally calls useMutation(api.userOnboarding.dismissStageHint).
    userOnboarding: { dismissStageHint: 'userOnboarding:dismissStageHint' },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

import { useQuery, useMutation } from 'convex/react'
import IssueWorkspaceLayout from '../app/(dashboard)/issues/[issueNumber]/layout'
import { useWorkspaceState } from '../app/(dashboard)/issues/_components/WorkspaceStateProvider'

// Same fixture shape as WorkspaceLayout.test.tsx — the slot mechanism is
// independent of stage-derivation specifics, but this keeps every query
// resolved (never `undefined`) so the frame renders its full chrome.
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

/** A tiny in-test client publisher standing in for a Plan 41-12 stage page. */
function SlotProbe() {
  const { setPanelContent } = useWorkspaceState()
  useEffect(() => {
    setPanelContent(<span>PANEL_PROBE_CONTENT</span>)
  }, [setPanelContent])
  return null
}

describe('IssueWorkspaceLayout ContextPanel slot (WSP-03 gap closure, Plan 41-11)', () => {
  it('publishes stage content into the single ContextPanel', () => {
    render(
      <IssueWorkspaceLayout>
        <SlotProbe />
      </IssueWorkspaceLayout>,
    )
    expect(screen.getByText('PANEL_PROBE_CONTENT')).toBeDefined()
    expect(screen.queryByText(/nothing to show for this stage yet/i)).toBeNull()
  })

  it('shows the never-blank placeholder when no stage publishes', () => {
    render(
      <IssueWorkspaceLayout>
        <div>stage canvas</div>
      </IssueWorkspaceLayout>,
    )
    expect(screen.getByText(/nothing to show for this stage yet/i)).toBeDefined()
  })
})
