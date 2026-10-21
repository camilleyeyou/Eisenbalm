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

// quick 260722-tv1: DecisionRail's handleTranscript/jumpToFinding, and the
// SourceIndex it mounts, now fall back to useRouter().push(...) when a
// jump target's galley anchor isn't in the DOM (this rail mounts as the
// Approval stage, which never mounts a galley) — mock useRouter so the
// component tree can render.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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
    pipelineRuns: { byRunId: 'pipelineRuns:byRunId' },
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
  runRow?: unknown
}

function mockQueries(state: QueryState = {}) {
  ;(useQuery as unknown as Mock).mockImplementation((query: unknown) => {
    switch (query) {
      case 'pipelineRuns:byRunId':
        return state.runRow ?? { status: 'awaiting-review' }
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

    const blocking = screen.getByText(/must fix items/i)
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
    expect(screen.getAllByText(/1 open note/i).length).toBeGreaterThan(0)
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
  it('keeps Publish ENABLED with an open error finding and no sign-offs (quick 261021-7aw)', () => {
    mockQueries({ findings: [errorFinding] })
    renderRail(<DecisionRail runId="run-1" />)

    const publish = screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement
    expect(publish.disabled).toBe(false)
    expect(screen.queryByText(/unlocks when/i)).toBeNull()
    expect(screen.queryByText(/both sign-offs required/i)).toBeNull()
    expect(screen.queryByText(/must fix = 0/i)).toBeNull()
  })

  it('is disabled only when the issue is held, with the release-the-hold message (D-15)', () => {
    mockQueries({ findings: [] })
    renderRail(<DecisionRail runId="run-1" held={true} />)

    const publish = screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement
    expect(publish.disabled).toBe(true)
    expect(screen.getByText(/release the hold to publish/i)).toBeDefined()
    expect(screen.queryByText(/not held/i)).toBeNull()
  })

  it('enables Publish when not held, and opens the preview WITHOUT publishing yet', () => {
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

  it('quick 261021-ind: there is no fake Hold button (the real hold lives in the issue header)', () => {
    mockQueries({ findings: [warningFinding] })
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.queryByRole('button', { name: /^hold$/i })).toBeNull()
  })

  it('quick 261021-ind: Publish and Schedule stay disabled after a successful publish (no double-publish)', async () => {
    mockQueries({ findings: [warningFinding] })
    renderRail(<DecisionRail runId="run-1" />)

    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))
    fireEvent.click(screen.getByRole('button', { name: /publish now/i }))
    await waitFor(() => {
      expect(publishIssue).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect((screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement).disabled).toBe(true)
    })
    expect(
      (screen.getByRole('button', { name: /schedule for later/i }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('quick 261021-ind: a complete run shows "Published." and no Publish/Schedule buttons', () => {
    mockQueries({ findings: [warningFinding], runRow: { status: 'complete' } })
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.getByText('Published.')).toBeDefined()
    expect(screen.queryByRole('button', { name: /^publish$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /schedule for later/i })).toBeNull()
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

describe('DecisionRail verification block (D-13, Phase 51.1)', () => {
  it('summarises contradicted claims, never a checked count', () => {
    mockQueries({
      claims: [
        { claimIndex: 0, status: 'pending', verdict: 'contradicted' },
        { claimIndex: 1, status: 'pending', verdict: 'verified' },
      ],
    })
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.getByText(/1 contradicted · 0 unverified load-bearing/i)).toBeDefined()
    expect(screen.getAllByText(/^1 contradicted$/i).length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/claims checked|\d+\/\d+ checked/i)
  })

  it('shows "No claims extracted yet" when the claims list is empty — never blank', () => {
    mockQueries({ claims: [] })
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.getByText(/no claims extracted yet/i)).toBeDefined()
    expect(screen.getByText(/no claims extracted$/i)).toBeDefined()
  })

  it('shows no contradicted claims for legacy/verified rows', () => {
    mockQueries({
      claims: [{ claimIndex: 0, status: 'pending' }],
    })
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.getAllByText(/no contradicted claims/i).length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/claims checked|not yet checked/i)
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
      claims: [{ claimIndex: 0, status: 'pending', verdict: 'contradicted' }],
      pitch: { charityName: 'The Quiet Foundation', scoutSummary: 'Archive.' },
      signoffs: { 'sounds-human': { actorId: 'andrew', signedAt: Date.now() } },
      findings: [errorFinding],
    })
    renderRail(<DecisionRail runId="run-1" />)

    const board = screen.getByText(/readiness board/i).closest('section')!
    expect(board.textContent).toMatch(/fact check/i)
    expect(board.textContent).toMatch(/1 contradicted/i)
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
    expect(board.textContent).toMatch(/no claims extracted/i)
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

  it('does not gate Publish on sign-offs (optional attestations)', () => {
    mockQueries({
      findings: [],
      signoffs: { 'facts-cleared': { actorId: 'andrew', signedAt: Date.now() } },
    })
    renderRail(<DecisionRail runId="run-1" />)
    const publish = screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement
    expect(publish.disabled).toBe(false)
    expect(screen.getByText(/sign-offs \(optional\)/i)).toBeDefined()
  })

  it('keeps the Facts-cleared control enabled even with an open error blocker', () => {
    mockQueries({ findings: [errorFinding], signoffs: {} })
    renderRail(<DecisionRail runId="run-1" />)
    const facts = screen.getByRole('button', {
      name: /sign: facts cleared/i,
    }) as HTMLButtonElement
    expect(facts.disabled).toBe(false)
  })
})

// ── No claim ledger in the editor path (Phase 51.1, §51.1.9) ────────────────

describe('DecisionRail — no claim ledger (Phase 51.1)', () => {
  const claims = [
    { claimIndex: 0, text: 'Verified claim text.', status: 'pending', verdict: 'verified', sectionName: 'caseStudy' },
    { claimIndex: 1, text: 'Legacy claim text.', status: 'pending' },
  ]

  it('does not render per-claim check/skip controls', () => {
    mockQueries({ claims })
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.queryAllByRole('button', { name: /^(check|skip)\b/i }).length).toBe(0)
    expect(screen.queryByText(/^unsourced$/i)).toBeNull()
  })

  it('renders no claim text from unflagged rows', () => {
    mockQueries({ claims })
    renderRail(<DecisionRail runId="run-1" />)
    expect(screen.queryByText('Verified claim text.')).toBeNull()
    expect(screen.queryByText('Legacy claim text.')).toBeNull()
  })

  it('keeps Sign: Facts cleared enabled while a contradicted claim is open', () => {
    mockQueries({
      claims: [{ claimIndex: 0, status: 'pending', verdict: 'contradicted' }],
      signoffs: {},
      findings: [],
    })
    renderRail(<DecisionRail runId="run-1" />)
    expect(
      (screen.getByRole('button', { name: /sign: facts cleared/i }) as HTMLButtonElement).disabled,
    ).toBe(false)
    expect(screen.queryByText(/to fix or dismiss before clearing facts/i)).toBeNull()
  })

  it('enables Sign: Facts cleared with zero claims', () => {
    mockQueries({ claims: [], signoffs: {}, findings: [] })
    renderRail(<DecisionRail runId="run-1" />)
    expect(
      (screen.getByRole('button', { name: /sign: facts cleared/i }) as HTMLButtonElement).disabled,
    ).toBe(false)
  })

  it('enables Sign: Facts cleared when no claim is contradicted (legacy pending)', () => {
    mockQueries({ claims, signoffs: {}, findings: [] })
    renderRail(<DecisionRail runId="run-1" />)
    expect(
      (screen.getByRole('button', { name: /sign: facts cleared/i }) as HTMLButtonElement).disabled,
    ).toBe(false)
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

    expect(screen.getAllByText(/1 open note/i).length).toBeGreaterThan(0)
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

  it('the must-fix-items jump-link list contains only FACTUAL_AXES findings', () => {
    mockQueries({ findings: [machineTellError, precisionError] })
    renderRail(<DecisionRail runId="run-1" />)

    const blockingSection = screen.getByText(/must fix items/i).closest('section')!
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

    expect(screen.getAllByText(/1 open note/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/pre-phase-36 row with no axis field/i)).toBeDefined()
  })

  it('FACTUAL_AXES sanity: machine-tell is never a member', () => {
    expect(FACTUAL_AXES.has('machine-tell')).toBe(false)
    expect(FACTUAL_AXES.has('precision')).toBe(true)
  })
})
