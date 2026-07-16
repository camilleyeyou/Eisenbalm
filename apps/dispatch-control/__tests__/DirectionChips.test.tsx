/**
 * Phase 45 (REV-02, docs/API_CONTRACTS.md §45.1) — DirectionChips tests.
 * Converts the Wave-0 (45-01) it.todo scaffold into real render/interaction
 * assertions (Plan 45-04 Task 2).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { DirectionChips } from '../components/revision/DirectionChips'

afterEach(() => {
  cleanup()
})

const LABELS = [
  'Make clearer',
  'Make more specific',
  'Tighten',
  'Match the brief',
  'Reduce repetition',
  'Try another approach',
  'Custom',
]

describe('DirectionChips (§45.1)', () => {
  it('renders exactly 7 fixed-copy chips: Make clearer / Make more specific / Tighten / Match the brief / Reduce repetition / Try another approach / Custom', () => {
    render(<DirectionChips onSelect={vi.fn()} />)

    for (const label of LABELS) {
      expect(screen.getByRole('button', { name: label })).toBeDefined()
    }
    expect(screen.getAllByRole('button')).toHaveLength(7)
  })

  it('never renders a bare "Regenerate" label (REV-02)', () => {
    render(<DirectionChips onSelect={vi.fn()} />)

    expect(screen.queryByText(/^regenerate$/i)).toBeNull()
  })

  it('Custom chip reveals a free-text input that is sent verbatim as customDirection', () => {
    const onSelect = vi.fn()
    render(<DirectionChips onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))

    const input = screen.getByLabelText(/custom direction/i)
    fireEvent.change(input, { target: { value: 'Make it sound like a shipping manifest.' } })
    fireEvent.click(screen.getByRole('button', { name: /use this direction/i }))

    expect(onSelect).toHaveBeenCalledWith('custom', 'Make it sound like a shipping manifest.')
  })

  it('every chip renders disabled-with-title when the cost guard has 409ed (D-14)', () => {
    render(<DirectionChips onSelect={vi.fn()} costCapped capInfo={{ spentUsd: 9.5, capUsd: 10 }} />)

    for (const label of LABELS) {
      const button = screen.getByRole('button', { name: label }) as HTMLButtonElement
      expect(button.disabled).toBe(true)
      expect(button.title).toMatch(/9\.50/)
      expect(button.title).toMatch(/10\.00/)
    }

    // Cost-capped: clicking Custom must not reveal the free-text input.
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
    expect(screen.queryByLabelText(/custom direction/i)).toBeNull()
  })
})
