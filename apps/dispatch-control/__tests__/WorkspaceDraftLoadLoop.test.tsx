/**
 * Quick 260721-ohu — loop-bound regression: churning `getToken` + a CONTENT
 * `getDraft` response must NOT retrigger the authoritative-draft-load effect
 * on every render.
 *
 * Root cause (diagnosed, not re-investigated here): the draft-load effect in
 * `WorkspaceStateProvider` depended on `[runId, getToken]`. Clerk's
 * `getToken` is USUALLY referentially stable but churns (new reference)
 * under auth-state changes / token refresh / dev-instance rate-limiting. When
 * it churns, the effect refires every render; on a CONTENT run `getDraft`
 * succeeds and `setDraft(result)` stores a FRESH object -> React re-renders
 * -> effect refires -> infinite loop -> pinned main thread -> dead clicks.
 * Contentless runs don't loop (`setDraft(null)` when already `null)` is a
 * React bail-out) — this test exercises the CONTENT (loop-prone) path.
 *
 * This is the mirror image of `WorkspaceOutlineEmptyState.test.tsx`'s mock
 * harness (same next/navigation, @convex/_generated/api, convex/react,
 * fixtureFor, renderWorkspace) with two DIVERGENCES:
 *   1. `@clerk/nextjs` `useAuth()` returns a NEW `getToken` reference on
 *      EVERY call (a fresh `vi.fn()` inside the factory, not a module-scoped
 *      stable one) — simulating Clerk's dev-instance reference churn. That
 *      sibling file's header comment documents this exact instability as the
 *      direct evidence for this bug; this file exercises it directly.
 *   2. `getDraft` resolves (persistently, not `*Once`) to a run WITH
 *      content, so every effect firing pre-fix triggers an identical
 *      `setDraft` — the loop-prone path.
 *
 * ASSERTION (loop-bound, not loop-exhausting): render, settle a BOUNDED
 * window WITHOUT wrapping it in `act()` (an `act()`-wrapped await would
 * chase an infinite effect flush and hang the test runner — do not do this),
 * then assert `getDraft` was called exactly once.
 *   - Pre-fix: deps `[runId, getToken]`, `getToken` churns every render ->
 *     the effect refires repeatedly over the 50ms window -> `getDraft` called
 *     MANY times (>1) -> assertion FAILS (proves the loop). We never wait for
 *     the loop to stop; we assert after a fixed window, so there's no hang
 *     even though the loop itself does not converge.
 *   - Post-fix: deps `[runId]`, `runId` is constant -> the effect fires
 *     exactly once; the single resulting `setDraft(content)` re-render does
 *     not refire it (getToken is no longer a dep) -> `getDraft` called
 *     exactly once -> PASSES.
 */
import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// ── next/navigation: fixed params + a Draft-stage pathname ──────────────────
// quick 260722-tv1: added useRouter — WorkspaceOutline (mounted by the real
// frame this test renders) now falls back to router.push(...) when a jump
// target's galley anchor isn't in the DOM.
vi.mock('next/navigation', () => ({
  useParams: () => ({ issueNumber: '7' }),
  usePathname: () => '/issues/7/draft',
  useRouter: () => ({ push: vi.fn() }),
}))

// ── @clerk/nextjs: DIVERGENCE 1 — a FRESH getToken reference every render ───
// (churn), simulating Clerk's dev-instance reference instability. This is the
// opposite of WorkspaceOutlineEmptyState.test.tsx's deliberately STABLE mock.
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

// ── The authoritative-draft fetch the provider runs (blocker fix) — the same
// mock shape as the sibling empty-state test: getDraft is a bare mock
// (per-test controllable) and ContentPatchError carries status/reason. ───────
vi.mock('@/lib/contentPatchClient', () => {
  class ContentPatchError extends Error {
    status: number
    reason: string
    constructor(status: number, reason: string, message: string) {
      super(message)
      this.name = 'ContentPatchError'
      this.status = status
      this.reason = reason
    }
  }
  return { ContentPatchError, getDraft: vi.fn() }
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
    storyLeads: { byRunId: 'storyLeads:byRunId' },
    verificationRecords: { byRunId: 'verificationRecords:byRunId' },
    briefs: { byRunId: 'briefs:byRunId' },
    comments: { listByIssueNumber: 'comments:listByIssueNumber', add: 'comments:add' },
    // Quick 260721-qdx — StageHintStrip (now mounted by IssueWorkspaceLayout)
    // unconditionally calls useMutation(api.userOnboarding.dismissStageHint).
    userOnboarding: { dismissStageHint: 'userOnboarding:dismissStageHint' },
  },
}))

vi.mock('convex/react', () => ({
  // fast 260723: FrameChrome's last-visited writer now gates on useConvexAuth.
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

import { useQuery, useMutation } from 'convex/react'
import { getDraft } from '@/lib/contentPatchClient'
import IssueWorkspaceLayout from '../app/(dashboard)/issues/[issueNumber]/layout'

// A fixture that gets a run resolved (runId: 'run-7') so the provider's
// getDraft effect actually fires; mirrors WorkspaceOutlineEmptyState.test.tsx.
function fixtureFor(ref: unknown): unknown {
  switch (ref) {
    case 'issues:byIssueNumber':
      return {
        held: false,
        published: false,
        heldReason: undefined,
        heldBy: undefined,
        heldAt: undefined,
      }
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

function renderWorkspace() {
  return render(
    <IssueWorkspaceLayout>
      <div>canvas</div>
    </IssueWorkspaceLayout>,
  )
}

describe('WorkspaceStateProvider draft-load loop (quick 260721-ohu)', () => {
  it('a churning getToken + content getDraft does not retrigger the fetch — getDraft called exactly once', async () => {
    // DIVERGENCE 2: persistent (not *Once) so every effect firing pre-fix
    // resolves identically — same rationale as the sibling test's header
    // comment (a *Once mock would fall through to `undefined` on refire and
    // mask the loop rather than proving it).
    ;(getDraft as unknown as Mock).mockResolvedValue({
      sections: { originStory: { blocks: [{ type: 'paragraph', text: 'x' }], lossy: false } },
      bonus: null,
      game: null,
      podcast: null,
      conversation: null,
      theme: null,
    })

    renderWorkspace()

    // Sanity: the CONTENT (loop-prone) path was actually exercised.
    expect(await screen.findByTestId('outline-row-originStory')).toBeDefined()

    // Settle a BOUNDED window — deliberately NOT wrapped in act(): an
    // act()-wrapped await here would chase an infinite effect flush
    // (pre-fix) and hang the test runner. We assert after a fixed window; we
    // never wait for the loop to converge.
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(getDraft).toHaveBeenCalledTimes(1)
  })
})
