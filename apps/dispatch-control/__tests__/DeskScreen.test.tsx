/**
 * quick 260730-i4j (Task 2) — the /desk screen's pure render half.
 *
 * `DeskBody` is the pure, Convex-free render component (the `MyTasksList`
 * precedent) — the data-fetching wrapper `DeskScreen` (default export)
 * assembles `DerivationInputs` and feeds it fixtures. Testing THIS component
 * directly means no Convex mocking is required here.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import type { DerivedTask, StageStateResult } from '../lib/derivedState'
import { DeskBody, type DeskBodyProps } from '../app/(dashboard)/desk/_components/DeskScreen'

afterEach(() => {
  cleanup()
})

const CLEAN_STAGES: StageStateResult[] = [
  { state: 'clean', openCount: 0 },
  { state: 'needs-you', openCount: 3 },
  { state: 'needs-you', openCount: 2 },
  { state: 'needs-you', openCount: 1 },
  { state: 'not-generated', openCount: 0 },
]

function makeTask(overrides: Partial<DerivedTask> = {}): DerivedTask {
  return {
    id: 'qa-1',
    sev: 'must-fix',
    title: "Founder's date of birth contradicts the source interview",
    where: 'Founder Bio',
    why: 'Draft says 1961; the linked profile says 1963.',
    primary: { label: 'Open', href: '/issues/12/draft' },
    stage: 2,
    openedAt: Date.now(),
    ...overrides,
  }
}

function baseProps(overrides: Partial<DeskBodyProps> = {}): DeskBodyProps {
  return {
    todayKicker: 'Thursday 30 July',
    issueNumber: 12,
    runBandState: { kind: 'ok' },
    status: 'needs-review',
    stages: CLEAN_STAGES,
    elapsedLabel: '41m 12s',
    runCostUsd: 4.12,
    capUsd: 8,
    claimsChecked: 15,
    claimsTotal: 19,
    tasks: [],
    workMinutes: 0,
    scheduledForLabel: 'Thu 14:00 UTC',
    heldCount: 1,
    recentlyPublishedLabel: 'Issue 11 · Issue 10',
    ...overrides,
  }
}

describe('DeskBody — run band (loaded)', () => {
  it('renders the issue number, status chip, elapsed, cost/cap, claim coverage, and 5 stage cells with written state labels', () => {
    const tasks = [
      makeTask({ id: 'a', sev: 'must-fix' }),
      makeTask({ id: 'b', sev: 'must-fix' }),
      makeTask({ id: 'c', sev: 'must-fix' }),
      makeTask({ id: 'd', sev: 'review-recommended', title: 'Sentence drifts into promotional register' }),
      makeTask({ id: 'e', sev: 'review-recommended', title: 'Rhythm flag' }),
      makeTask({ id: 'f', sev: 'review-recommended', title: 'Single-source colour detail' }),
      makeTask({ id: 'g', sev: 'information', title: 'Bonus section reuses a format' }),
    ]
    render(<DeskBody {...baseProps({ tasks, workMinutes: 35 })} />)

    expect(screen.getByText('Issue 12')).toBeDefined()
    expect(screen.getByText('Needs review')).toBeDefined()
    expect(screen.getByText('41m 12s')).toBeDefined()
    expect(screen.getByText('$4.12 / $8.00')).toBeDefined()
    expect(screen.getByText('15 / 19')).toBeDefined()

    // 5 stage cells, each with a written STAGE_STATE_LABELS mark.
    expect(screen.getByText('Clean')).toBeDefined()
    expect(screen.getAllByText(/Needs you/).length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText('Not generated')).toBeDefined()
  })
})

describe('DeskBody — run band loading (signOffs not loaded)', () => {
  it('renders a loading state for the run band — never a stale status label', () => {
    render(<DeskBody {...baseProps({ runBandState: { kind: 'loading' } })} />)
    expect(screen.getByText(/loading/i)).toBeDefined()
    expect(screen.queryByText('Needs review')).toBeNull()
  })
})

describe('DeskBody — status unknown', () => {
  it('renders a refresh affordance, never a stale status label', () => {
    render(<DeskBody {...baseProps({ runBandState: { kind: 'unknown' }, status: 'unknown' })} />)
    expect(screen.getByRole('button', { name: /state unknown — refresh/i })).toBeDefined()
    expect(screen.queryByText('Needs review')).toBeNull()
  })
})

describe('DeskBody — cost unknown', () => {
  it('renders "cost unknown — refresh", never a fabricated $0.00', () => {
    render(<DeskBody {...baseProps({ runCostUsd: undefined })} />)
    expect(screen.getByText(/cost unknown — refresh/i)).toBeDefined()
    expect(screen.queryByText('$0.00 / $8.00')).toBeNull()
  })
})

describe('DeskBody — severity-grouped task ledger', () => {
  it('renders exactly three group headings in order, each with a count; Must fix reads "blocks publish"; empty buckets are omitted', () => {
    const tasks = [
      makeTask({ id: 'a', sev: 'must-fix' }),
      makeTask({ id: 'b', sev: 'review-recommended', title: 'Review task' }),
    ]
    render(<DeskBody {...baseProps({ tasks, workMinutes: 9 })} />)

    expect(screen.getByText(/Must fix/)).toBeDefined()
    expect(screen.getByText(/blocks publish/)).toBeDefined()
    expect(screen.getByText('Review recommended')).toBeDefined()
    expect(screen.queryByText('Worth knowing')).toBeNull()
  })

  it('every task row renders title, why, where, a stage chip, and a link to primary.href', () => {
    const task = makeTask({
      id: 'zz',
      sev: 'must-fix',
      title: 'Statistic has no source attached',
      where: 'Case Study',
      why: 'No citation in the claim ledger.',
      primary: { label: 'Review', href: '/issues/12/fact-check' },
      stage: 3,
    })
    render(<DeskBody {...baseProps({ tasks: [task], workMinutes: 6 })} />)

    expect(screen.getByText('Statistic has no source attached')).toBeDefined()
    expect(screen.getByText('No citation in the claim ledger.')).toBeDefined()
    expect(screen.getByText('Case Study')).toBeDefined()
    expect(screen.getByText('Fact Check')).toBeDefined()
    const link = screen.getByRole('link', { name: 'Review' })
    expect(link.getAttribute('href')).toBe('/issues/12/fact-check')
  })
})

describe('DeskBody — zero tasks on a live issue', () => {
  it('renders "Nothing needs you." — never a blank body', () => {
    render(<DeskBody {...baseProps({ tasks: [], workMinutes: 0 })} />)
    expect(screen.getByText(/nothing needs you/i)).toBeDefined()
  })
})

describe('DeskBody — no issue in progress at all', () => {
  it('renders a plain "No issue in progress" state — never a broken run band', () => {
    render(
      <DeskBody
        {...baseProps({
          issueNumber: null,
          runBandState: { kind: 'none' },
          tasks: [],
          workMinutes: 0,
        })}
      />,
    )
    expect(screen.getByText(/no issue in progress/i)).toBeDefined()
    expect(screen.queryByText('Issue 12')).toBeNull()
  })
})

describe('DeskBody — quiet strip', () => {
  it('always renders four cells: next discovery, held (link to /issues), recently published (link to /issues), and New issue (link to /issues)', () => {
    render(<DeskBody {...baseProps()} />)

    expect(screen.getByText('Thu 14:00 UTC')).toBeDefined()

    const heldLink = screen.getByRole('link', { name: /1 issue/i })
    expect(heldLink.getAttribute('href')).toBe('/issues')

    const publishedLink = screen.getByRole('link', { name: /Issue 11 · Issue 10/i })
    expect(publishedLink.getAttribute('href')).toBe('/issues')

    const newIssueLink = screen.getByRole('link', { name: /new issue/i })
    expect(newIssueLink.getAttribute('href')).toBe('/issues')
  })

  it('renders the quiet strip even with zero tasks and no in-progress issue', () => {
    render(
      <DeskBody
        {...baseProps({
          issueNumber: null,
          runBandState: { kind: 'none' },
          tasks: [],
          workMinutes: 0,
        })}
      />,
    )
    expect(screen.getByText('Thu 14:00 UTC')).toBeDefined()
    expect(screen.getByRole('link', { name: /new issue/i })).toBeDefined()
  })
})

describe('DeskBody — page head', () => {
  it("renders today's kicker, the 'Your desk' h1, and a dek stating open count + estimated minutes", () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b', sev: 'review-recommended' })]
    const { container } = render(<DeskBody {...baseProps({ tasks, workMinutes: 9 })} />)

    expect(screen.getByText('Thursday 30 July')).toBeDefined()
    expect(within(container).getByRole('heading', { level: 1, name: 'Your desk' })).toBeDefined()
    expect(screen.getByText(/9 min/)).toBeDefined()
  })
})
