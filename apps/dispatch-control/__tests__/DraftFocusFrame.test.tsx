/**
 * quick 260730-i4j (Task 3) — the conditional Draft-stage frame.
 *
 * On the Draft stage ONLY, `IssueWorkspaceLayout` drops the left 232px
 * `WorkspaceOutline` rail and the right 320px `ContextPanel` — the story
 * canvas (`{children}`) renders full width, with `StageHintStrip` still
 * above it. Every OTHER stage keeps the 3-column frame verbatim.
 *
 * Mirrors WorkspaceLayout.test.tsx's mock scaffolding verbatim (next/
 * navigation, @clerk/nextjs, OnboardingProvider, @/lib/contentPatchClient,
 * convex/react) so the REAL provider + REAL layout render end-to-end. The
 * only divergence: `usePathname` is a `let` the two describe blocks reset,
 * so the SAME mock module can render the frame at two different stage
 * pathnames across tests.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

let currentPathname = '/issues/7/draft'

vi.mock('next/navigation', () => ({
  useParams: () => ({ issueNumber: '7' }),
  usePathname: () => currentPathname,
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@/components/onboarding/OnboardingProvider', () => ({
  useOnboarding: () => ({ onboarding: null }),
}))

// A draft WITH content — originStory has a non-empty block — so the outline
// (on stages that still render it) shows a real `outline-row-originStory`,
// not `outline-loading`/`outline-empty`.
vi.mock('@/lib/contentPatchClient', () => {
  class ContentPatchError extends Error {}
  return {
    ContentPatchError,
    getDraft: vi.fn(async () => ({
      sections: { originStory: { blocks: [{ type: 'paragraph', text: 'x' }], lossy: false } },
      bonus: null,
      game: null,
      podcast: null,
      conversation: null,
      theme: null,
    })),
  }
})

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
    userOnboarding: { dismissStageHint: 'userOnboarding:dismissStageHint' },
  },
}))

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

import { useQuery, useMutation } from 'convex/react'
import IssueWorkspaceLayout from '../app/(dashboard)/issues/[issueNumber]/layout'

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
    case 'comments:listByIssueNumber':
      return []
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

async function renderAt(pathname: string) {
  currentPathname = pathname
  const result = render(
    <IssueWorkspaceLayout>
      <div>stage canvas</div>
    </IssueWorkspaceLayout>,
  )
  // Let the provider's async getDraft effect settle before assertions.
  await screen.findByTestId('workspace-tab-story')
  return result
}

describe('IssueWorkspaceLayout — Draft stage (quick 260730-i4j) drops both frame rails', () => {
  it('renders no outline node (outline-row-*/outline-loading/outline-empty) and no ContextPanel node', async () => {
    await renderAt('/issues/7/draft')

    expect(screen.queryByTestId('outline-row-originStory')).toBeNull()
    expect(screen.queryByTestId('outline-loading')).toBeNull()
    expect(screen.queryByTestId('outline-empty')).toBeNull()
    expect(screen.queryByText('Hide panel')).toBeNull()
    expect(screen.queryByText(/nothing to show for this stage yet/i)).toBeNull()
  })

  it('still renders the stage-tab nav, StageHintStrip, Comments, and Workspace controls on Draft', async () => {
    await renderAt('/issues/7/draft')

    expect(screen.getByTestId('workspace-tab-draft')).toBeDefined()
    expect(screen.getByTestId('stage-hint-strip')).toBeDefined()
    expect(screen.getByText('Comments')).toBeDefined()
    expect(screen.getByText('Run history')).toBeDefined()
    expect(screen.getByText('stage canvas')).toBeDefined()
  })
})

describe('IssueWorkspaceLayout — every other stage keeps the 3-column frame (Fact Check as witness)', () => {
  it('renders both the outline AND the ContextPanel on Fact Check, unchanged', async () => {
    await renderAt('/issues/7/fact-check')

    expect(await screen.findByTestId('outline-row-originStory')).toBeDefined()
    expect(screen.getByText('Hide panel')).toBeDefined()
  })
})
