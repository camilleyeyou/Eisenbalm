/**
 * Quick 260721-pmn — bounded-settle regression proving the production-facing
 * `/issues/[n]/approval` infinite render loop (dead clicks / pegged main
 * thread) and guarding its fix.
 *
 * Root cause (diagnosed, not re-investigated here — see the quick-task PLAN's
 * <verified_diagnosis>): `ApprovalPanelPublisher` (ApprovalPanelContent.tsx)
 * builds a `content` memo over `[ws.signOffs, ws.claimRows, ws.tasks,
 * ws.held]` and publishes it via `useEffect(() => setPanelContent(content),
 * [content, setPanelContent])`. `WorkspaceStateProvider` currently returns a
 * FRESH `claimRows` (`claimRowsRaw?.map(...)`) and FRESH `tasks`/`stages`
 * (`deriveTasks`/`deriveStageStates` allocate new arrays) on EVERY render —
 * even when the underlying Convex query results are unchanged. Because
 * `setPanelContent` writes `panelContent` INTO the provider's own state, the
 * cycle is: setPanelContent -> provider re-renders -> fresh
 * claimRows/tasks/stages identities -> `content` memo recomputes -> effect
 * re-fires -> setPanelContent again -> forever (in production, a real
 * browser's Scheduler keeps rescheduling this indefinitely — no built-in
 * ceiling — which is what silently pins the main thread instead of crashing;
 * hence "dead clicks", not a visible error). `FactCheckPanelContent`'s
 * `[ws.claimRows]`-only effect has the identical latent loop and is fixed by
 * the same provider change (not separately regression-tested here — same
 * root cause, same fix site).
 *
 * A note on this test's specific harness: mounted the way this file mounts
 * it (see "WHY the INITIAL mount..." below), React's own nested-update-depth
 * safety net (`console.error`'s "Maximum update depth exceeded" — a real,
 * documented React heuristic for cascading effect-driven updates, distinct
 * from the render-phase-setState invariant that THROWS) caps the observed
 * cascade at roughly 50-60 renders before React gives up rescheduling
 * further work for this update cycle. That is what makes this loop
 * bound-and-assert-able at all within a test process: it does not run away
 * to OOM through this mounting path (see below), it plateaus in the
 * 50s — comfortably distinguishable from the low single digits the fixed
 * provider produces, and observed to be stable across repeated runs.
 *
 * WHY fixtures must be STABLE (not fresh `[]`/`{}` per call): this test
 * mounts the REAL provider over a mocked `convex/react` `useQuery`. Real
 * Convex `useQuery` returns a referentially STABLE value between renders
 * when the underlying subscribed data hasn't changed — that stability is
 * exactly what the fix relies on (memoizing the provider's DERIVED values
 * keyed on the STABLE raw inputs). A mock that returns a fresh array/object
 * on every call would never reproduce the real bug (the loop is driven by
 * the provider's own fresh `.map()`/`deriveTasks()` over otherwise-stable
 * inputs) and would never go green post-fix either (the memo's dependency
 * array would still see a "changed" input every render). Fixtures are
 * therefore defined as module-level consts and returned by reference.
 *
 * WHY the settle window is NOT `act()`-wrapped: an `act()`-wrapped await
 * flushes React's update queue to completion before resolving — on the
 * pre-fix infinite loop that queue never drains, so an `act()`-wrapped await
 * here would hang the test runner forever. Instead we render, wait a fixed
 * wall-clock window (loop or no loop, this always resolves), and THEN assert
 * on how many renders happened during that window. Mirrors
 * `WorkspaceDraftLoadLoop.test.tsx`'s identical rationale.
 *
 * WHY 300ms, not the sibling files' 50ms: empirically (this loop, this
 * mounting path), the cascade needs longer than 50ms to climb past the
 * ≤20 threshold — at 50ms both pre-fix and post-fix stay in the single
 * digits (the Scheduler-driven cascade hasn't ramped up yet), which would
 * make the RED gate a false negative. 300ms gives a stable, wide margin
 * (pre-fix ~50-60 renders, well past the plateau described above; post-fix
 * a handful) — confirmed stable across repeated runs, still comfortably
 * bounded (see the plateau note above — it does not grow further given more
 * time on this mounting path).
 *
 * WHY the INITIAL mount also bypasses `@testing-library/react`'s `render()`
 * (confirmed empirically, not merely theorized): `render()` wraps the initial
 * mount in React's `act()`, which synchronously drains the passive-effect
 * queue to completion before returning. `ApprovalPanelPublisher`'s
 * `setPanelContent` effect body is 100% synchronous (no `await` boundary) —
 * pre-fix, every flush produces a fresh `content` identity, which reschedules
 * the SAME effect, which `act()` keeps draining SYNCHRONOUSLY forever. This
 * is NOT bounded by the 50ms window below (the window is never reached — the
 * process never returns from `render()` in the first place) and is NOT
 * bounded by Vitest's own per-test timeout (that timeout is itself a JS timer
 * that can't fire while the main thread never yields). Confirmed: an earlier
 * version of this test using `@testing-library/react`'s `render()` crashed
 * the Vitest worker with `FATAL ERROR: ... JavaScript heap out of memory`
 * after several GB of growth — the sharpest possible proof of the production
 * "pegs the main thread" bug, but unusable as a repeatable CI regression
 * test. Mounting via `react-dom/client`'s `createRoot(...).render(...)`
 * directly (no `act()` wrapper at all) makes React schedule passive effects
 * through its normal (yielding) Scheduler instead — the same asynchronous
 * path a real browser uses — so the loop, if present, degrades into a
 * boundable "many renders per macrotask window" instead of a single
 * unbounded synchronous call. `screen` (bound to `document.body` by default)
 * still works for querying since the manually-created container is appended
 * to `document.body`.
 *
 * ASSERTION (loop-bound, not loop-exhausting):
 *   - Pre-fix: `setPanelContent` re-fires every render -> the provider
 *     re-renders in a cascading cycle -> `probeRenders` (a context-consuming
 *     sibling of `ApprovalPanelPublisher` inside the SAME provider — see the
 *     `RenderProbe` comment for why it MUST consume the context to count
 *     reliably) climbs into the 50s over the 300ms window (see the plateau
 *     note above) -> `expect(probeRenders).toBeLessThanOrEqual(20)` FAILS
 *     (proves the loop).
 *   - Post-fix: the provider's derived values are referentially stable
 *     across re-renders when the raw Convex results don't change, so
 *     `content` stops recomputing after the first legitimate publish, the
 *     effect stops re-firing, and only a handful of renders occur (initial
 *     mount + the one `setPanelContent` settle render + incidental async
 *     resolution renders) -> PASSES.
 *
 * Mirrors `WorkspaceContextPanelSlot.test.tsx` / `WorkspaceDraftLoadLoop
 * .test.tsx`'s mock scaffolding verbatim, with the divergences called out
 * inline below.
 */
