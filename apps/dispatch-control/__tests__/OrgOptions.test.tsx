/**
 * Phase 47 (BRF-03) — OrgOptions (org-option-card / slate) behavior tests.
 *
 * `OrgOptionSlate` joins `pitchLog` + `deliberationEvents` advocate-argument
 * rows (via the imported `CandidateSlate.joinCandidates`, not a
 * reimplementation) with `verificationRecords:byRunId` (from
 * `useWorkspaceState()`, Plan 47-05's centralized subscription) and
 * `charities:listByWorkspace` (a new subscription, for the prior-coverage
 * warning) on the shared `charityId`/`candidateId` key. Each option renders
 * mechanism, verification record WITH DATES, agent case, confidence,
 * prior-coverage warning, and its main concern ALWAYS VISIBLE — mirrors
 * `CandidateSlate.tsx`'s never-truncated `primaryConcern` discipline
 * verbatim (`__tests__/CandidateSlate.test.tsx`).
 *
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    deliberationEvents: { byRunIdAndType: 'deliberationEvents:byRunIdAndType' },
    charities: { listByWorkspace: 'charities:listByWorkspace' },
  },
}))

let wsMock: {
  runId: string | null
  pitchRows: unknown[] | undefined
  verificationRecords: unknown[] | undefined
  storyLeads: unknown[] | undefined
}

vi.mock('@/app/(dashboard)/issues/_components/WorkspaceStateProvider', () => ({
  useWorkspaceState: () => wsMock,
}))

import { useQuery } from 'convex/react'
import { OrgOptionSlate, selectActiveLead } from '../app/(dashboard)/story-brief/_components/OrgOptionSlate'
import type { StoryLead } from '../app/(dashboard)/story-brief/_components/LeadCard'

/**
 * Reusable never-truncated tripwire — copied verbatim from
 * `CandidateSlate.test.tsx`'s inline assertion pair.
 */
