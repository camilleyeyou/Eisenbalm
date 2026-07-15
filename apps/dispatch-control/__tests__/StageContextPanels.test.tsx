/**
 * Phase 41 Plan 41-12 (WSP-03 gap closure) — per-stage ContextPanel content
 * regression tests.
 *
 * Each stage publisher exposes a pure `buildXxxPanelContent(...)` function
 * (populated / honest-empty / loading) — these are the substantive
 * regression proof (per the plan's test-mechanics note). A "publishers reach
 * the slot" plumbing block (added in Task 3) additionally proves each
 * publisher calls `setPanelContent` on mount with a mocked
 * `useWorkspaceState`.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 *
 * Phase 44 (INS-01, Plan 44-08 Task 3): `StoryPanelPublisher` now calls
 * `useInspector()` (for the winner card's "Inspect how this was made"
 * affordance), so its plumbing-block render below is wrapped in
 * `<InspectorProvider>` — mirroring 44-07's FactCheckScreen/VoicePassScreen
 * wrapping convention. `buildStoryPanelContent`'s own tests are unaffected
 * (its new `onInspect` param is optional).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { Doc } from '@convex/_generated/dataModel'
import { InspectorProvider } from '../components/inspector/InspectorProvider'
import StoryPanelPublisher, {
  buildStoryPanelContent,
} from '../app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent'
import DraftPanelPublisher, {
  buildDraftPanelContent,
} from '../app/(dashboard)/issues/[issueNumber]/draft/DraftPanelContent'
import FactCheckPanelPublisher, {
  buildFactCheckPanelContent,
} from '../app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPanelContent'
import VoicePanelPublisher, {
  buildVoicePanelContent,
} from '../app/(dashboard)/issues/[issueNumber]/voice/VoicePanelContent'
import ApprovalPanelPublisher, {
  buildApprovalPanelContent,
} from '../app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent'
import type { WorkspaceStateValue } from '../app/(dashboard)/issues/_components/WorkspaceStateProvider'

// ── Plumbing-block mock (Task 3): a mutable fixture the mocked
// useWorkspaceState reads, so each of the 5 REAL publisher components can be
// rendered standalone (no real WorkspaceStateProvider/Convex/Clerk needed)
// and proven to call setPanelContent on mount. vi.hoisted keeps the same
// reference available inside the (hoisted) vi.mock factory below.
const stateRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))

vi.mock('../app/(dashboard)/issues/_components/WorkspaceStateProvider', () => ({
  useWorkspaceState: () => stateRef.current,
}))

afterEach(() => {
  cleanup()
})

describe('Stage 1 Story panel', () => {
  it('renders the selected charity lead detail when populated', () => {
    const pitchRows = [
      {
        _id: 'pl1',
        _creationTime: 0,
        runId: 'run-1',
        charityName: 'Acme Foundation',
        charityLocation: 'Duluth, MN',
        focusArea: 'Youth literacy',
        scoutSummary: 'Overlooked but well-run local literacy nonprofit.',
        selected: true,
        timestamp: Date.now(),
      },
      {
        _id: 'pl2',
        _creationTime: 0,
        runId: 'run-1',
        charityName: 'Beacon Trust',
        charityLocation: 'Reno, NV',
        scoutSummary: 'Runner-up candidate.',
        selected: false,
        timestamp: Date.now(),
      },
    ] as unknown as Doc<'pitchLog'>[]

    render(<>{buildStoryPanelContent(pitchRows)}</>)

    expect(screen.getByText('Acme Foundation')).toBeDefined()
    expect(screen.queryByText(/nothing to show for this stage yet/i)).toBeNull()
  })

  it('renders an honest empty state when no candidates exist', () => {
    render(<>{buildStoryPanelContent([])}</>)
    expect(screen.getByText(/no charity selected yet/i)).toBeDefined()
  })

  it('renders a loading state while pitchRows has not loaded', () => {
    render(<>{buildStoryPanelContent(undefined)}</>)
    expect(screen.getByText(/loading/i)).toBeDefined()
  })
})

describe('Stage 2 Draft panel', () => {
  it('renders open QA items when populated', () => {
    const qaFindings: WorkspaceStateValue['qaFindings'] = [
      {
        _id: 'qa1',
        severity: 'warning',
        axis: 'precision',
        sectionName: 'originStory',
        reason: 'Unsupported statistic about program reach.',
        accepted: undefined,
        resolution: null,
      },
    ]

    render(<>{buildDraftPanelContent(qaFindings)}</>)

    expect(screen.getByText(/unsupported statistic about program reach/i)).toBeDefined()
    expect(screen.queryByText(/nothing to show for this stage yet/i)).toBeNull()
  })

  it('renders an honest empty state when there are no open findings', () => {
    render(<>{buildDraftPanelContent([])}</>)
    expect(screen.getByText(/no open qa items/i)).toBeDefined()
  })

  it('renders a loading state while qaFindings has not loaded', () => {
    render(<>{buildDraftPanelContent(undefined)}</>)
    expect(screen.getByText(/loading/i)).toBeDefined()
  })
})

describe('Stage 3 Fact Check panel', () => {
  it('renders claim detail when populated', () => {
    const claimRows: WorkspaceStateValue['claimRows'] = [
      {
        _id: 'cc1',
        status: 'checked',
        sourceUrl: 'https://example.org/source',
        sectionName: 'originStory',
        claimText: 'Founded in 1998 with three volunteers.',
      },
      {
        _id: 'cc2',
        status: 'pending',
        sectionName: 'problemStatement',
        claimText: 'Serves over 400 families annually.',
      },
    ]

    render(<>{buildFactCheckPanelContent(claimRows)}</>)

    expect(screen.getByText(/founded in 1998 with three volunteers/i)).toBeDefined()
    expect(screen.queryByText(/nothing to show for this stage yet/i)).toBeNull()
  })

  it('renders an honest empty state when there are no claims', () => {
    render(<>{buildFactCheckPanelContent([])}</>)
    expect(screen.getByText(/no claims extracted yet/i)).toBeDefined()
  })

  it('renders a loading state while claimRows has not loaded', () => {
    render(<>{buildFactCheckPanelContent(undefined)}</>)
    expect(screen.getByText(/loading/i)).toBeDefined()
  })
})

describe('Stage 4 Voice panel', () => {
  it('renders open voice findings when populated', () => {
    const qaFindings: WorkspaceStateValue['qaFindings'] = [
      {
        _id: 'qa2',
        severity: 'warning',
        axis: 'machine-tell',
        sectionName: 'founderBio',
        reason: 'Reads like a press release, not Jesse.',
        accepted: undefined,
        resolution: null,
      },
      {
        _id: 'qa3',
        severity: 'warning',
        axis: 'precision',
        sectionName: 'caseStudy',
        reason: 'A factual axis finding — must not show on the Voice panel.',
        accepted: undefined,
        resolution: null,
      },
    ]

    render(<>{buildVoicePanelContent(qaFindings)}</>)

    expect(screen.getByText(/reads like a press release, not jesse/i)).toBeDefined()
    expect(screen.queryByText(/must not show on the voice panel/i)).toBeNull()
    expect(screen.queryByText(/nothing to show for this stage yet/i)).toBeNull()
  })

  it('renders an honest empty state when there are no voice tells', () => {
    render(<>{buildVoicePanelContent([])}</>)
    expect(screen.getByText(/no voice tells flagged/i)).toBeDefined()
  })

  it('renders a loading state while qaFindings has not loaded', () => {
    render(<>{buildVoicePanelContent(undefined)}</>)
    expect(screen.getByText(/loading/i)).toBeDefined()
  })
})

describe('Stage 5 Approval panel', () => {
  it('renders readiness detail when populated', () => {
    const content = buildApprovalPanelContent({
      signOffs: { 'facts-cleared': { actorId: 'op-1', signedAt: Date.now() } },
      claimRows: [
        { _id: 'cc1', status: 'checked' },
        { _id: 'cc2', status: 'pending' },
      ],
      tasks: [
        {
          id: 't1',
          sev: 'must-fix',
          title: 'Unsupported statistic',
          where: 'originStory',
          why: 'needs a source',
          primary: { label: 'Fix', href: '#' },
          stage: 2,
        },
        {
          id: 't2',
          sev: 'must-fix',
          title: 'Unsourced claim',
          where: 'caseStudy',
          why: 'needs a source',
          primary: { label: 'Fix', href: '#' },
          stage: 3,
        },
      ],
      held: false,
    })

    render(<>{content}</>)

    expect(screen.getByText('signed')).toBeDefined()
    expect(screen.getByText('2 must-fix')).toBeDefined()
    expect(screen.queryByText(/nothing to show for this stage yet/i)).toBeNull()
  })

  it('renders a loading state while signOffs has not loaded', () => {
    render(
      <>
        {buildApprovalPanelContent({
          signOffs: undefined,
          claimRows: undefined,
          tasks: [],
          held: false,
        })}
      </>,
    )
    expect(screen.getByText(/loading readiness/i)).toBeDefined()
  })

  it('never-blank: renders explicit readiness lines when nothing is signed, claimed, or blocking', () => {
    render(
      <>
        {buildApprovalPanelContent({ signOffs: {}, claimRows: [], tasks: [], held: false })}
      </>,
    )
    expect(screen.getByText('not signed')).toBeDefined()
    expect(screen.getByText('no claims yet')).toBeDefined()
    expect(screen.getByText('none')).toBeDefined()
    expect(screen.queryByText(/nothing to show for this stage yet/i)).toBeNull()
  })
})

describe('Stage panel publishers reach the ContextPanel slot', () => {
  it('Story publisher calls setPanelContent on mount with a defined node', () => {
    const setPanelContent = vi.fn()
    stateRef.current = {
      pitchRows: [
        {
          _id: 'pl1',
          charityName: 'Acme Foundation',
          charityLocation: 'Duluth, MN',
          scoutSummary: 'Overlooked but well-run.',
          selected: true,
        },
      ],
      setPanelContent,
    }

    render(
      <InspectorProvider>
        <StoryPanelPublisher />
      </InspectorProvider>,
    )

    expect(setPanelContent).toHaveBeenCalled()
    expect(setPanelContent.mock.calls[0][0]).toBeDefined()
  })

  it('Draft publisher calls setPanelContent on mount with a defined node', () => {
    const setPanelContent = vi.fn()
    stateRef.current = { qaFindings: [], setPanelContent }

    render(<DraftPanelPublisher />)

    expect(setPanelContent).toHaveBeenCalled()
    expect(setPanelContent.mock.calls[0][0]).toBeDefined()
  })

  it('Fact Check publisher calls setPanelContent on mount with a defined node', () => {
    const setPanelContent = vi.fn()
    stateRef.current = { claimRows: [], setPanelContent }

    render(<FactCheckPanelPublisher />)

    expect(setPanelContent).toHaveBeenCalled()
    expect(setPanelContent.mock.calls[0][0]).toBeDefined()
  })

  it('Voice publisher calls setPanelContent on mount with a defined node', () => {
    const setPanelContent = vi.fn()
    stateRef.current = { qaFindings: [], setPanelContent }

    render(<VoicePanelPublisher />)

    expect(setPanelContent).toHaveBeenCalled()
    expect(setPanelContent.mock.calls[0][0]).toBeDefined()
  })

  it('Approval publisher calls setPanelContent on mount with a defined node', () => {
    const setPanelContent = vi.fn()
    stateRef.current = {
      signOffs: {},
      claimRows: [],
      tasks: [],
      held: false,
      setPanelContent,
    }

    render(<ApprovalPanelPublisher />)

    expect(setPanelContent).toHaveBeenCalled()
    expect(setPanelContent.mock.calls[0][0]).toBeDefined()
  })
})
