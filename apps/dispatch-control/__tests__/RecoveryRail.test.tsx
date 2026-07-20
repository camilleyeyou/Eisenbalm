/**
 * Phase 50 Plan 05 (WBN-03, D-10/D-11/D-12) — RecoveryRail tests.
 *
 * Pins the failed-run recovery rail's must-haves:
 *   (a) all four §7 plain-language sections render for a failed run —
 *       what happened / what completed successfully / what did not happen /
 *       recommended recovery
 *   (b) downstream steps render dimmed and labeled "Skipped" (never blank)
 *   (c) the per-step "Restart from this step" honesty matrix — LIVE for
 *       exactly 3 of the 11 §7 step-types (the 7 writers, editor_gate_1
 *       ONLY when paused, publisher), RESERVED (disabled + explanation, no
 *       reuse claim) for the other 8
 *   (d) "Improve this agent" deep-links `/prompt-lab/{agentKey}` for the
 *       failed step when it has an externalized prompt; reserved otherwise
 *
 * Runs in jsdom (vitest.config.ts: __tests__/*.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

const rerollAgentMock = vi.fn(async () => ({
  runId: 'run-1',
  agentKey: 'game',
  rerolled: true,
}))
const publishManualMock = vi.fn(async () => ({
  runId: 'run-1',
  issueId: 'issue-1',
  issueNumber: 1,
  scheduled: true,
}))

vi.mock('@/lib/pipelineControlClient', () => ({
  rerollAgent: (...args: unknown[]) => rerollAgentMock(...args),
  publishManual: (...args: unknown[]) => publishManualMock(...args),
}))

import RecoveryRail from '../app/(dashboard)/run-monitor/runs/_components/RecoveryRail'
import { restartAvailabilityFor } from '../lib/nomenclature'

afterEach(() => {
  cleanup()
  rerollAgentMock.mockClear()
  publishManualMock.mockClear()
})

type Row = { agentKey: string; status: string; error?: string }

function rows(failedKey: string, opts: { before?: string[]; error?: string } = {}): Row[] {
  const before = opts.before ?? []
  return [
    ...before.map(agentKey => ({ agentKey, status: 'done' })),
    { agentKey: failedKey, status: 'failed', error: opts.error },
  ]
}

describe('RecoveryRail (WBN-03) — four §7 sections', () => {
  it('renders all four labeled sections, the failed step in "What happened", and its reason', () => {
    render(
      <RecoveryRail
        runId="run-1"
        agentRuns={rows('advocate', {
          before: ['signal_editor', 'scout', 'verify_candidates'],
          error: 'LLM request timed out',
        })}
      />,
    )

    expect(screen.getByText('What happened')).toBeTruthy()
    expect(screen.getByText('What completed successfully')).toBeTruthy()
    expect(screen.getByText('What did not happen')).toBeTruthy()
    expect(screen.getByText('Recommended recovery')).toBeTruthy()

    // Failed step — action-primary label + reason.
    expect(screen.getByText('Make the case')).toBeTruthy()
    expect(screen.getByText('LLM request timed out')).toBeTruthy()

    // Completed-before steps, by action label.
    expect(screen.getByText('Find story leads')).toBeTruthy()
    expect(screen.getByText('Find organizations')).toBeTruthy()
    expect(screen.getByText('Verify organizations')).toBeTruthy()
  })

  it('renders a fallback "What happened" when the run failed but no step is recorded as failed', () => {
    render(<RecoveryRail runId="run-1" agentRuns={[]} />)
    expect(screen.getByText('What happened')).toBeTruthy()
    expect(screen.getByText(/no specific step is recorded as failed/i)).toBeTruthy()
  })

  it('quick 260719-w6o (F4): a genuinely paused run (no failed agent row) mounts a reachable /signal-desk recovery, not the generic failed fallback', () => {
    render(<RecoveryRail runId="run-1" agentRuns={[]} isPausedAtGate1 />)
    expect(screen.getByText('Paused for your decision')).toBeTruthy()
    const link = screen.getByRole('link', { name: 'Restart from this step' })
    expect(link.getAttribute('href')).toBe('/signal-desk')
    expect(screen.queryByText(/no specific step is recorded as failed/i)).toBeNull()
  })

  it('falls back to a generic reason when the failed row has no error text', () => {
    render(<RecoveryRail runId="run-1" agentRuns={rows('scout')} />)
    expect(screen.getByText(/failed without a specific error message/i)).toBeTruthy()
  })
})

describe('RecoveryRail (WBN-03) — downstream steps dim + read "Skipped"', () => {
  it('lists every named step after the failed one, each labeled "Skipped"', () => {
    render(<RecoveryRail runId="run-1" agentRuns={rows('advocate')} />)

    // Downstream of "Make the case" (advocate): Choose recommended story,
    // Research the issue, Verify research, Draft sections, Check the draft,
    // Recommend publication, Prepare publication — all present, all "Skipped".
    for (const label of [
      'Choose recommended story',
      'Research the issue',
      'Verify research',
      'Draft sections',
      'Check the draft',
      'Recommend publication',
      'Prepare publication',
    ]) {
      const el = screen.getByTestId(`skipped-${label}`)
      expect(el.textContent).toMatch(/Skipped/)
    }
  })

  it('never renders a blank downstream section when this was the last step', () => {
    render(<RecoveryRail runId="run-1" agentRuns={rows('publisher', { before: ['qa', 'editor_final'] })} />)
    expect(screen.getByText(/nothing downstream was skipped/i)).toBeTruthy()
  })
})

describe('RecoveryRail (WBN-03) — "Restart from this step" honesty matrix', () => {
  it('the pure matrix: LIVE for the 7 writers + publisher; RESERVED for editor_gate_1 by default and the other 8 step-types; LIVE for editor_gate_1 only when paused', () => {
    const LIVE_WITHOUT_PAUSE = [
      'origin_story',
      'problem',
      'founder_bio',
      'case_study',
      'game',
      'bonus',
      'design',
      'publisher',
    ]
    for (const key of LIVE_WITHOUT_PAUSE) {
      expect(restartAvailabilityFor(key)).toBe('live')
    }

    const RESERVED = [
      'signal_editor',
      'scout',
      'verify_candidates',
      'advocate',
      'editor_gate_1',
      'researcher',
      'verify_research',
      'qa',
      'editor_final',
    ]
    for (const key of RESERVED) {
      expect(restartAvailabilityFor(key)).toBe('reserved')
    }

    expect(restartAvailabilityFor('editor_gate_1', { isPausedAtGate1: true })).toBe('live')
  })

  it('is LIVE and clickable for a failed section writer, and invokes rerollAgent', async () => {
    window.confirm = vi.fn(() => true)
    render(<RecoveryRail runId="run-1" agentRuns={rows('game')} />)

    const btn = screen.getByRole('button', { name: 'Restart from this step' })
    expect((btn as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText(/reused, not re-paid/i)).toBeTruthy()

    fireEvent.click(btn)
    await Promise.resolve()
    await Promise.resolve()

    expect(rerollAgentMock).toHaveBeenCalledWith('run-1', 'game', 'tok-clerk')
  })

  it('is LIVE for a failed publisher step, and invokes publishManual', async () => {
    window.confirm = vi.fn(() => true)
    render(<RecoveryRail runId="run-1" agentRuns={rows('publisher', { before: ['qa', 'editor_final'] })} />)

    const btn = screen.getByRole('button', { name: 'Restart from this step' })
    expect((btn as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(btn)
    await Promise.resolve()
    await Promise.resolve()

    expect(publishManualMock).toHaveBeenCalledWith('run-1', 'tok-clerk')
  })

  it('is RESERVED (disabled, no reuse claim) for a failed non-primitive step (qa)', () => {
    render(<RecoveryRail runId="run-1" agentRuns={rows('qa', { before: ['origin_story'] })} />)

    const btn = screen.getByRole('button', { name: 'Restart from this step' })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText(/reused, not re-paid/i)).toBeNull()
  })

  it('is RESERVED for editor_gate_1 by default (a failure is not a pause)', () => {
    render(<RecoveryRail runId="run-1" agentRuns={rows('editor_gate_1')} />)
    const btn = screen.getByRole('button', { name: 'Restart from this step' })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('is LIVE and routes to Signal Desk for editor_gate_1 when isPausedAtGate1 is true', () => {
    render(<RecoveryRail runId="run-1" agentRuns={rows('editor_gate_1')} isPausedAtGate1 />)
    const link = screen.getByRole('link', { name: 'Restart from this step' })
    expect(link.getAttribute('href')).toBe('/signal-desk')
  })
})

describe('RecoveryRail (WBN-03) — "Improve this agent"', () => {
  it('renders a live link to /prompt-lab/{agentKey} when the failed step has an externalized prompt', () => {
    render(<RecoveryRail runId="run-1" agentRuns={rows('game')} />)
    const link = screen.getByRole('link', { name: 'Improve this agent' })
    expect(link.getAttribute('href')).toBe('/prompt-lab/game')
  })

  it('renders a reserved control when the failed step has no externalized prompt (qa)', () => {
    render(<RecoveryRail runId="run-1" agentRuns={rows('qa')} />)
    const btn = screen.getByRole('button', { name: 'Improve this agent' })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })
})
