/**
 * Quick 260720-ig5 — WorkspaceOutline empty-state regression.
 *
 * The Issue Workspace outline sidebar must resolve to THREE distinct
 * outcomes (not two) from the provider's authoritative-draft fetch
 * (`WorkspaceStateProvider`'s `getDraft` effect):
 *   1. still loading -> "Loading outline…" (`outline-loading`)
 *   2. loaded with content -> the real per-section rows
 *   3. loaded but definitively contentless (`ContentPatchError` with
 *      `reason === 'no_sanity_issue'`, a 409) -> an HONEST resolved empty
 *      state (`outline-empty`), never a perpetual spinner.
 *
 * Mirrors WorkspaceLayout.test.tsx's mock harness VERBATIM (next/navigation,
 * @clerk/nextjs, @convex/_generated/api, convex/react, fixtureFor) so the
 * REAL WorkspaceStateProvider + IssueWorkspaceLayout render end to end. The
 * ONLY divergence is the `@/lib/contentPatchClient` mock: getDraft is
 * per-test controllable (mockRejectedValue/mockResolvedValue) and the
 * stubbed ContentPatchError carries a `status`/`reason` so the provider's
 * `e instanceof ContentPatchError && e.reason === 'no_sanity_issue'` branch
 * can be exercised against the SAME mocked class the provider imports.
 *
 * Uses the PERSISTENT `mockRejectedValue`/`mockResolvedValue` (not the
 * `*Once` variants): the mocked `@clerk/nextjs` `useAuth()` returns a fresh
 * `getToken` reference on every render (same as WorkspaceLayout.test.tsx),
 * so the provider's draft-fetch effect can legitimately re-fire more than
 * once per test. A persistent mock keeps every firing's outcome identical
 * regardless of how many times it runs; a `*Once` mock would let a second
 * firing fall through to the mock's default (`undefined`), silently
 * resetting `draftContentAbsent` after the assertion's `findBy*` resolves.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
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

// ── @clerk/nextjs: the provider + controls both call useAuth().getToken() ───
// A STABLE getToken reference (module-scoped, not re-created inside the
// factory arrow) — deliberate divergence from WorkspaceLayout.test.tsx's
// verbatim precedent, which creates a fresh `vi.fn()` on every `useAuth()`
// call. That instability is invisible over there (its getDraft mock always
// resolves the SAME content, so the resulting re-fires of the provider's
// draft-fetch effect are idempotent no-ops). THIS file's timing-sensitive
// assertions (a boolean flag toggling loading vs. empty) are NOT idempotent
// against that instability: an unstable getToken retriggers the effect's
// `[runId, getToken]` dependency on every render, and each retrigger
// synchronously resets `draftContentAbsent` to `false` before its async
// catch sets it back — a real (if narrow) re-render race, not a fix defect.
// Real Clerk's `useAuth().getToken` is referentially stable across renders,
// so a stable mock here is the accurate simulation.
const mockGetToken = vi.fn(async () => 'tok-clerk')
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}))

// ── Quick 260721-qdx: IssueWorkspaceLayout now mounts StageHintStrip, which
// reads the shell-level onboarding context (@/components/onboarding/
// OnboardingProvider) — NOT mounted by this test (it only renders the Issue
// Workspace layout in isolation, not the full dashboard shell). Mock
// useOnboarding() directly; this test has no assertions about onboarding. ───
vi.mock('@/components/onboarding/OnboardingProvider', () => ({
  useOnboarding: () => ({ onboarding: null }),
}))

// ── The authoritative-draft fetch the provider runs (blocker fix) — the ONLY
// divergence from WorkspaceLayout.test.tsx's mock: getDraft is a bare mock
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
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

import { useQuery, useMutation } from 'convex/react'
import { getDraft, ContentPatchError } from '@/lib/contentPatchClient'
import IssueWorkspaceLayout from '../app/(dashboard)/issues/[issueNumber]/layout'

// A fixture that gets a run resolved (runId: 'run-7') so the provider's
// getDraft effect actually fires; the rest mirrors WorkspaceLayout.test.tsx.
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

describe('WorkspaceOutline empty state on a contentless (no_sanity_issue) run', () => {
  it('resolves to the honest outline-empty state — never a perpetual outline-loading spinner', async () => {
    ;(getDraft as unknown as Mock).mockRejectedValue(
      new ContentPatchError(409, 'no_sanity_issue', 'run has no content'),
    )
    renderWorkspace()

    expect(await screen.findByTestId('outline-empty')).toBeDefined()
    expect(screen.queryByTestId('outline-loading')).toBeNull()
  })
})

describe('WorkspaceOutline transient-guard (WSP-07) — non-no_sanity_issue failures stay loading', () => {
  it('a DIFFERENT ContentPatchError reason still shows outline-loading, never outline-empty', async () => {
    ;(getDraft as unknown as Mock).mockRejectedValue(
      new ContentPatchError(500, 'server_error', 'boom'),
    )
    renderWorkspace()

    expect(await screen.findByTestId('outline-loading')).toBeDefined()
    expect(screen.queryByTestId('outline-empty')).toBeNull()
  })

  it('a generic network Error still shows outline-loading, never outline-empty', async () => {
    ;(getDraft as unknown as Mock).mockRejectedValue(new Error('network'))
    renderWorkspace()

    expect(await screen.findByTestId('outline-loading')).toBeDefined()
    expect(screen.queryByTestId('outline-empty')).toBeNull()
  })
})

describe('WorkspaceOutline happy path — a run WITH content renders the real rows', () => {
  it('renders the real outline row for a generated section, no loading/empty state', async () => {
    ;(getDraft as unknown as Mock).mockResolvedValue({
      sections: { originStory: { blocks: [{ type: 'paragraph', text: 'x' }], lossy: false } },
      bonus: null,
      game: null,
      podcast: null,
      conversation: null,
      theme: null,
    })
    renderWorkspace()

    expect(await screen.findByTestId('outline-row-originStory')).toBeDefined()
    expect(screen.queryByTestId('outline-loading')).toBeNull()
    expect(screen.queryByTestId('outline-empty')).toBeNull()
  })
})
