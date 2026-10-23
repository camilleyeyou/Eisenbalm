/**
 * Phase 56-08 — Behind the scenes (pure view).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import BehindHubView from '../app/admin/_components/BehindHubView'
import { deriveBehindSteps, formatCostLine, EDITOR_BANNED_PATTERN, RUN_ID_PATTERN } from '../lib/editorState'
import { ADMIN_ITEMS } from '../lib/nav'

afterEach(cleanup)

const steps = deriveBehindSteps({ agentRuns: [], runStatus: 'running' })!
const costLine = formatCostLine({ costUsd: 0.58, startedAt: 0, completedAt: 39 * 60000, mode: 'finished' })
const SLAB = 'Nothing here needs you this week. The issue is waiting for you on the front page.'

function view(over: Partial<React.ComponentProps<typeof BehindHubView>> = {}) {
  return render(
    <BehindHubView slabSentence={SLAB} issueLine="Issue 7" steps={steps} costLine={costLine} items={ADMIN_ITEMS} {...over} />,
  )
}

describe('BehindHubView', () => {
  it('renders heading, intro, slab with a ghost back link and no primary', () => {
    const { container } = view()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Behind the scenes')
    expect(container.textContent).toContain('Nothing on this page is needed to publish.')
    expect(screen.getByText(SLAB)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to the issue' }).getAttribute('href')).toBe('/')
    expect(container.querySelectorAll('[data-primary]')).toHaveLength(0)
  })

  it('shows the 10 steps and the real cost footer', () => {
    const { container } = view()
    expect(screen.getByText("This week's issue, step by step")).toBeTruthy()
    expect(container.querySelectorAll('ol > li')).toHaveLength(10)
    expect(container.textContent).toContain('This issue cost $0.58 to write and took 39 minutes.')
    expect(container.textContent).not.toContain('$0.00')
  })

  it('lists seven dials in order with plain Check weekly tags on the first two', () => {
    view()
    const dials = screen.getAllByRole('link').filter((a) => (a.getAttribute('href') ?? '').startsWith('/admin/'))
    expect(dials).toHaveLength(7)
    expect(dials[0].textContent).toContain('Money')
    expect(dials[1].textContent).toContain('Charities')
    expect(screen.getAllByText('Check weekly')).toHaveLength(2)
    for (const a of dials) expect(a.getAttribute('href')).toMatch(/^\/admin\//)
  })

  it('has no Admin heading, chips, or banned words', () => {
    const { container } = view()
    expect(screen.queryByText('Admin')).toBeNull()
    expect(container.innerHTML).not.toMatch(/uppercase/)
    expect(container.textContent).not.toMatch(EDITOR_BANNED_PATTERN)
    expect(container.textContent).not.toMatch(RUN_ID_PATTERN)
  })

  it('uses the two-column layout', () => {
    const { container } = view()
    expect(container.innerHTML).toContain('grid-cols-1 lg:grid-cols-[3fr_2fr]')
  })

  it('renders problem slab text as given', () => {
    view({ slabSentence: 'This issue hit a problem and stopped. Nothing reached readers.' })
    expect(screen.getByText('This issue hit a problem and stopped. Nothing reached readers.')).toBeTruthy()
  })
})
