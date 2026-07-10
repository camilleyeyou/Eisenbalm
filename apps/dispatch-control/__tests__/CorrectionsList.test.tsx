/**
 * Phase 39 (MEM-02, Plan 39-03 Task 1) — CorrectionsList tests.
 *
 * Covers:
 *   - Corrections render in chronological (createdAt asc) order — oldest
 *     first — the query already returns ascending order, the component must
 *     not reverse it
 *   - A loading (undefined) state renders a loading affordance
 *   - An empty ([]) state renders an honest empty message
 *   - No edit/delete/remove control exists anywhere — read-only, append-only
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    charityCorrections: {
      listByCharityKey: 'charityCorrections:listByCharityKey',
    },
  },
}))

import { useQuery } from 'convex/react'
import CorrectionsList from '../app/(dashboard)/registry/_components/CorrectionsList'

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
})

const olderCorrection = {
  _id: 'corr-1',
  text: 'Founder name corrected to Jane Doe.',
  author: 'andrew',
  createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
}

const newerCorrection = {
  _id: 'corr-2',
  text: 'Website updated to new domain.',
  author: 'andrew',
  createdAt: Date.now() - 1 * 60 * 60 * 1000,
}

describe('CorrectionsList', () => {
  it('renders corrections in chronological (createdAt asc) order — oldest first', () => {
    ;(useQuery as unknown as Mock).mockReturnValue([olderCorrection, newerCorrection])
    render(<CorrectionsList workspace_id="eisenbalm" charityKey="acme|acme.org" />)

    const older = screen.getByText(olderCorrection.text)
    const newer = screen.getByText(newerCorrection.text)
    // DOCUMENT_POSITION_FOLLOWING: the newer correction comes after the older one.
    expect(
      older.compareDocumentPosition(newer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('shows a loading affordance while the query is undefined', () => {
    ;(useQuery as unknown as Mock).mockReturnValue(undefined)
    render(<CorrectionsList workspace_id="eisenbalm" charityKey="acme|acme.org" />)
    expect(screen.getByText(/loading/i)).toBeDefined()
  })

  it('shows an honest empty message when there are no corrections', () => {
    ;(useQuery as unknown as Mock).mockReturnValue([])
    render(<CorrectionsList workspace_id="eisenbalm" charityKey="acme|acme.org" />)
    expect(screen.getByText(/no corrections yet/i)).toBeDefined()
  })

  it('renders no edit/delete/remove control anywhere — read-only, append-only', () => {
    ;(useQuery as unknown as Mock).mockReturnValue([olderCorrection, newerCorrection])
    render(<CorrectionsList workspace_id="eisenbalm" charityKey="acme|acme.org" />)
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull()
  })
})
