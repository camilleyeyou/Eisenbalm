/**
 * Phase 37 (SIG-03, Plan 37-05 Task 3) — AdjudicationPanel behavior tests.
 *
 * Covers:
 *   - Renders the top candidates side-by-side.
 *   - Selecting a candidate + typing a non-empty reason enables Submit.
 *   - Submit is disabled when reason is empty (even with a pick).
 *   - Submit calls the centralized `adjudicateGate1` client with
 *     {selection:{charityName}, reason} — never a hand-rolled fetch.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@/lib/pipelineControlClient', () => ({
  adjudicateGate1: vi.fn(async () => ({ runId: 'run-1', resumed: true })),
}))

import { adjudicateGate1 } from '@/lib/pipelineControlClient'
import { AdjudicationPanel } from '../app/(dashboard)/signal-desk/_components/AdjudicationPanel'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const CANDIDATES = [
  { charityName: 'Acme Foundation', advocateScore: 8 },
  { charityName: 'Beacon Trust', advocateScore: 6 },
]

describe('AdjudicationPanel (SIG-03)', () => {
  it('renders the candidates side by side', () => {
    render(<AdjudicationPanel runId="run-1" candidates={CANDIDATES} />)

    expect(screen.getByText(/Acme Foundation/)).toBeDefined()
    expect(screen.getByText(/Beacon Trust/)).toBeDefined()
    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })

  it('disables Submit until a pick AND a non-empty reason both exist', () => {
    render(<AdjudicationPanel runId="run-1" candidates={CANDIDATES} />)

    const submit = screen.getByRole('button', { name: /resume run/i })
    expect(submit.hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByRole('radio', { name: /Acme Foundation/i }))
    expect(submit.hasAttribute('disabled')).toBe(true) // still no reason

    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: 'Best fit for this week.' },
    })
    expect(submit.hasAttribute('disabled')).toBe(false)
  })

  it('keeps Submit disabled when reason is emptied back out after a pick', () => {
    render(<AdjudicationPanel runId="run-1" candidates={CANDIDATES} />)

    fireEvent.click(screen.getByRole('radio', { name: /Acme Foundation/i }))
    const reasonField = screen.getByLabelText(/reason/i)
    fireEvent.change(reasonField, { target: { value: 'Good reason.' } })
    fireEvent.change(reasonField, { target: { value: '   ' } }) // whitespace only

    expect(screen.getByRole('button', { name: /resume run/i }).hasAttribute('disabled')).toBe(
      true,
    )
  })

  it('submits the pick + reason via the centralized adjudicateGate1 client', async () => {
    render(<AdjudicationPanel runId="run-1" candidates={CANDIDATES} />)

    fireEvent.click(screen.getByRole('radio', { name: /Beacon Trust/i }))
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: 'Stronger local impact.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /resume run/i }))

    await waitFor(() => {
      expect(adjudicateGate1).toHaveBeenCalledWith(
        'run-1',
        { selection: { charityName: 'Beacon Trust' }, reason: 'Stronger local impact.' },
        'tok-clerk',
      )
    })
    expect(screen.getByRole('status').textContent).toContain('Beacon Trust')
  })
})
