/**
 * Phase 41 (WSP-07, Plan 41-07 Task 2) — FactCheckPlaceholder tests.
 *
 * D-11/D-12 guard: the Stage 3 placeholder must NEVER show a blank or a fake
 * "verified"/"complete" state — only the honest, data-backed coverage the
 * DecisionRail's Verification block already computes.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { useQuery } from 'convex/react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    claimChecks: { listByRunId: 'claimChecks:listByRunId' },
  },
}))

import FactCheckPlaceholder from '../app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPlaceholder'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('FactCheckPlaceholder (WSP-07 — never blank, never fake-verified)', () => {
  it('renders "No claims extracted yet" and no verified/complete wording when zero claim rows exist', () => {
    ;(useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue([])

    render(<FactCheckPlaceholder runId="run-1" />)

    expect(screen.getByText(/no claims extracted yet/i)).toBeDefined()
    expect(screen.queryByText(/verified/i)).toBeNull()
    expect(screen.queryByText(/\bcomplete\b/i)).toBeNull()
  })

  it('renders "checked 2 of 5" coverage with 2 checked of 5 claims, never a blank region', () => {
    ;(useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
      { claimIndex: 0, text: 'Claim A', status: 'checked', checkedAt: Date.now() },
      { claimIndex: 1, text: 'Claim B', status: 'checked', checkedAt: Date.now() },
      { claimIndex: 2, text: 'Claim C', status: 'pending' },
      { claimIndex: 3, text: 'Claim D', status: 'pending' },
      { claimIndex: 4, text: 'Claim E', status: 'pending' },
    ])

    render(<FactCheckPlaceholder runId="run-1" />)

    expect(screen.getByText(/checked 2 of 5/i)).toBeDefined()
    expect(screen.getByText(/3 unchecked/i)).toBeDefined()
    // The claim rows themselves render (never a blank list region).
    expect(screen.getByText('Claim A')).toBeDefined()
    expect(screen.getByText('Claim E')).toBeDefined()
  })
})
