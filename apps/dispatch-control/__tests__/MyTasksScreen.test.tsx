/**
 * Phase 43 Plan 43-05 (§43.5/§43.6, TSK-01..TSK-05) — RED scaffold for the
 * /my-tasks screen's pure render component.
 *
 * `MyTasksList` is the pure, Convex-free render half of MyTasksScreen.tsx —
 * the data-fetching wrapper (assembling DerivationInputs + deriveTasks +
 * computeSessionStates, exactly like Masthead.tsx's assembly) feeds it a
 * `DisplayTask[]` + `approvalHref`. Testing THIS component directly means no
 * Convex mocking is required here; the live-wiring assertions
 * (`deriveTasks`, `computeSessionStates`, `run.section_rerolled`) are
 * covered by grep-based acceptance criteria against MyTasksScreen.tsx
 * itself in Task 2.
 *
 * RED until Task 2 implements `MyTasksList` in
 * app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { DisplayTask } from '../lib/taskSupersession'
import { MyTasksList } from '../app/(dashboard)/my-tasks/_components/MyTasksScreen'

afterEach(() => {
  cleanup()
})

function makeActiveTask(overrides: Partial<DisplayTask> = {}): DisplayTask {
  return {
    id: 'qa-3',
    sev: 'must-fix',
    title: 'Unsourced statistic',
    where: 'origin_story',
    why: 'Load-bearing claim needs a source',
    rec: 'Consider citing the annual report',
    primary: { label: 'Review claim', href: '/issues/7/fact-check' },
    stage: 3,
    openedAt: Date.now() - 120_000, // 2 minutes ago
    sessionState: 'active',
    ...overrides,
  }
}

describe('MyTasksList — empty state (TSK-04)', () => {
  it('renders "Nothing needs you" + a link to the current issue\'s /approval, never a bare empty list', () => {
    render(<MyTasksList tasks={[]} approvalHref="/issues/7/approval" />)

    expect(screen.getByText(/nothing needs you/i)).toBeDefined()
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/issues/7/approval')
  })
})

describe('MyTasksList — active task row (TSK-01/02/03)', () => {
  it('renders title, where, why, severity label+icon, stage, age, recommendation, primary link, and Inspect context', () => {
    render(<MyTasksList tasks={[makeActiveTask()]} approvalHref="/issues/7/approval" />)

    expect(screen.getByText('Unsourced statistic')).toBeDefined()
    expect(screen.getByText('origin_story')).toBeDefined()
    expect(screen.getByText('Load-bearing claim needs a source')).toBeDefined()

    // Severity label WITH an icon — never color alone.
    const sevLabel = screen.getByText('Must fix')
    expect(sevLabel.querySelector('svg')).not.toBeNull()

    // Age, via formatTaskAge.
    expect(screen.getByText(/2m ago/)).toBeDefined()

    // Agent recommendation, when present.
    expect(screen.getByText('Consider citing the annual report')).toBeDefined()

    // Primary deep-link action.
    const primaryLink = screen.getByRole('link', { name: 'Review claim' })
    expect(primaryLink.getAttribute('href')).toBe('/issues/7/fact-check')

    // "Inspect context" entry point (visible-but-inert, D-16).
    expect(screen.getByRole('button', { name: /inspect context/i })).toBeDefined()
  })

  it('omits the recommendation line when the task carries no `rec`', () => {
    render(
      <MyTasksList
        tasks={[makeActiveTask({ rec: undefined, title: 'No rec here' })]}
        approvalHref="/issues/7/approval"
      />,
    )
    expect(screen.getByText('No rec here')).toBeDefined()
  })

  it('renders "unknown" age (never a blank string) when openedAt is absent', () => {
    render(
      <MyTasksList
        tasks={[makeActiveTask({ openedAt: undefined, title: 'No timestamp recorded' })]}
        approvalHref="/issues/7/approval"
      />,
    )
    expect(screen.getByText('No timestamp recorded')).toBeDefined()
    expect(screen.getByText('unknown')).toBeDefined()
  })
})

describe('MyTasksList — superseded task row (TSK-05)', () => {
  it('renders struck-through text, a "superseded" label, and a link to the new step', () => {
    const task: DisplayTask = {
      id: 'qa-2',
      sev: 'must-fix',
      title: 'Fix the founder phrase',
      where: 'origin_story',
      why: 'Voice finding requires human judgment',
      primary: { label: 'Review', href: '/issues/7/draft' },
      stage: 2,
      openedAt: 1000,
      sessionState: 'superseded',
      supersededBy: '/issues/7/draft#origin-story',
    }
    render(<MyTasksList tasks={[task]} approvalHref="/issues/7/approval" />)

    const title = screen.getByText('Fix the founder phrase')
    expect(title.className).toContain('line-through')
    expect(screen.getByText(/superseded/i)).toBeDefined()

    const link = screen.getByRole('link', { name: /new step/i })
    expect(link.getAttribute('href')).toBe('/issues/7/draft#origin-story')
  })
})

describe('MyTasksList — resolved task row (TSK-05)', () => {
  it('renders "resolved just now" struck-through', () => {
    const now = Date.now()
    const task: DisplayTask = {
      id: 'qa-9',
      sev: 'review-recommended',
      title: 'Claim now checked',
      where: 'caseStudy',
      why: 'Unverified claim requires human judgment',
      primary: { label: 'Review', href: '/issues/7/fact-check' },
      stage: 3,
      openedAt: now,
      sessionState: 'resolved',
    }
    render(<MyTasksList tasks={[task]} approvalHref="/issues/7/approval" />)

    const title = screen.getByText('Claim now checked')
    expect(title.className).toContain('line-through')
    expect(screen.getByText(/resolved just now/i)).toBeDefined()
  })
})

// quick 260722-v01 (audit item 2) — severity-grouped sections.
describe('MyTasksList — severity grouping (audit item 2)', () => {
  it('groups tasks into "Must fix · N" / "Review recommended · N" / "Information · N" sections, omitting empty buckets', () => {
    const mustFix = makeActiveTask({ id: 'qa-1', sev: 'must-fix', title: 'Must-fix task' })
    const reviewRec = makeActiveTask({
      id: 'qa-2',
      sev: 'review-recommended',
      title: 'Review-recommended task',
    })

    render(<MyTasksList tasks={[mustFix, reviewRec]} approvalHref="/issues/7/approval" />)

    expect(screen.getByText('Must fix · 1')).toBeDefined()
    expect(screen.getByText('Review recommended · 1')).toBeDefined()
    // No 'information' tasks in this fixture — that section is omitted entirely.
    expect(screen.queryByText(/^Information ·/)).toBeNull()

    // The row-level SeverityBadge's text ("Must fix") stays unambiguous —
    // the section header's "Must fix · 1" is a single text node, not a
    // nested <span> that would collide with getByText('Must fix').
    const sevLabel = screen.getByText('Must fix')
    expect(sevLabel.querySelector('svg')).not.toBeNull()
  })
})
