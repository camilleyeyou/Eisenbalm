/**
 * Phase 47 (BRF-04) — NeedsYourDecision behavior tests.
 *
 * The stage enters "Needs your decision" when agents can't confidently
 * choose — the human-facing label is LITERALLY "Needs your decision", NEVER
 * `requiresHumanInput` (that flag is internal only — CONTEXT D-07, state
 * model §105-110). The top two options render side by side (what each makes
 * possible, evidence quality, risk, burden). "Choose this story" requires a
 * rationale and resumes the run via the EXISTING, UNCHANGED write path:
 * `adjudicateGate1(runId, { selection: { charityName }, reason }, token)`.
 *
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@/lib/pipelineControlClient', () => ({
  adjudicateGate1: vi.fn(async () => ({
    runId: 'run-1',
    resumed: true,
    charityName: 'Quiet Harvest Food Bank',
  })),
}))

import { adjudicateGate1 } from '@/lib/pipelineControlClient'
import { NeedsYourDecisionCard } from '../app/(dashboard)/story-brief/_components/NeedsYourDecisionCard'

const QUIET_HARVEST_PITCH = {
  _id: 'pitch-1',
  charityId: 'charity-quiet-harvest',
  charityName: 'Quiet Harvest Food Bank',
  charityLocation: 'Modesto, CA',
  scoutSummary: 'A weekly mobile pantry reaching migrant farmworker camps directly.',
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

const THIRD_PLACE_PITCH = {
  _id: 'pitch-3',
  charityId: 'charity-thirdplace',
  charityName: 'Third Place Commons',
  charityLocation: 'Elgin, IL',
  scoutSummary: 'Runs a free community living room downtown.',
  selected: false,
}

const pitchRows = [QUIET_HARVEST_PITCH, RIVERBEND_PITCH, THIRD_PLACE_PITCH]

const advocateRows = [
  {
    charityId: 'charity-quiet-harvest',
    payload: JSON.stringify({
      charityName: 'Quiet Harvest Food Bank',
      score: 9,
      argument: 'Decade-long unglamorous local impact, easy to verify.',
      primaryConcern: 'No annual report filed in two years.',
    }),
  },
  {
    charityId: 'charity-riverbend-literacy',
    payload: JSON.stringify({
      charityName: 'Riverbend Literacy Project',
      score: 8,
      argument: 'Strong outcome data on GED pass rates.',
      primaryConcern: 'Small, could look thin without more sourcing.',
    }),
  },
  {
    charityId: 'charity-thirdplace',
    payload: JSON.stringify({
      charityName: 'Third Place Commons',
      score: 4,
      argument: 'Interesting but under-documented.',
      primaryConcern: 'Very little verifiable public information.',
    }),
  },
]

const verificationRecords = [
  {
    candidateId: 'charity-quiet-harvest',
    candidateName: 'Quiet Harvest Food Bank',
    domainLive: true,
    registrationVerified: true,
    pressHits: 2,
    obscurityVerdict: 'obscure',
    checkedAt: 1_700_000_000_000,
  },
  {
    candidateId: 'charity-riverbend-literacy',
    candidateName: 'Riverbend Literacy Project',
    domainLive: true,
    registrationVerified: false,
    pressHits: 1,
    obscurityVerdict: 'obscure',
    checkedAt: 1_700_000_100_000,
  },
]

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderCard() {
  return render(
    <NeedsYourDecisionCard
      runId="run-1"
      pitchRows={pitchRows}
      advocateRows={advocateRows}
      verificationRecords={verificationRecords}
    />,
  )
}

function pickQuietHarvest() {
  fireEvent.click(screen.getByRole('radio', { name: /Quiet Harvest Food Bank/i }))
}

function enterRationale() {
  fireEvent.change(screen.getByLabelText(/rationale/i), {
    target: { value: 'Stronger local sourcing and a live verified domain.' },
  })
}

describe('NeedsYourDecision (BRF-04)', () => {
  it('renders the label "Needs your decision" — never the internal requiresHumanInput flag', () => {
    renderCard()
    expect(screen.getByText('Needs your decision')).toBeDefined()
    expect(screen.queryByText(/requiresHumanInput/)).toBeNull()
    expect(document.body.textContent).not.toMatch(/requiresHumanInput/)
  })

  it('renders the top two options (by advocateScore) side by side: what each makes possible, evidence quality, risk, burden', () => {
    renderCard()
    // Top two by score: Quiet Harvest (9) and Riverbend (8) — Third Place (4) excluded.
    expect(screen.getByTestId('decision-option-Quiet Harvest Food Bank')).toBeDefined()
    expect(screen.getByTestId('decision-option-Riverbend Literacy Project')).toBeDefined()
    expect(screen.queryByTestId('decision-option-Third Place Commons')).toBeNull()

    expect(screen.getByTestId('decision-possible-Quiet Harvest Food Bank').textContent).toBe(
      QUIET_HARVEST_PITCH.scoutSummary,
    )
    expect(screen.getByTestId('decision-evidence-Quiet Harvest Food Bank').textContent).toContain(
      'Domain live',
    )
    expect(screen.getByTestId('decision-risk-Quiet Harvest Food Bank').textContent).toBe(
      'No annual report filed in two years.',
    )
    expect(screen.getByTestId('decision-burden-Quiet Harvest Food Bank').textContent).toBe(
      'No outstanding verification burden.',
    )
    expect(screen.getByTestId('decision-burden-Riverbend Literacy Project').textContent).toContain(
      'verify registration',
    )
  })

  it('the "Choose this story" action is disabled until a rationale is entered', () => {
    renderCard()
    const chooseButton = screen.getByRole('button', { name: /choose this story/i })
    expect(chooseButton.hasAttribute('disabled')).toBe(true)

    pickQuietHarvest()
    expect(chooseButton.hasAttribute('disabled')).toBe(true)

    enterRationale()
    expect(chooseButton.hasAttribute('disabled')).toBe(false)
  })

  it('submitting a choice calls adjudicateGate1(runId, { selection: { charityName }, reason }, token) — the unchanged Phase-37 resume bridge', async () => {
    renderCard()

    pickQuietHarvest()
    enterRationale()
    fireEvent.click(screen.getByRole('button', { name: /choose this story/i }))

    await waitFor(() => {
      expect(adjudicateGate1).toHaveBeenCalledWith(
        'run-1',
        {
          selection: { charityName: 'Quiet Harvest Food Bank' },
          reason: 'Stronger local sourcing and a live verified domain.',
        },
        'tok-clerk',
      )
    })
  })

  it("a successful choice surfaces a resumed confirmation (the header chip flip is Masthead's own independent run-status subscription, not this component's concern)", async () => {
    renderCard()

    pickQuietHarvest()
    enterRationale()
    fireEvent.click(screen.getByRole('button', { name: /choose this story/i }))

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('Resumed the run')
    })
  })
})
