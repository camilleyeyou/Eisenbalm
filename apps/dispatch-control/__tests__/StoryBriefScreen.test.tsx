/**
 * Phase 47 Plan 47-08 (BRF-01..06, D-01/D-14/D-15) — StoryBriefScreen
 * composition + empty/loading/error state tests.
 *
 * `StoryBriefScreen` composes the six Stage-1 components (LeadCard,
 * LeadActions, OrgOptionSlate, NeedsYourDecisionCard, BriefFieldTable,
 * BriefFieldStrengthen) in the design order and renders the Annotations
 * §Stage 1 empty/loading/error states. `deriveStoryStage`'s tightened
 * 'needs-you' gate is covered separately in `derivedState.test.ts`.
 *
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const refreshMock = vi.fn()
const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    pipelineRuns: { byRunId: 'pipelineRuns:byRunId' },
    deliberationEvents: { byRunIdAndType: 'deliberationEvents:byRunIdAndType' },
    charities: { listByWorkspace: 'charities:listByWorkspace' },
    auditLog: { listDecisions: 'auditLog:listDecisions' },
    users: { byClerkUserId: 'users:byClerkUserId' },
    issues: { ensureByNumber: 'issues:ensureByNumber' },
  },
}))

const triggerRunMock = vi.fn(async () => ({ runId: 'run-2' }))

vi.mock('@/lib/pipelineControlClient', () => ({
  triggerRun: (...args: unknown[]) => triggerRunMock(...args),
  requireLead: vi.fn(async () => ({ leadId: 'lead-1', status: 'required' })),
  removeLead: vi.fn(async () => ({ leadId: 'lead-1', status: 'removed' })),
  adjudicateGate1: vi.fn(async () => ({ runId: 'run-1', resumed: true })),
}))

vi.mock('@/lib/briefClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/briefClient')>('@/lib/briefClient')
  return {
    ...actual,
    patchBrief: vi.fn(async () => ({ resolution: 'brief_field_edited' })),
    strengthenBriefFieldPreview: vi.fn(async () => ({
      proposedText: 'A sharper premise.',
      whatChanged: 'Tightened the opening line.',
    })),
    strengthenBriefFieldApply: vi.fn(async () => ({ resolution: 'brief_field_strengthened' })),
  }
})

interface WsMock {
  runId: string | null
  storyLeads: unknown[] | undefined
  verificationRecords: unknown[] | undefined
  pitchRows: unknown[] | undefined
  brief: Record<string, string> | null | undefined
  // Phase 48 (ENT-01/ENT-04, §48.4) — undefined mirrors "not yet loaded";
  // absent/'discovery' is the Convex-side default (§48.4). Only tests that
  // explicitly set this to 'brief' exercise the brief-mode Stage-1 render
  // path (see the skip-guarded describe block below).
  entryMode?: 'discovery' | 'brief'
}

let wsMock: WsMock

vi.mock('@/app/(dashboard)/issues/_components/WorkspaceStateProvider', () => ({
  useWorkspaceState: () => wsMock,
}))

let runFixture: { status: string; completedAt?: number; errorMessage?: string } | null | undefined
let advocateRowsFixture: unknown[] | undefined

function fixtureFor(query: unknown) {
  if (query === 'pipelineRuns:byRunId') return runFixture
  if (query === 'deliberationEvents:byRunIdAndType') return advocateRowsFixture
  if (query === 'charities:listByWorkspace') return []
  if (query === 'auditLog:listDecisions') return []
  if (query === 'users:byClerkUserId') return undefined
  return undefined
}

import { useQuery } from 'convex/react'
import { StoryBriefScreen } from '../app/(dashboard)/story-brief/_components/StoryBriefScreen'

// Phase 48 Wave 0 (ENT-01/ENT-04) — source-scan skip-guard for the brief-mode
// Stage 1 describe block below. Mirrors CreatePanel.test.tsx's
// SECOND_CARD_SHIPPED idiom: read StoryBriefScreen.tsx's own source text and
// only run the brief-mode assertions once the component actually branches on
// `entryMode` (Plan 48-06). Until then the block is SKIPPED, not failing.
const STORY_BRIEF_SCREEN_SRC = fs.readFileSync(
  path.resolve(__dirname, '../app/(dashboard)/story-brief/_components/StoryBriefScreen.tsx'),
  'utf-8',
)
const ENTRY_MODE_WIRED = /entryMode/.test(STORY_BRIEF_SCREEN_SRC)

const QUIET_HARVEST_LEAD = {
  _id: 'lead-1',
  premise: 'A quiet food bank has quietly fed a third of the county for a decade.',
  datedPeg: 'Their annual harvest drive starts next Tuesday.',
  pegSourceUrl: 'https://example.com/harvest-drive-announcement',
  readerEnergy: 'Quiet resolve',
  charitableAngle: 'Hunger relief, hyper-local',
  category: 'Food security',
  confidence: 'High',
  brandRiskFlag: false,
  recommended: true,
}

const QUIET_HARVEST_PITCH = {
  _id: 'pitch-1',
  charityId: 'charity-quiet-harvest',
  charityName: 'Quiet Harvest Food Bank',
  charityLocation: 'Modesto, CA',
  scoutSummary: 'Runs a weekly mobile pantry that reaches migrant farmworker camps directly.',
  selected: false,
}

const RIVERBEND_PITCH = {
  _id: 'pitch-2',
  charityId: 'charity-riverbend-literacy',
  charityName: 'Riverbend Literacy Project',
  charityLocation: 'Riverbend, OH',
  scoutSummary: 'Tutors adult learners one-on-one for GED prep.',
  selected: false,
}

const ADVOCATE_ROWS = [
  {
    charityId: 'charity-quiet-harvest',
    payload: JSON.stringify({
      charityName: 'Quiet Harvest Food Bank',
      score: 8,
      argument: 'Decade-long, unglamorous, verifiable local impact.',
      primaryConcern: 'No annual report filed in two years.',
    }),
  },
  {
    charityId: 'charity-riverbend-literacy',
    payload: JSON.stringify({
      charityName: 'Riverbend Literacy Project',
      score: 6,
      argument: 'Strong tutor retention.',
      primaryConcern: 'Small sample size of outcomes so far.',
    }),
  },
]

const BRIEF_FIXTURE = {
  premise: 'A quiet food bank quietly feeds a third of the county.',
  currentPeg: 'Their annual harvest drive starts next Tuesday.',
  centralClaim: 'Unglamorous, decade-long, verifiable local impact.',
  readerEffect: 'Quiet resolve, not spectacle.',
  knownRisks: 'No annual report filed in two years.',
  voiceIntention: 'Dry, precise, no irony.',
}

beforeEach(() => {
  wsMock = {
    runId: null,
    storyLeads: undefined,
    verificationRecords: undefined,
    pitchRows: undefined,
    brief: undefined,
    entryMode: undefined,
  }
  runFixture = undefined
  advocateRowsFixture = undefined
  ;(useQuery as unknown as Mock).mockImplementation(fixtureFor)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StoryBriefScreen — states (D-14)', () => {
  it('Empty: no run yet for this issue renders the CreatePanel Create path', () => {
    render(<StoryBriefScreen issueNumber={12} runId={null} />)
    expect(screen.getByRole('button', { name: /find a story with agents/i })).toBeDefined()
    expect(screen.queryByTestId('story-leads-list')).toBeNull()
  })

  it('Loading: discovery in progress with no leads yet shows "Finding leads… (~40s)"', () => {
    wsMock.runId = 'run-1'
    wsMock.storyLeads = []
    runFixture = { status: 'running' }

    render(<StoryBriefScreen issueNumber={12} runId="run-1" />)

    expect(screen.getByTestId('story-brief-loading').textContent).toMatch(/finding leads/i)
  })

  it('Error: a failed run shows the plain-language errorMessage, Restart discovery, and a Run Details link', () => {
    wsMock.runId = 'run-1'
    wsMock.storyLeads = []
    runFixture = { status: 'failed', errorMessage: 'Scout could not reach the search API.' }

    render(<StoryBriefScreen issueNumber={12} runId="run-1" />)

    const errorPanel = screen.getByTestId('story-brief-error')
    expect(errorPanel.textContent).toContain('Scout could not reach the search API.')
    expect(screen.getByRole('button', { name: /restart discovery/i })).toBeDefined()
    const runDetailsLink = screen.getByRole('link', { name: /run details/i })
    expect(runDetailsLink.getAttribute('href')).toBe('/issues/12/runs/run-1')
  })

  it('Restart discovery triggers a new run for this issue and refreshes the route', async () => {
    wsMock.runId = 'run-1'
    wsMock.storyLeads = []
    runFixture = { status: 'failed', errorMessage: 'Discovery timed out.' }

    render(<StoryBriefScreen issueNumber={12} runId="run-1" />)

    fireEvent.click(screen.getByRole('button', { name: /restart discovery/i }))

    await waitFor(() => {
      expect(triggerRunMock).toHaveBeenCalledWith({ issueNumber: 12 }, 'tok-clerk')
    })
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled()
    })
  })
})

describe('StoryBriefScreen — composition (BRF-01..06)', () => {
  beforeEach(() => {
    wsMock.runId = 'run-1'
    wsMock.storyLeads = [QUIET_HARVEST_LEAD]
    wsMock.pitchRows = [QUIET_HARVEST_PITCH, RIVERBEND_PITCH]
    wsMock.verificationRecords = []
    advocateRowsFixture = ADVOCATE_ROWS
  })

  it('composes leads (LeadCard + LeadActions) and organization options for a resolved run', () => {
    runFixture = { status: 'complete' }
    wsMock.brief = null

    render(<StoryBriefScreen issueNumber={12} runId="run-1" />)

    expect(screen.getByTestId('lead-card-lead-1')).toBeDefined()
    expect(screen.getByRole('region', { name: 'Lead actions' })).toBeDefined()
    expect(screen.getByRole('region', { name: 'Organization options' })).toBeDefined()
    // Not paused at Gate 1 — no Needs-your-decision card.
    expect(screen.queryByRole('region', { name: 'Needs your decision' })).toBeNull()
    // Brief not yet generated — the honest not-yet-generated message, no
    // per-field strengthen blocks.
    expect(screen.queryByTestId('brief-field-table')).toBeNull()
    expect(screen.queryByTestId('brief-field-strengthen-premise')).toBeNull()
  })

  it('renders the editable Brief table + per-field strengthen once the Brief exists (BRF-05/BRF-06)', () => {
    runFixture = { status: 'complete' }
    wsMock.brief = BRIEF_FIXTURE

    render(<StoryBriefScreen issueNumber={12} runId="run-1" />)

    expect(screen.getByTestId('brief-field-table')).toBeDefined()
    expect((screen.getByTestId('brief-field-input-premise') as HTMLTextAreaElement).value).toBe(
      BRIEF_FIXTURE.premise,
    )
    expect(screen.getByTestId('brief-field-strengthen-premise')).toBeDefined()
    expect(screen.getByTestId('brief-field-strengthen-voiceIntention')).toBeDefined()
  })

  it('renders the Needs-your-decision card ONLY when the run is genuinely paused at Gate 1 (BRF-04)', () => {
    runFixture = { status: 'awaiting-review', completedAt: undefined }
    wsMock.brief = null

    render(<StoryBriefScreen issueNumber={12} runId="run-1" />)

    const card = screen.getByRole('region', { name: 'Needs your decision' })
    expect(card).toBeDefined()
    expect(card.textContent).not.toMatch(/requiresHumanInput/i)
  })

  it('does NOT render Needs-your-decision when awaiting-review carries a completedAt (the finished-run flow, §37.4(c))', () => {
    runFixture = { status: 'awaiting-review', completedAt: 1_700_000_000_000 }
    wsMock.brief = null

    render(<StoryBriefScreen issueNumber={12} runId="run-1" />)

    expect(screen.queryByRole('region', { name: 'Needs your decision' })).toBeNull()
  })
})

// ── Brief-mode Stage 1 (Phase 48, ENT-01/ENT-04, D-11 — Wave 4) ────────────
//
// 48-RESEARCH.md Pattern 4: StoryBriefScreen/OrgOptionSlate are wired
// entirely off story_leads (Signal Editor) + pitchLog (Scout) — both
// PERMANENTLY EMPTY for a brief-started run. Without an entryMode-aware
// branch, a brief-started issue's Stage 1 would show "No leads yet." and
// "No organization options yet", silently hiding the human org and its
// verification record even though both exist in Convex. This block is
// skip-guarded (ENTRY_MODE_WIRED) until Plan 48-06 adds that branch.
describe.skipIf(!ENTRY_MODE_WIRED)(
  'StoryBriefScreen — brief-mode Stage 1 (ENT-01/ENT-04, D-11, Phase 48 — Wave 4)',
  () => {
    const HUMAN_ORG_RECORD = {
      candidateId: 'charity-quiet-harvest-food-bank',
      candidateName: 'Quiet Harvest Food Bank',
      domainLive: true,
      registrationId: 'https://charitynavigator.example/org/quiet-harvest',
      registrationVerified: true,
      pressHits: 1,
      obscurityVerdict: 'obscure',
      status: 'pass' as const,
      killed: false,
      checkedAt: 1_700_000_000_000,
    }

    beforeEach(() => {
      wsMock.entryMode = 'brief'
      wsMock.runId = 'r1'
      wsMock.storyLeads = []
      wsMock.pitchRows = []
      wsMock.verificationRecords = [HUMAN_ORG_RECORD]
      wsMock.brief = BRIEF_FIXTURE
      runFixture = { status: 'complete' }
    })

    it('does not render the discovery-mode "No leads yet." message for a brief-started run', () => {
      render(<StoryBriefScreen issueNumber={12} runId="r1" />)
      expect(screen.queryByText(/no leads yet/i)).toBeNull()
    })

    it('does not render OrgOptionSlate\'s "No organization options yet" empty state', () => {
      render(<StoryBriefScreen issueNumber={12} runId="r1" />)
      expect(screen.queryByText(/no organization options yet/i)).toBeNull()
    })

    it("renders the human org's name and its verification-with-dates line (D-11 — surfaced prominently, never absent)", () => {
      render(<StoryBriefScreen issueNumber={12} runId="r1" />)
      expect(screen.getByText('Quiet Harvest Food Bank')).toBeDefined()
      const verificationText = screen.getByText(/checked/i).textContent ?? ''
      expect(verificationText).toMatch(/domain live/i)
      expect(verificationText).toMatch(/registration verified/i)
    })
  },
)