function assertNeverTruncated(el: { textContent: string | null; className: string }, longText: string) {
  expect(el.textContent).toBe(longText)
  expect(el.className).not.toMatch(/line-clamp|truncate/)
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

const pitchRows = [QUIET_HARVEST_PITCH, RIVERBEND_PITCH]

const QUIET_HARVEST_PRIMARY_CONCERN =
  'The org has not filed an annual report in two years, which could raise transparency questions if a reader digs into public filings before publication.'

const advocateRows = [
  {
    charityId: 'charity-quiet-harvest',
    payload: JSON.stringify({
      charityName: 'Quiet Harvest Food Bank',
      score: 8,
      argument: 'This org has decade-long, unglamorous, verifiable local impact.',
      primaryConcern: QUIET_HARVEST_PRIMARY_CONCERN,
    }),
  },
]

const verificationRecords = [
  {
    candidateId: 'charity-quiet-harvest',
    candidateName: 'Quiet Harvest Food Bank',
    domainLive: true,
    registrationId: 'EIN-123',
    registrationVerified: true,
    pressHits: 2,
    obscurityVerdict: 'obscure',
    status: 'pass',
    killed: false,
    checkedAt: 1_700_000_000_000,
  },
]

function fixtureFor(query: unknown) {
  if (query === 'deliberationEvents:byRunIdAndType') return advocateRows
  if (query === 'charities:listByWorkspace') return []
  return undefined
}

beforeEach(() => {
  wsMock = {
    runId: 'run-1',
    pitchRows,
    verificationRecords,
    storyLeads: [],
  }
  ;(useQuery as unknown as Mock).mockImplementation(fixtureFor)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('OrgOptions (BRF-03)', () => {
  it('joins verificationRecords:byRunId + pitchLog + registry on the shared charityId/candidateId', () => {
    render(<OrgOptionSlate />)
    expect(screen.getByTestId('org-option-Quiet Harvest Food Bank')).toBeDefined()
    expect(screen.getByTestId('org-option-Riverbend Literacy Project')).toBeDefined()
    // The matched verification record (by charityId) surfaces for the org that has one.
    expect(screen.getByTestId('org-verification-Quiet Harvest Food Bank')).toBeDefined()
  })

  it('renders the mechanism, the verification record WITH DATES (checkedAt), and the agent case + confidence', () => {
    render(<OrgOptionSlate />)
    expect(screen.getByTestId('org-mechanism-Quiet Harvest Food Bank').textContent).toBe(
      QUIET_HARVEST_PITCH.scoutSummary,
    )
    expect(screen.getByTestId('org-verification-date-Quiet Harvest Food Bank').textContent).toContain(
      'Checked',
    )
    expect(screen.getByTestId('org-verification-date-Quiet Harvest Food Bank').textContent).toContain(
      '2023',
    )
    expect(screen.getByTestId('org-confidence-Quiet Harvest Food Bank').textContent).toContain('8/10')
    expect(screen.getByTestId('org-agent-case-Quiet Harvest Food Bank').textContent).toBe(
      'This org has decade-long, unglamorous, verifiable local impact.',
    )
  })

  it('renders a prior-coverage warning when the charity registry reports one', () => {
    ;(useQuery as unknown as Mock).mockImplementation((query: unknown) => {
      if (query === 'deliberationEvents:byRunIdAndType') return advocateRows
      if (query === 'charities:listByWorkspace') {
        return [{ name: 'Quiet Harvest Food Bank', status: 'featured' }]
      }
      return undefined
    })
    render(<OrgOptionSlate />)
    expect(screen.getByTestId('org-prior-coverage-Quiet Harvest Food Bank')).toBeDefined()
    // The org with no prior-coverage match renders no warning.
    expect(screen.queryByTestId('org-prior-coverage-Riverbend Literacy Project')).toBeNull()
  })

  it('renders the main concern IN FULL for every option — className must not match /line-clamp|truncate/ (assertNeverTruncated)', () => {
    render(<OrgOptionSlate />)
    const el = screen.getByTestId('main-concern-Quiet Harvest Food Bank')
    assertNeverTruncated(el, QUIET_HARVEST_PRIMARY_CONCERN)
  })

  it('gracefully degrades an org option with no matching verification record (no crash)', () => {
    render(<OrgOptionSlate />)
    // Riverbend has no advocate row and no verification record — still renders.
    expect(screen.getByTestId('org-option-Riverbend Literacy Project')).toBeDefined()
    expect(screen.getByTestId('org-verification-missing-Riverbend Literacy Project')).toBeDefined()
    expect(screen.getByTestId('main-concern-Riverbend Literacy Project').textContent).toBe('—')
  })

  it('groups options under the single active lead heading (one-active-lead-per-run)', () => {
    wsMock.storyLeads = [
      { _id: 'lead-1', premise: 'A quiet food bank feeds a third of the county.', recommended: true },
      { _id: 'lead-2', premise: 'A literacy project doubles GED pass rates.', recommended: false },
    ]
    render(<OrgOptionSlate />)
    expect(screen.getByTestId('org-options-active-lead').textContent).toContain(
      'A quiet food bank feeds a third of the county.',
    )
  })

  it('selectActiveLead prefers a Required lead over the recommended one', () => {
    const leads: StoryLead[] = [
      {
        _id: 'lead-1',
        premise: 'Recommended lead',
        datedPeg: '',
        pegSourceUrl: '',
        readerEnergy: '',
        charitableAngle: '',
        category: '',
        confidence: '',
        brandRiskFlag: false,
        recommended: true,
      },
      {
        _id: 'lead-2',
        premise: 'Required lead',
        datedPeg: '',
        pegSourceUrl: '',
        readerEnergy: '',
        charitableAngle: '',
        category: '',
        confidence: '',
        brandRiskFlag: false,
        recommended: false,
        status: 'required',
      },
    ]
    expect(selectActiveLead(leads)?.premise).toBe('Required lead')
  })

  it('shows loading state while pitchRows/advocateRows have not resolved', () => {
    wsMock.pitchRows = undefined
    render(<OrgOptionSlate />)
    expect(screen.getByText('Loading…')).toBeDefined()
  })

  it('quick 260719-w6o (F2): a killed candidate renders AS killed with its killReason — never "—" as Main concern', () => {
    wsMock.verificationRecords = [
      {
        candidateId: 'charity-quiet-harvest',
        candidateName: 'Quiet Harvest Food Bank',
        domainLive: false,
        registrationId: undefined,
        registrationVerified: false,
        pressHits: 0,
        obscurityVerdict: 'obscure',
        status: 'fail',
        killed: true,
        killReason: 'domain parked; no registration',
        checkedAt: 1_700_000_000_000,
      },
    ]
    render(<OrgOptionSlate />)
    expect(document.body.textContent).toContain('domain parked; no registration')
    expect(screen.getByTestId('main-concern-Quiet Harvest Food Bank').textContent).not.toBe('—')
  })
})
