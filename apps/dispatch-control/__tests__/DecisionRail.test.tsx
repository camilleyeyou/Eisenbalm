/**
 * Phase 33 (GLY-04, Plan 33-05 Task 1) — DecisionRail tests.
 *
 * The blockers-first decision rail (D-10..D-17):
 *   (a) Blocking-items checklist renders BEFORE the editor memo (D-17)
 *   (b) Publish is disabled with a visible reason while open error-severity
 *       findings exist, enabled at zero blockers (D-14 client half)
 *   (c) Verification block always renders an affirmative state — "checked Nm
 *       ago" when a checkedAt exists, "No claims extracted yet" when empty,
 *       "not yet checked" for legacy rows without checkedAt (D-13, never blank)
 *   (d) Editor memo reads JSON.parse(payload).notes (§33.6) and falls back
 *       gracefully on malformed payloads (D-16)
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    qaCorrections: { byRunId: 'qaCorrections:byRunId' },
    deliberationEvents: { byRunIdAndType: 'deliberationEvents:byRunIdAndType' },
    pitchLog: { selectedByRunId: 'pitchLog:selectedByRunId' },
    claimChecks: { listByRunId: 'claimChecks:listByRunId', setStatus: 'claimChecks:setStatus' },
    signOffs: { activeByRunId: 'signOffs:activeByRunId' },
  },
}))

vi.mock('@/lib/signOffClient', () => {
  class SignOffApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly reason: string,
      message: string,
    ) {
      super(message)
      this.name = 'SignOffApiError'
    }
  }
  return {
    SignOffApiError,
    recordSignOff: vi.fn(async () => ({
      runId: 'run-1',
      kind: 'facts-cleared',
      signedAt: Date.now(),
    })),
  }
})

vi.mock('@/lib/reviewClient', () => {
  class ReviewApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly reason: string,
      message: string,
    ) {
      super(message)
      this.name = 'ReviewApiError'
    }
  }
  return {
    ReviewApiError,
    publishIssue: vi.fn(async () => ({ issueId: 'issue-1', published: true })),
    rejectIssue: vi.fn(async () => ({ issueId: 'issue-1', rejected: true })),
  }
})

vi.mock('@/lib/pipelineControlClient', () => ({
  rerollAgent: vi.fn(async () => ({ runId: 'run-1', agentKey: 'origin_story', rerolled: true })),
}))

// Task 2's sub-component — mocked so Task 1's assertions run standalone.
vi.mock(
  '../app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList',
  () => ({
    default: () => <div data-testid="resolved-findings-list" />,
  }),
)

import { useQuery, useMutation } from 'convex/react'
import { publishIssue } from '@/lib/reviewClient'
import { recordSignOff } from '@/lib/signOffClient'
import DecisionRail from '../app/(dashboard)/review-desk/[runId]/_components/DecisionRail'

afterEach(() => {
  cleanup()
})

// The setStatus spy used by the source-index (Task 2) check/skip controls.
// Rebound in beforeEach so each test gets a clean spy.
let setStatusSpy: Mock

beforeEach(() => {
  vi.clearAllMocks()
  setStatusSpy = vi.fn(async () => undefined)
  ;(useMutation as unknown as Mock).mockImplementation((mutation: unknown) => {
    if (mutation === 'claimChecks:setStatus') return setStatusSpy
    return vi.fn()
  })
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

const errorFinding = {
  _id: 'f-err',
  findingId: 'f-err',
  sectionName: 'origin_story',
  severity: 'error' as const,
  reason: 'Overstated reach claim with no evidence.',
}

const warningFinding = {
  _id: 'f-warn',
  findingId: 'f-warn',
  sectionName: 'problem',
  severity: 'warning' as const,
  reason: 'Minor tonal nit.',
}

const resolvedError = {
  _id: 'f-res',
  findingId: 'f-res',
  sectionName: 'case_study',
  severity: 'error' as const,
  reason: 'Already handled.',
  resolution: 'dismissed' as const,
}

interface QueryState {
  findings?: unknown
  editorFinal?: unknown
  pitch?: unknown
  claims?: unknown
  signoffs?: unknown
}

function mockQueries(state: QueryState = {}) {
  ;(useQuery as unknown as Mock).mockImplementation((query: unknown) => {
    switch (query) {
      case 'qaCorrections:byRunId':
        return state.findings ?? []
      case 'deliberationEvents:byRunIdAndType':
        return state.editorFinal ?? []
      case 'pitchLog:selectedByRunId':
        return state.pitch ?? null
      case 'claimChecks:listByRunId':
        return state.claims ?? []
      case 'signOffs:activeByRunId':
        return state.signoffs !== undefined
          ? state.signoffs
          : {
              'facts-cleared': { actorId: 'andrew', signedAt: Date.now() },
              'sounds-human': { actorId: 'andrew', signedAt: Date.now() },
            }
      default:
        return undefined
    }
  })
}

// ── (a) Blockers-first ordering (D-17) ──────────────────────────────────────

describe('DecisionRail ordering (D-17)', () => {
  it('renders the Blocking-items checklist BEFORE the editor memo in the DOM', () => {
    mockQueries({
      findings: [errorFinding],
      editorFinal: [{ payload: JSON.stringify({ notes: 'Ship it — strong week.' }) }],
    })
    render(<DecisionRail runId="run-1" />)

    const blocking = screen.getByText(/blocking items/i)
    const memo = screen.getByText(/editor.s memo/i)
    // DOCUMENT_POSITION_FOLLOWING: memo comes after the blocking checklist.
    expect(
      blocking.compareDocumentPosition(memo) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('leads with a blocker/warning count summary line', () => {
    mockQueries({ findings: [errorFinding, warningFinding] })
    render(<DecisionRail runId="run-1" />)
    expect(screen.getAllByText(/1 blocker to clear/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/1 warning/i)).toBeDefined()
  })

  it('only counts OPEN findings — resolved errors are not blockers', () => {
    mockQueries({ findings: [resolvedError, warningFinding] })
    render(<DecisionRail runId="run-1" />)
    const publish = screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement
    expect(publish.disabled).toBe(false)
  })
})

// ── (b) Publish gate (D-14 client) ──────────────────────────────────────────

describe('DecisionRail publish gate (D-14)', () => {
  it('disables Publish with a visible reason when an open error finding exists', () => {
    mockQueries({ findings: [errorFinding] })
    render(<DecisionRail runId="run-1" />)

    const publish = screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement
    expect(publish.disabled).toBe(true)
    // Reason text is visible near the button (also in the headline).
    expect(screen.getAllByText(/1 blocker to clear/i).length).toBeGreaterThan(0)
  })

  it('enables Publish when zero blockers remain and calls publishIssue(token, runId)', async () => {
    mockQueries({ findings: [warningFinding] })
    render(<DecisionRail runId="run-1" />)

    const publish = screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement
    expect(publish.disabled).toBe(false)

    fireEvent.click(publish)
    await waitFor(() => {
      expect(publishIssue).toHaveBeenCalledWith('tok-clerk', 'run-1')
    })
  })

  it('surfaces the server 409 open_error_findings message (belt-and-suspenders)', async () => {
    mockQueries({ findings: [] })
    const { ReviewApiError } = await import('@/lib/reviewClient')
    ;(publishIssue as unknown as Mock).mockRejectedValueOnce(
      new ReviewApiError(409, 'open_error_findings', 'Resolve all error findings first.'),
    )
    render(<DecisionRail runId="run-1" />)

    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))
    await waitFor(() => {
      expect(screen.getByText('Resolve all error findings first.')).toBeDefined()
    })
  })
})

// ── (c) Verification block never-blank states (D-13) ────────────────────────

describe('DecisionRail verification block (D-13)', () => {
  it('shows "checked Nm ago" when a checkedAt timestamp exists', () => {
    mockQueries({
      claims: [
        { claimIndex: 0, status: 'checked', checkedAt: Date.now() - 5 * 60_000 },
        { claimIndex: 1, status: 'pending' },
      ],
    })
    render(<DecisionRail runId="run-1" />)
    expect(screen.getByText(/1\/2 claims checked/i)).toBeDefined()
    expect(screen.getByText(/checked \d+m ago/i)).toBeDefined()
  })

  it('shows "No claims extracted yet" when the claims list is empty — never blank', () => {
    mockQueries({ claims: [] })
    render(<DecisionRail runId="run-1" />)
    expect(screen.getByText(/no claims extracted yet/i)).toBeDefined()
  })

  it('shows "not yet checked" for legacy rows without checkedAt — never blank', () => {
    mockQueries({
      claims: [{ claimIndex: 0, status: 'checked' }],
    })
    render(<DecisionRail runId="run-1" />)
    expect(screen.getByText(/not yet checked/i)).toBeDefined()
  })

  it('shows "Loading…" while claims are undefined', () => {
    mockQueries({ claims: undefined })
    ;(useQuery as unknown as Mock).mockImplementation((query: unknown) => {
      if (query === 'claimChecks:listByRunId') return undefined
      if (query === 'pitchLog:selectedByRunId') return null
      return []
    })
    render(<DecisionRail runId="run-1" />)
    expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0)
  })
})

// ── (d) Editor memo (D-16, §33.6) ────────────────────────────────────────────

describe('DecisionRail editor memo (D-16 §33.6)', () => {
  it('reads JSON.parse(payload).notes from the editor-final event', () => {
    mockQueries({
      editorFinal: [{ payload: JSON.stringify({ notes: 'Ship it — strong week.' }) }],
    })
    render(<DecisionRail runId="run-1" />)
    expect(screen.getByText('Ship it — strong week.')).toBeDefined()
  })

  it('falls back gracefully when the payload is malformed JSON', () => {
    mockQueries({ editorFinal: [{ payload: 'not-json{{' }] })
    render(<DecisionRail runId="run-1" />)
    expect(screen.getByText(/no editor memo for this run/i)).toBeDefined()
  })

  it('falls back when there is no editor-final event at all', () => {
    mockQueries({ editorFinal: [] })
    render(<DecisionRail runId="run-1" />)
    expect(screen.getByText(/no editor memo for this run/i)).toBeDefined()
  })
})

// ── Hook card (D-12) + rail foot ─────────────────────────────────────────────

describe('DecisionRail hook card (D-12) and rail foot (D-04)', () => {
  it('renders the selected pitch charityName + scoutSummary', () => {
    mockQueries({
      pitch: {
        charityName: 'The Quiet Foundation',
        scoutSummary: 'A tiny archive preserving rural oral histories.',
      },
    })
    render(<DecisionRail runId="run-1" />)
    expect(screen.getByText('The Quiet Foundation')).toBeDefined()
    expect(screen.getByText('A tiny archive preserving rural oral histories.')).toBeDefined()
  })

  it('renders an honest "No charity selected yet" when no pitch is selected', () => {
    mockQueries({ pitch: null })
    render(<DecisionRail runId="run-1" />)
    expect(screen.getByText(/no charity selected yet/i)).toBeDefined()
  })

  it('mounts the ResolvedFindingsList at the rail foot', () => {
    mockQueries()
    render(<DecisionRail runId="run-1" />)
    expect(screen.getByTestId('resolved-findings-list')).toBeDefined()
  })
})

// ── Sign-offs (Phase 34, D-01/D-05/D-06) ────────────────────────────────────

describe('DecisionRail sign-offs (Phase 34, D-01/D-05/D-06)', () => {
  it('renders both sign-off controls when neither is active', () => {
    mockQueries({ signoffs: {} })
    render(<DecisionRail runId="run-1" />)
    expect(screen.getByRole('button', { name: /sign: facts cleared/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /sign: sounds human/i })).toBeDefined()
  })

  it('records a facts-cleared sign-off via recordSignOff(token, runId, kind) on click', async () => {
    mockQueries({ signoffs: {}, findings: [] })
    render(<DecisionRail runId="run-1" />)
    fireEvent.click(screen.getByRole('button', { name: /sign: facts cleared/i }))
    await waitFor(() => {
      expect(recordSignOff).toHaveBeenCalledWith('tok-clerk', 'run-1', 'facts-cleared')
    })
  })

  it('shows the affirmative "signed Nm ago" state for an active sign-off — never blank', () => {
    mockQueries({
      signoffs: {
        'facts-cleared': { actorId: 'andrew', signedAt: Date.now() - 2 * 60_000 },
      },
    })
    render(<DecisionRail runId="run-1" />)
    expect(screen.getByText(/facts cleared — signed \d+m ago/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /sign: sounds human/i })).toBeDefined()
  })

  it('gates Publish until BOTH sign-offs are green even with zero blockers', () => {
    mockQueries({
      findings: [],
      signoffs: { 'facts-cleared': { actorId: 'andrew', signedAt: Date.now() } },
    })
    render(<DecisionRail runId="run-1" />)
    const publish = screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement
    expect(publish.disabled).toBe(true)
    expect(screen.getByText(/both sign-offs required to publish/i)).toBeDefined()
  })

  it('disables the Facts-cleared control while an open error blocker exists (D-01)', () => {
    mockQueries({ findings: [errorFinding], signoffs: {} })
    render(<DecisionRail runId="run-1" />)
    const facts = screen.getByRole('button', {
      name: /sign: facts cleared/i,
    }) as HTMLButtonElement
    expect(facts.disabled).toBe(true)
    expect(
      (screen.getByRole('button', { name: /sign: sounds human/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
  })
})

// ── Source index (Phase 35, PRV-04, D-12/D-13/D-14) ─────────────────────────
//
// The Verification block's plain checklist is upgraded to a source index:
// unsourced claims (no claimId) pin on top, sourced claims (claimId present)
// group below by galley section in reading order, each row carries a
// check/skip control (the same claimChecks:setStatus) and a jump link.
// Legacy rows (no claimId, no sectionName) render honestly as unsourced with
// no jump target and never crash (D-03 additive-optional degrade).

const sourcedCaseStudy = {
  claimIndex: 0,
  text: 'The organization fed 12,000 families in 2019.',
  status: 'pending',
  claimId: 'run1-001',
  sourceUrl: 'https://example.org/report-a',
  retrievedAt: Date.now(),
  sectionName: 'caseStudy',
}

const sourcedOriginStory = {
  claimIndex: 1,
  text: 'Founded by two teachers in a garage in 2004.',
  status: 'checked',
  checkedAt: Date.now(),
  claimId: 'run1-002',
  sourceUrl: 'https://example.org/report-b',
  retrievedAt: Date.now(),
  sectionName: 'originStory',
}

const unsourcedProblem = {
  claimIndex: 2,
  text: 'Roughly 1 in 5 local children go hungry.',
  status: 'pending',
  sectionName: 'problemStatement',
}

const legacyRow = {
  claimIndex: 3,
  text: 'Founded in 1998.',
  status: 'pending',
}

describe('DecisionRail source index (Phase 35, PRV-04)', () => {
  it('renders the unsourced group ABOVE the sourced group', () => {
    mockQueries({ claims: [sourcedCaseStudy, sourcedOriginStory, unsourcedProblem] })
    render(<DecisionRail runId="run-1" />)

    const unsourcedHeader = screen.getByText(/^unsourced$/i)
    const sourcedRowText = screen.getByText(sourcedCaseStudy.text)
    // DOCUMENT_POSITION_FOLLOWING: the sourced group comes after Unsourced.
    expect(
      unsourcedHeader.compareDocumentPosition(sourcedRowText) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('groups sourced rows by section in galley reading order and shows each sourceUrl', () => {
    // Deliberately out of reading order in the fixture array (caseStudy before
    // originStory) to prove the component re-sorts, not just echoes input order.
    mockQueries({ claims: [sourcedCaseStudy, sourcedOriginStory] })
    render(<DecisionRail runId="run-1" />)

    const originText = screen.getByText(sourcedOriginStory.text)
    const caseStudyText = screen.getByText(sourcedCaseStudy.text)
    // originStory precedes caseStudy in D-14's fixed galley order.
    expect(
      originText.compareDocumentPosition(caseStudyText) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    const sourceLinks = screen.getAllByRole('link', { name: /open source/i })
    const hrefs = sourceLinks.map(a => a.getAttribute('href'))
    expect(hrefs).toContain(sourcedCaseStudy.sourceUrl)
    expect(hrefs).toContain(sourcedOriginStory.sourceUrl)
  })

  it('exposes a check control per row that calls claimChecks.setStatus with the claimIndex', async () => {
    mockQueries({ claims: [unsourcedProblem] })
    render(<DecisionRail runId="run-1" />)

    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`check claim ${unsourcedProblem.claimIndex}`, 'i') }),
    )
    await waitFor(() => {
      expect(setStatusSpy).toHaveBeenCalledWith({
        runId: 'run-1',
        claimIndex: unsourcedProblem.claimIndex,
        status: 'checked',
      })
    })
  })

  it('exposes a skip control per row that calls claimChecks.setStatus with the claimIndex', async () => {
    mockQueries({ claims: [sourcedOriginStory] })
    render(<DecisionRail runId="run-1" />)

    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`skip claim ${sourcedOriginStory.claimIndex}`, 'i') }),
    )
    await waitFor(() => {
      expect(setStatusSpy).toHaveBeenCalledWith({
        runId: 'run-1',
        claimIndex: sourcedOriginStory.claimIndex,
        status: 'skipped',
      })
    })
  })

  it('renders a legacy row (no claimId, no sectionName) as unsourced with no jump link, and does not crash', () => {
    mockQueries({ claims: [sourcedCaseStudy, legacyRow] })
    expect(() => render(<DecisionRail runId="run-1" />)).not.toThrow()

    // The legacy row's text still renders (never hidden).
    expect(screen.getByText(legacyRow.text)).toBeDefined()
    // It has a check/skip control like any other row.
    expect(
      screen.getByRole('button', { name: new RegExp(`check claim ${legacyRow.claimIndex}`, 'i') }),
    ).toBeDefined()
    // But it carries no jump-to-section link (no sectionName to jump to).
    expect(
      screen.queryByRole('button', { name: new RegExp(`jump.*claim ${legacyRow.claimIndex}`, 'i') }),
    ).toBeNull()
  })
})
