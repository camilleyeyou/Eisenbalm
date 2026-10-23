/**
 * Phase 56-09 — Behind-Run (pure view).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import BehindRunView, { type BehindRunViewProps } from '../app/admin/runs/_components/BehindRunView'
import { STEP_EXPLANATIONS, GENERIC_EXPLANATION } from '../lib/behindExplanations'
import {
  deriveBehindSteps,
  formatCostLine,
  PLAIN_STEPS,
  EDITOR_BANNED_PATTERN,
  RUN_ID_PATTERN,
} from '../lib/editorState'

afterEach(cleanup)

const INTERRUPT = "Interrupt(value={'candidates': [{'charityName': 'Foo'}]})"
const RAW = 'verify_research: 3 of 7 claims unverifiable'

const problemSteps = deriveBehindSteps({
  agentRuns: [
    { agentKey: 'signal_editor', status: 'done', completedAt: 1 },
    { agentKey: 'scout', status: 'done', completedAt: 1 },
    { agentKey: 'verify_candidates', status: 'done', completedAt: 1 },
    { agentKey: 'editor_gate_1', status: 'done', completedAt: 1 },
    { agentKey: 'researcher', status: 'done', completedAt: 1 },
    { agentKey: 'verify_research', status: 'failed', error: RAW },
  ],
  runStatus: 'failed',
})!
const pausedSteps = deriveBehindSteps({
  agentRuns: [
    { agentKey: 'signal_editor', status: 'done', completedAt: 1 },
    { agentKey: 'scout', status: 'done', completedAt: 1 },
    { agentKey: 'verify_candidates', status: 'done', completedAt: 1 },
    { agentKey: 'editor_gate_1', status: 'failed', error: INTERRUPT },
  ],
  runStatus: 'failed',
})!
const cancelledSteps = deriveBehindSteps({
  agentRuns: [{ agentKey: 'signal_editor', status: 'done', completedAt: 1 }],
  runStatus: 'cancelled',
})!
const costLine = formatCostLine({ costUsd: 0.21, mode: 'stopped' })

function view(over: Partial<BehindRunViewProps> = {}) {
  return render(
    <BehindRunView
      mode="problem"
      issueNumber={42}
      issueLine="Issue 42 · Thursday 17 September 2026"
      issueHref="/?run=abc"
      steps={problemSteps}
      costLine={costLine}
      problemKey="verify-research"
      rawError={RAW}
      onPrimary={() => {}}
      primaryBusy={false}
      actionError={null}
      {...over}
    />,
  )
}

function textOutsidePre(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement
  clone.querySelectorAll('pre').forEach((p) => p.remove())
  return clone.textContent ?? ''
}

describe('STEP_EXPLANATIONS', () => {
  it('covers exactly the ten plain steps with no banned words', () => {
    expect(Object.keys(STEP_EXPLANATIONS).length).toBe(10)
    expect(Object.keys(STEP_EXPLANATIONS).sort()).toEqual(PLAIN_STEPS.map((s) => s.key).sort())
    for (const e of [...Object.values(STEP_EXPLANATIONS), GENERIC_EXPLANATION]) {
      expect(e.what).not.toMatch(EDITOR_BANNED_PATTERN)
      expect(e.next).not.toMatch(EDITOR_BANNED_PATTERN)
    }
  })
})

describe('BehindRunView', () => {
  it('problem: slab, breadcrumb, h1, steps, plain words, closed technical details, cost', () => {
    const { container } = view()
    expect(container.querySelectorAll('[data-primary]')).toHaveLength(1)
    expect(container.querySelector('[data-primary]')!.textContent).toBe('Start a new issue')
    expect(screen.getByText('This issue hit a problem and stopped. Nothing reached readers.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Behind the scenes' }).getAttribute('href')).toBe('/admin')
    expect(container.textContent).toContain('Behind the scenes · Issue 42 · Thursday 17 September 2026')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('What happened to Issue 42')
    const items = container.querySelectorAll('ol > li')
    expect(items).toHaveLength(10)
    expect(items[5].textContent).toContain('Problem')
    for (let i = 6; i < 10; i++) expect(items[i].textContent).toContain('Not yet')
    expect(screen.getByRole('heading', { name: 'In plain words' })).toBeTruthy()
    const details = container.querySelector('details')!
    expect(details.hasAttribute('open')).toBe(false)
    expect(details.querySelector('summary')!.textContent).toBe('Technical details')
    expect(details.querySelector('pre')!.textContent).toBe(RAW)
    expect(container.textContent).toContain('This attempt cost $0.21 before it stopped.')
  })

  it('paused: never says Problem or Failed; Interrupt only inside pre', () => {
    const { container } = view({ mode: 'paused', steps: pausedSteps, problemKey: null, rawError: INTERRUPT })
    const outside = textOutsidePre(container)
    expect(outside).not.toMatch(/Problem|Failed/)
    expect(outside).not.toContain('Interrupt(')
    expect(container.querySelector('pre')!.textContent).toContain('Interrupt(')
    expect(container.querySelectorAll('ol > li')[3].textContent).toContain('Waiting for you')
  })

  it('stuck: offers Stop this issue', () => {
    const { container } = view({ mode: 'stuck', problemKey: null, rawError: null })
    expect(container.querySelector('[data-primary]')!.textContent).toBe('Stop this issue')
  })

  it('stopped: stopped sentence, start primary, Stopped steps', () => {
    const { container } = view({ mode: 'stopped', steps: cancelledSteps, problemKey: null, rawError: null })
    expect(screen.getByText('This issue was stopped. Nothing reached readers.')).toBeTruthy()
    expect(container.querySelector('[data-primary]')!.textContent).toBe('Start a new issue')
    expect(container.querySelectorAll('ol > li')[1].textContent).toContain('Stopped')
  })

  it('working: no primary, Working indicator', () => {
    const { container } = view({ mode: 'working', problemKey: null, rawError: null })
    expect(container.querySelectorAll('[data-primary]')).toHaveLength(0)
    expect(container.textContent).toContain('Working')
  })

  it('ready: sentence and ghost link to the issue', () => {
    const { container } = view({ mode: 'ready', problemKey: null, rawError: null })
    expect(screen.getByText('Issue 42 is waiting for you on the front page.')).toBeTruthy()
    expect(container.querySelectorAll('[data-primary]')).toHaveLength(0)
    expect(screen.getByRole('link', { name: 'Back to the issue' }).getAttribute('href')).toBe('/?run=abc')
  })

  it('published: went out sentence and ghost link', () => {
    view({ mode: 'published', problemKey: null, rawError: null, publishedDay: 'Thursday' })
    expect(screen.getByText('Issue 42 went out on Thursday.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to the issue' })).toBeTruthy()
  })

  it('no banned words or run ids outside the pre, in any mode', () => {
    for (const mode of ['problem', 'paused', 'stuck', 'stopped', 'working', 'ready', 'published'] as const) {
      const { container } = view({ mode, rawError: INTERRUPT })
      const outside = textOutsidePre(container)
      expect(outside).not.toMatch(EDITOR_BANNED_PATTERN)
      expect(outside).not.toMatch(RUN_ID_PATTERN)
      cleanup()
    }
  })
})
