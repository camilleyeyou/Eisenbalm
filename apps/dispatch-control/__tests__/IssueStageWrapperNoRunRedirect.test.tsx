/**
 * Debug session issue-workspace-blink-loop (2026-07-22) — regression test.
 *
 * Root cause: the bare `/issues/[n]` index page (D-03) redirects INTO
 * `issue.lastVisitedStage` whenever it is one of the 5 known stage segments,
 * without checking whether a run currently exists. Each of the four
 * run-dependent stage wrappers (draft/fact-check/voice/approval `page.tsx`)
 * used to redirect straight back to that SAME bare index (`issueHref(n)`)
 * whenever no run exists for the issue. An issue whose `lastVisitedStage` is
 * one of those four stages while it currently has ZERO runs (confirmed live
 * for issue 999660: `lastVisitedStage: "draft"`, 0 pipelineRuns rows) bounced
 * between `/issues/{n}` and `/issues/{n}/{stage}` forever — a genuine
 * server-side infinite redirect loop, observed by users as the entire
 * Workspace frame "blinking" indefinitely (every hop is a full page reload).
 *
 * Fix: the four wrappers now redirect to Story (`issueStoryHref`) instead —
 * Story is the one stage explicitly designed to handle "no run yet"
 * gracefully (renders `StoryBriefScreen`'s Empty/CreatePanel state) with NO
 * further redirect, terminating the chain.
 *
 * This test proves, for each of the four wrappers: given a resolved
 * `pipelineRuns.byIssueNumber` result of `null` (the exact "no run" state),
 * the wrapper redirects to Story — and CRITICALLY never to the bare index
 * (`issueHref`), which is the one target that could re-enter the loop via a
 * stage-segment `lastVisitedStage`.
 */
import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest'

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirectMock(url),
}))

const queryMock = vi.fn(async () => null) // "no run" — the exact loop-triggering state

vi.mock('convex/browser', () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({
    query: (...args: unknown[]) => queryMock(...args),
  })),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    pipelineRuns: { byIssueNumber: 'pipelineRuns:byIssueNumber' },
  },
}))

// The four wrappers mount real screen/panel components — none of that code
// runs on the no-run path (redirect() throws before the JSX return), but the
// imports must still resolve, so stub every screen/panel import as a no-op.
vi.mock('../app/(dashboard)/review-desk/[runId]/ReviewDeskRunView', () => ({
  default: () => null,
}))
vi.mock('../app/(dashboard)/issues/[issueNumber]/draft/DraftPanelContent', () => ({
  default: () => null,
}))
vi.mock('../app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen', () => ({
  default: () => null,
}))
vi.mock('../app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPanelContent', () => ({
  default: () => null,
}))
vi.mock('../app/(dashboard)/voice-pass/[runId]/VoicePassRunView', () => ({
  VoicePassScreen: () => null,
}))
vi.mock('../app/(dashboard)/issues/[issueNumber]/voice/VoicePanelContent', () => ({
  default: () => null,
}))
vi.mock('../app/(dashboard)/issues/[issueNumber]/approval/ApprovalStage', () => ({
  default: () => null,
}))
vi.mock('../app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent', () => ({
  default: () => null,
}))

import IssueDraftPage from '../app/(dashboard)/issues/[issueNumber]/draft/page'
import IssueFactCheckPage from '../app/(dashboard)/issues/[issueNumber]/fact-check/page'
import IssueVoicePage from '../app/(dashboard)/issues/[issueNumber]/voice/page'
import IssueApprovalPage from '../app/(dashboard)/issues/[issueNumber]/approval/page'

const ISSUE_NUMBER = 999660

beforeEach(() => {
  vi.clearAllMocks()
  queryMock.mockResolvedValue(null) // no run — the loop-triggering fixture
  redirectMock.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  })
  process.env.NEXT_PUBLIC_CONVEX_URL = 'https://example.convex.cloud'
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_CONVEX_URL
})

async function expectRedirectsToStory(pageFn: (props: { params: Promise<{ issueNumber: string }> }) => Promise<unknown>) {
  await expect(
    pageFn({ params: Promise.resolve({ issueNumber: String(ISSUE_NUMBER) }) }),
  ).rejects.toThrow(`REDIRECT:/issues/${ISSUE_NUMBER}/story`)

  // The critical regression guard: must NEVER redirect to the bare index —
  // that is the one target the index page can bounce right back from via
  // `lastVisitedStage`, re-entering the loop.
  expect(redirectMock).not.toHaveBeenCalledWith(`/issues/${ISSUE_NUMBER}`)
  expect(redirectMock).toHaveBeenCalledTimes(1)
}

describe('Issue stage wrappers — no-run redirect terminates instead of looping (issue-workspace-blink-loop)', () => {
  it('draft/page.tsx redirects to Story, not the bare index', async () => {
    await expectRedirectsToStory(IssueDraftPage as never)
  })

  it('fact-check/page.tsx redirects to Story, not the bare index', async () => {
    await expectRedirectsToStory(IssueFactCheckPage as never)
  })

  it('voice/page.tsx redirects to Story, not the bare index', async () => {
    await expectRedirectsToStory(IssueVoicePage as never)
  })

  it('approval/page.tsx redirects to Story, not the bare index', async () => {
    await expectRedirectsToStory(IssueApprovalPage as never)
  })
})