import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest'
import { screen } from '@testing-library/react'
import { createRoot, type Root } from 'react-dom/client'

// ── next/navigation: fixed params + the Approval-stage pathname (DIVERGENCE
// from the sibling harnesses, which use '/issues/7/draft') ──────────────────
vi.mock('next/navigation', () => ({
  useParams: () => ({ issueNumber: '7' }),
  usePathname: () => '/issues/7/approval',
}))

// ── @clerk/nextjs: stable getToken (this test is not exercising the
// getToken-churn loop — that is WorkspaceDraftLoadLoop.test.tsx's concern) ──
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

// ── The authoritative-draft fetch the provider runs — resolves once to a
// stable, contentless-but-loaded draft so the provider's draft-load effect
// settles quickly and isn't itself a render-loop driver in this test. ───────
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
  return {
    ContentPatchError,
    getDraft: vi.fn().mockResolvedValue({
      sections: {},
      bonus: null,
      game: null,
      podcast: null,
      conversation: null,
      theme: null,
    }),
  }
})

// ── The Convex api reference object — extends the sibling harnesses' mock
// with `auditLog.listDecisions` + `users.byClerkUserId` (DIVERGENCE: the
// REAL `ApprovalPanelPublisher` mounts `DecisionLog`, which subscribes to
// both; without these namespaces the mock throws on property access). ──────
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
    // DecisionLog's two subscriptions (mounted by the REAL ApprovalPanelPublisher).
    auditLog: { listDecisions: 'auditLog:listDecisions' },
    users: { byClerkUserId: 'users:byClerkUserId' },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

import { useQuery, useMutation } from 'convex/react'
import IssueWorkspaceLayout from '../app/(dashboard)/issues/[issueNumber]/layout'
import ApprovalPanelPublisher from '../app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent'
import { useWorkspaceState } from '../app/(dashboard)/issues/_components/WorkspaceStateProvider'

