/**
 * Phase 39 (MEM-02, Plan 39-03 Task 1) — AddCorrectionDialog tests.
 *
 * Covers:
 *   - Submitting calls the mocked charityCorrections.append mutation exactly
 *     once with { workspace_id, charityKey: charity.dedupKey (passthrough,
 *     NOT re-derived), sanityCharityId, text }
 *   - Empty/whitespace text does not submit
 *   - A charity with no dedupKey (legacy row) disables the form with a note
 *     instead of re-deriving a key (Pitfall 5)
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('convex/react', () => ({
  useMutation: vi.fn(),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    charityCorrections: {
      append: 'charityCorrections:append',
    },
  },
}))

import { useMutation } from 'convex/react'
import AddCorrectionDialog from '../app/(dashboard)/registry/_components/AddCorrectionDialog'

afterEach(() => {
  cleanup()
})

let appendSpy: Mock

beforeEach(() => {
  vi.clearAllMocks()
  appendSpy = vi.fn(async () => 'correction-id')
  ;(useMutation as unknown as Mock).mockReturnValue(appendSpy)
})

const charity = {
  dedupKey: 'acme|acme.org',
  sanityCharityId: 'charity-acme',
  name: 'Acme Foundation',
}

describe('AddCorrectionDialog', () => {
  it('calls append with workspace_id, charityKey (dedupKey passthrough), sanityCharityId, and text', async () => {
    render(<AddCorrectionDialog workspace_id="eisenbalm" charity={charity} />)

    fireEvent.change(screen.getByLabelText(/add correction/i), {
      target: { value: 'Founder name is verified' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add correction/i }))

    await waitFor(() => {
      expect(appendSpy).toHaveBeenCalledTimes(1)
    })
    expect(appendSpy).toHaveBeenCalledWith({
      workspace_id: 'eisenbalm',
      charityKey: 'acme|acme.org',
      sanityCharityId: 'charity-acme',
      text: 'Founder name is verified',
    })
  })

  it('does not submit empty/whitespace text', () => {
    render(<AddCorrectionDialog workspace_id="eisenbalm" charity={charity} />)
    fireEvent.change(screen.getByLabelText(/add correction/i), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add correction/i }))
    expect(appendSpy).not.toHaveBeenCalled()
  })

  it('disables the form when the charity has no dedupKey (legacy row) — never re-derives a key', () => {
    render(
      <AddCorrectionDialog
        workspace_id="eisenbalm"
        charity={{ name: 'Legacy Charity' }}
      />,
    )
    expect(screen.queryByRole('button', { name: /add correction/i })).toBeNull()
    expect(screen.getByText(/predates dedup keys/i)).toBeDefined()
  })
})
