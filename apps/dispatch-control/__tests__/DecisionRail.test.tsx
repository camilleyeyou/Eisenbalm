/**
 * Phase 33 (GLY-04, Plan 33-05 Task 1) — DecisionRail tests.
 * Phase 41 (WSP-05/WSP-06, Plan 41-09) — Stage 5 readiness board, the
 * "Agent editor's recommendation" relabel, the held-aware publish gate, and
 * the PublishPreviewDialog one-click flow.
 *
 * The blockers-first decision rail (D-10..D-17, extended by WSP-05/WSP-06):
 *   (a) Blocking-items checklist renders BEFORE the readiness board, which
 *       renders BEFORE "Agent editor's recommendation" (D-17, WSP-05)
 *   (b) Publish is disabled with a visible reason while open error-severity
 *       findings exist, missing sign-offs exist, or the issue is held,
 *       enabled otherwise (D-14/D-15 client half); the unlock condition is
 *       written next to the control (WSP-06)
 *   (c) Verification block always renders an affirmative state — "checked Nm
 *       ago" when a checkedAt exists, "No claims extracted yet" when empty,
 *       "not yet checked" for legacy rows without checkedAt (D-13, never blank)
 *   (d) "Agent editor's recommendation" reads JSON.parse(payload).notes
 *       (§33.6) and falls back gracefully on malformed payloads (D-16) —
 *       relabeled from "Editor's memo" (SC-4: "editor" unqualified stays the
 *       human)
 *   (e) Publish opens PublishPreviewDialog (does not publish yet); its single
 *       confirm calls the SAME unchanged publishIssue(token, runId) — no
 *       typed confirmation anywhere (WSP-06)
 *
 * Phase 44 (INS-01, Plan 44-08 Task 2): the rail now calls `useInspector()`
 * (the "Agent editor's recommendation" Inspect affordance), so every render
 * below goes through `renderRail`, which wraps `<DecisionRail>` in
 * `<InspectorProvider>` — mirroring `InspectorProvider.test.tsx`'s own
 * wrapping convention (also used by 44-07's FactCheckScreen.test.tsx /
 * VoicePassScreen.test.tsx). `activeKey` stays `null` throughout (no test
 * clicks Inspect), so no new Convex reads or panel renders are exercised.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest'
import type { ReactElement } from 'react'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { InspectorProvider } from '@/components/inspector/InspectorProvider'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

// Phase 49 (ROL-03, Plan 49-07): DecisionRail now resolves useRole() to
// decide whether Publish is rendered locked. This suite exercises the
// pre-existing (pre-Phase-49) editor behavior, so it stubs the role hook
// directly to 'Editor-in-chief' rather than reaching through Clerk's
// useUser() (which this file's '@clerk/nextjs' mock above doesn't
// provide). The dedicated Collaborator-locked contract is covered by
// DecisionRail.roleGate.test.tsx.
vi.mock('@/lib/role', () => ({ useRole: () => 'Editor-in-chief' }))

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
import { FACTUAL_AXES } from '@/lib/galley/axisPartition'

afterEach(() => {
  cleanup()
})

// Phase 44 Plan 44-08 — every render call site below wraps <DecisionRail>
// in <InspectorProvider> (useInspector() throws outside one). activeKey
// stays null in every test (no test clicks Inspect).
function renderRail(ui: ReactElement) {
  return render(<InspectorProvider>{ui}</InspectorProvider>)
}

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

describe('DecisionRail ordering (D-17, WSP-05)', () => {
  it('renders blockers -> readiness board -> "Agent editor\'s recommendation" in DOM order', () => {
    mockQueries({
      findings: [errorFinding],
      editorFinal: [{ payload: JSON.stringify({ notes: 'Ship it — strong week.' }) }],
    })
    renderRail(<DecisionRail runId="run-1" />)

    const blocking = screen.getByText(/blocking items/i)
    const readiness = screen.getByText(/readiness board/i)
    const recommendation = screen.getByText(/agent editor.s recommendation/i)
    // DOCUMENT_POSITION_FOLLOWING: each element comes after the previous one.
    expect(
      blocking.compareDocumentPosition(readiness) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      readiness.compareDocumentPosition(recommendation) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('never labels the agent recommendation block as just "Editor" (SC-4 — human reservation)', () => {
    mockQueries({ findings: [errorFinding] })
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.queryByText(/^editor.s memo$/i)).toBeNull()
    expect(
      screen.getByRole('heading', { name: /agent editor.s recommendation/i }),
    ).toBeDefined()
  })

  it('leads with a blocker/warning count summary line', () => {
    mockQueries({ findings: [errorFinding, warningFinding] })
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.getAllByText(/1 blocker to clear/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/1 warning/i)).toBeDefined()
  })

  it('only counts OPEN findings — resolved errors are not blockers', () => {
    mockQueries({ findings: [resolvedError, warningFinding] })
    renderRail(<DecisionRail runId="run-1" />)
    const publish = screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement
    expect(publish.disabled).toBe(false)
  })
})

// ── (b) Publish gate (D-14/D-15 client, WSP-06 preview flow) ────────────────

describe('DecisionRail publish gate (D-14/D-15)', () => {
  it('disables Publish with a visible reason when an open error finding exists', () => {
    mockQueries({ findings: [errorFinding] })
    renderRail(<DecisionRail runId="run-1" />)

    const publish = screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement
    expect(publish.disabled).toBe(true)
    // Reason text is visible near the button (also in the headline).
    expect(screen.getAllByText(/1 blocker to clear/i).length).toBeGreaterThan(0)
    // WSP-06: the unlock condition is written next to the control.
    expect(screen.getByText(/unlocks when/i)).toBeDefined()
    expect(screen.getByText(/must fix = 0/i)).toBeDefined()
    expect(screen.getByText(/fact check complete/i)).toBeDefined()
    expect(screen.getByText(/voice approved current/i)).toBeDefined()
  })

  it('is additionally disabled when the issue is held, with "Not held" named in the unlock text (D-15)', () => {
    mockQueries({ findings: [] })
    renderRail(<DecisionRail runId="run-1" held={true} />)

    const publish = screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement
    expect(publish.disabled).toBe(true)
    expect(screen.getByText(/release the hold to publish/i)).toBeDefined()
    expect(screen.getByText(/not held/i)).toBeDefined()
  })

  it('enables Publish when zero blockers/sign-offs/held remain, and opens the preview WITHOUT publishing yet', () => {
    mockQueries({ findings: [warningFinding] })
    renderRail(<DecisionRail runId="run-1" />)

    const publish = screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement
    expect(publish.disabled).toBe(false)
    // No unlock text once every gate condition is satisfied.
    expect(screen.queryByText(/unlocks when/i)).toBeNull()

    fireEvent.click(publish)
    expect(publishIssue).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: /publish preview/i })).toBeDefined()
  })

  it('one confirm click in the preview dialog calls publishIssue(token, runId) — no typed confirmation', async () => {
    mockQueries({ findings: [warningFinding] })
    renderRail(<DecisionRail runId="run-1" />)

    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))
    const dialog = screen.getByRole('dialog', { name: /publish preview/i })
    expect(dialog.querySelector('input')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /publish now/i }))
    await waitFor(() => {
      expect(publishIssue).toHaveBeenCalledWith('tok-clerk', 'run-1')
    })
  })

  it('Cancel in the preview dialog closes it without publishing', () => {
    mockQueries({ findings: [warningFinding] })
    renderRail(<DecisionRail runId="run-1" />)

    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))
    expect(screen.getByRole('dialog', { name: /publish preview/i })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByRole('dialog', { name: /publish preview/i })).toBeNull()
    expect(publishIssue).not.toHaveBeenCalled()
  })

  it('surfaces the server 409 open_error_findings message (belt-and-suspenders)', async () => {
    mockQueries({ findings: [] })
    const { ReviewApiError } = await import('@/lib/reviewClient')
    ;(publishIssue as unknown as Mock).mockRejectedValueOnce(
      new ReviewApiError(409, 'open_error_findings', 'Resolve all error findings first.'),
    )
    renderRail(<DecisionRail runId="run-1" />)

    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))
    fireEvent.click(screen.getByRole('button', { name: /publish now/i }))
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
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.getByText(/1\/2 claims checked/i)).toBeDefined()
    expect(screen.getByText(/checked \d+m ago/i)).toBeDefined()
  })

  it('shows "No claims extracted yet" when the claims list is empty — never blank', () => {
    mockQueries({ claims: [] })
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.getByText(/no claims extracted yet/i)).toBeDefined()
  })

  it('shows "not yet checked" for legacy rows without checkedAt — never blank', () => {
    mockQueries({
      claims: [{ claimIndex: 0, status: 'checked' }],
    })
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.getByText(/not yet checked/i)).toBeDefined()
  })

  it('shows "Loading…" while claims are undefined', () => {
    mockQueries({ claims: undefined })
    ;(useQuery as unknown as Mock).mockImplementation((query: unknown) => {
      if (query === 'claimChecks:listByRunId') return undefined
      if (query === 'pitchLog:selectedByRunId') return null
      return []
    })
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0)
  })
})

// ── (d) Agent editor's recommendation (D-16/SC-4, §33.6) ────────────────────
// Relabeled from "Editor's memo" — same editor-final `notes` data source,
// but explicitly labeled as the AGENT's judgment (WSP-05); "editor"
// unqualified stays reserved for the human.

describe("DecisionRail agent editor's recommendation (D-16/SC-4 §33.6)", () => {
  it('reads JSON.parse(payload).notes from the editor-final event', () => {
    mockQueries({
      editorFinal: [{ payload: JSON.stringify({ notes: 'Ship it — strong week.' }) }],
    })
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.getByText('Ship it — strong week.')).toBeDefined()
  })

  it('falls back gracefully when the payload is malformed JSON', () => {
    mockQueries({ editorFinal: [{ payload: 'not-json{{' }] })
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.getByText(/no agent editor.s recommendation for this run/i)).toBeDefined()
  })

  it('falls back when there is no editor-final event at all', () => {
    mockQueries({ editorFinal: [] })
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.getByText(/no agent editor.s recommendation for this run/i)).toBeDefined()
  })
})

// ── Readiness board (WSP-05, Plan 41-09) ─────────────────────────────────────

describe('DecisionRail readiness board (WSP-05)', () => {
  it('renders Fact check / Voice / Hook & peg / Organization verification / Open decisions, each with a non-blank state', () => {
    mockQueries({
      claims: [{ claimIndex: 0, status: 'checked', checkedAt: Date.now() }],
      pitch: { charityName: 'The Quiet Foundation', scoutSummary: 'Archive.' },
      signoffs: { 'sounds-human': { actorId: 'andrew', signedAt: Date.now() } },
      findings: [errorFinding],
    })
    renderRail(<DecisionRail runId="run-1" />)

    const board = screen.getByText(/readiness board/i).closest('section')!
    expect(board.textContent).toMatch(/fact check/i)
    expect(board.textContent).toMatch(/1\/1 checked/i)
    expect(board.textContent).toMatch(/sounds human — signed/i)
    expect(board.textContent).toMatch(/hook/i)
    expect(board.textContent).toMatch(/selected/i)
    expect(board.textContent).toMatch(/organization verification/i)
    expect(board.textContent).toMatch(/not tracked yet/i)
    expect(board.textContent).toMatch(/open decisions/i)
    expect(board.textContent).toMatch(/1 blocker/i)
  })

  it('never renders a blank readiness row — absent data sources render an honest state, not a blank', () => {
    mockQueries({ claims: [], pitch: null, signoffs: {}, findings: [] })
    renderRail(<DecisionRail runId="run-1" />)

    const board = screen.getByText(/readiness board/i).closest('section')!
    expect(board.textContent).toMatch(/no claims yet/i)
    expect(board.textContent).toMatch(/not signed yet/i)
    expect(board.textContent).toMatch(/none selected yet/i)
    expect(board.textContent).toMatch(/not tracked yet/i)
    expect(board.textContent).toMatch(/0 blockers/i)
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
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.getByText('The Quiet Foundation')).toBeDefined()
    expect(screen.getByText('A tiny archive preserving rural oral histories.')).toBeDefined()
  })

  it('renders an honest "No charity selected yet" when no pitch is selected', () => {
    mockQueries({ pitch: null })
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.getByText(/no charity selected yet/i)).toBeDefined()
  })

  it('mounts the ResolvedFindingsList at the rail foot', () => {
    mockQueries()
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.getByTestId('resolved-findings-list')).toBeDefined()
  })
})

// ── Sign-offs (Phase 34, D-01/D-05/D-06) ────────────────────────────────────

describe('DecisionRail sign-offs (Phase 34, D-01/D-05/D-06)', () => {
  it('renders both sign-off controls when neither is active', () => {
    mockQueries({ signoffs: {} })
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.getByRole('button', { name: /sign: facts cleared/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /sign: sounds human/i })).toBeDefined()
  })

  it('records a facts-cleared sign-off via recordSignOff(token, runId, kind) on click', async () => {
    mockQueries({ signoffs: {}, findings: [] })
    renderRail(<DecisionRail runId="run-1" />)
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
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.getByText(/facts cleared — signed \d+m ago/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /sign: sounds human/i })).toBeDefined()
  })

  it('gates Publish until BOTH sign-offs are green even with zero blockers', () => {
    mockQueries({
      findings: [],
      signoffs: { 'facts-cleared': { actorId: 'andrew', signedAt: Date.now() } },
    })
    renderRail(<DecisionRail runId="run-1" />)
    const publish = screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement
    expect(publish.disabled).toBe(true)
    expect(screen.getByText(/both sign-offs required to publish/i)).toBeDefined()
  })

  it('disables the Facts-cleared control while an open error blocker exists (D-01)', () => {
    mockQueries({ findings: [errorFinding], signoffs: {} })
    renderRail(<DecisionRail runId="run-1" />)
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
    renderRail(<DecisionRail runId="run-1" />)

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
    renderRail(<DecisionRail runId="run-1" />)

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
    renderRail(<DecisionRail runId="run-1" />)

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
    renderRail(<DecisionRail runId="run-1" />)

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
    expect(() => renderRail(<DecisionRail runId="run-1" />)).not.toThrow()

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

// ── Axis scoping (Phase 36, §36.3/§36.7, Plan 36-04 Task 4) ─────────────────
//
// The "Facts cleared" gate, the blocking-items list, and the headline
// counts must all be scoped to FACTUAL_AXES (undefined axis = factual, per
// §36.3) so a voice/machine-tell error never blocks or clutters the
// factual sign-off — mirrors 36-02's server-side facts-cleared narrowing.

const machineTellError = {
  _id: 'f-voice',
  findingId: 'f-voice',
  sectionName: 'origin_story',
  severity: 'error' as const,
  axis: 'machine-tell',
  reason: 'Reads like AI-generated prose.',
}

const precisionError = {
  _id: 'f-factual',
  findingId: 'f-factual',
  sectionName: 'problem',
  severity: 'error' as const,
  axis: 'precision',
  reason: 'Vague causal claim.',
}

describe('DecisionRail axis scoping (Phase 36, §36.3/§36.7)', () => {
  it('only counts the factual-axis error as a blocker — a machine-tell error does not block Facts cleared', () => {
    mockQueries({ findings: [machineTellError, precisionError] })
    renderRail(<DecisionRail runId="run-1" />)

    expect(screen.getAllByText(/1 blocker to clear/i).length).toBeGreaterThan(0)
    // The voice finding's own reason never appears in the blocking-items list.
    expect(screen.queryByText(/reads like ai-generated prose/i)).toBeNull()
    expect(screen.getByText(/vague causal claim/i)).toBeDefined()
  })

  it('enables "Sign: Facts cleared" when the ONLY open error is a voice/machine-tell finding', () => {
    mockQueries({ findings: [machineTellError], signoffs: {} })
    renderRail(<DecisionRail runId="run-1" />)

    const facts = screen.getByRole('button', {
      name: /sign: facts cleared/i,
    }) as HTMLButtonElement
    expect(facts.disabled).toBe(false)
  })

  it('the blocking-items jump-link list contains only FACTUAL_AXES findings', () => {
    mockQueries({ findings: [machineTellError, precisionError] })
    renderRail(<DecisionRail runId="run-1" />)

    const blockingSection = screen.getByText(/blocking items/i).closest('section')!
    expect(blockingSection.textContent).toMatch(/vague causal claim/i)
    expect(blockingSection.textContent).not.toMatch(/reads like ai-generated prose/i)
  })

  it('a legacy finding with no axis at all still counts as factual (blocks Facts cleared)', () => {
    const legacyNoAxis = {
      _id: 'f-legacy',
      findingId: 'f-legacy',
      sectionName: 'founder_bio',
      severity: 'error' as const,
      reason: 'Pre-Phase-36 row with no axis field.',
    }
    mockQueries({ findings: [legacyNoAxis] })
    renderRail(<DecisionRail runId="run-1" />)

    expect(screen.getAllByText(/1 blocker to clear/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/pre-phase-36 row with no axis field/i)).toBeDefined()
  })

  it('FACTUAL_AXES sanity: machine-tell is never a member', () => {
    expect(FACTUAL_AXES.has('machine-tell')).toBe(false)
    expect(FACTUAL_AXES.has('precision')).toBe(true)
  })
})