// ── STABLE fixtures (module-level consts, returned BY REFERENCE — see the
// header comment's "WHY fixtures must be STABLE" section). A single non-empty
// claim row exercises the loop-prone `claimRows` derivation path. ───────────
const ISSUE_FIXTURE = { held: false, published: false, heldReason: undefined, heldBy: undefined, heldAt: undefined }
const RUN_FIXTURE = { runId: 'run-7', startedAt: 1700000000000 }
const HISTORY_FIXTURE: unknown[] = []
const SIGNOFFS_FIXTURE = {}
const CLAIM_ROWS_FIXTURE = [
  {
    _id: 'c1',
    status: 'pending',
    text: 'A claim',
    sourceUrl: undefined,
    sectionName: 'originStory',
    claimIndex: 0,
    claimId: 'c1',
    importance: 'Supporting',
    changedSinceCheck: false,
    conflict: false,
    checkedAt: undefined,
  },
]
const QA_FINDINGS_FIXTURE: unknown[] = []
const PITCH_ROWS_FIXTURE = [{ selected: true }]
const RUN_ROW_FIXTURE = { status: 'complete' }

function fixtureFor(ref: unknown): unknown {
  switch (ref) {
    case 'issues:byIssueNumber':
      return ISSUE_FIXTURE
    case 'pipelineRuns:byIssueNumber':
      return RUN_FIXTURE
    case 'pipelineRuns:listByIssueNumber':
      return HISTORY_FIXTURE
    case 'signOffs:activeByRunId':
      return SIGNOFFS_FIXTURE
    case 'claimChecks:listByRunId':
      return CLAIM_ROWS_FIXTURE
    case 'qaCorrections:byRunId':
      return QA_FINDINGS_FIXTURE
    case 'pitchLog:byRunId':
      return PITCH_ROWS_FIXTURE
    case 'runs:byRunId':
      return RUN_ROW_FIXTURE
    // auditLog:listDecisions / users:byClerkUserId / agentRuns:byRunId /
    // pipelineConfig:getAll / storyLeads / verificationRecords / briefs /
    // comments — unmapped, resolve to the harmless `undefined` default
    // (DecisionLog degrades to its own loading state; irrelevant here).
    default:
      return undefined
  }
}

let probeRenders = 0
/**
 * Mounted as a sibling of ApprovalPanelPublisher inside the SAME provider.
 * MUST call `useWorkspaceState()` itself (a context CONSUMER) — React's
 * context-change propagation only re-renders fibers that either consume the
 * changed context or have some other independent reason to update; a plain
 * sibling that does NOT call `useContext` is bailed out of re-rendering when
 * only the provider's context `value` changes (its element reference/props
 * are otherwise unchanged), so it would silently under-count the loop.
 * Consuming the context here makes this a reliable per-provider-render
 * counter, matching the loop mechanism described in the header comment.
 */
function RenderProbe() {
  useWorkspaceState()
  probeRenders++
  return null
}

let container: HTMLDivElement | null = null
let root: Root | null = null

beforeEach(() => {
  probeRenders = 0
  vi.clearAllMocks()
  ;(useQuery as unknown as Mock).mockImplementation((ref: unknown, args: unknown) => {
    if (args === 'skip') return undefined
    return fixtureFor(ref)
  })
  ;(useMutation as unknown as Mock).mockImplementation(() => vi.fn(async () => null))
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  // Manual teardown (NOT `@testing-library/react`'s `cleanup()`, which only
  // tracks containers it created itself via `render()` — see the header
  // comment's "WHY the INITIAL mount also bypasses render()" section).
  root?.unmount()
  root = null
  container?.remove()
  container = null
})

describe('Approval stage ContextPanel publisher render loop (quick 260721-pmn)', () => {
  it('settles after mount + one legitimate publish — does not self-sustain a setPanelContent render loop', async () => {
    // Mounted via `createRoot(...).render(...)` directly — NOT
    // `@testing-library/react`'s `render()` — see the header comment.
    root = createRoot(container as HTMLDivElement)
    root.render(
      <IssueWorkspaceLayout>
        <ApprovalPanelPublisher />
        <RenderProbe />
      </IssueWorkspaceLayout>,
    )

    // Sanity: the loop-prone path (real provider + real ApprovalPanelPublisher
    // publishing into the real ContextPanel slot) actually executed.
    await screen.findByText('Fact check')

    // Settle a BOUNDED window — deliberately NOT wrapped in act(): an
    // act()-wrapped await here would chase an infinite effect flush (pre-fix)
    // and hang the test runner. We assert after a fixed window; we never wait
    // for the loop to converge.
    await new Promise(resolve => setTimeout(resolve, 300))

    expect(probeRenders).toBeLessThanOrEqual(20)
  })
})
