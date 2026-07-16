/**
 * Phase 45 (REV-03, docs/API_CONTRACTS.md §45.3) — RevisionComparisonCard
 * tests. Converts the Wave-0 (45-01) it.todo scaffold into real
 * render/interaction assertions (Plan 45-04 Task 2).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import {
  RevisionComparisonCard,
  type RevisionComparisonCardProps,
} from '../components/revision/RevisionComparisonCard'
import type { RevisePreviewResult } from '../lib/revisionClient'

afterEach(() => {
  cleanup()
})

const basePreview: RevisePreviewResult = {
  proposedText: 'a former county clerk',
  whatChanged: 'Replaced unverifiable characterization with a sourced biographical fact.',
  claimDelta: { added: [], removed: [], altered: ['founder occupation'] },
}

function renderCard(overrides: Partial<RevisionComparisonCardProps> = {}) {
  return render(
    <RevisionComparisonCard
      original="a mysterious stranger"
      preview={basePreview}
      onApply={vi.fn()}
      onEdit={vi.fn()}
      onTryAnother={vi.fn()}
      onDiscard={vi.fn()}
      {...overrides}
    />,
  )
}

describe('RevisionComparisonCard (§45.3)', () => {
  it('shows the original (strikethrough) passage alongside the proposed replacement', () => {
    renderCard()

    const original = screen.getByText('a mysterious stranger')
    expect(original.className).toMatch(/line-through/)
    expect(screen.getByText('a former county clerk')).toBeDefined()
  })

  it('renders the "What changed" line from whatChanged', () => {
    renderCard()

    expect(screen.getByText(/replaced unverifiable characterization/i)).toBeDefined()
  })

  it('renders the claim delta (added/removed/altered) as advisory narrative, never enforced state', () => {
    renderCard()

    expect(screen.getByText(/altered:/i)).toBeDefined()
    expect(screen.getByText(/founder occupation/i)).toBeDefined()

    // Empty delta -> explicit "no claims" line, never a blank/omitted block.
    cleanup()
    renderCard({ preview: { ...basePreview, claimDelta: { added: [], removed: [], altered: [] } } })
    expect(screen.getByText(/no claims added, removed, or altered/i)).toBeDefined()
  })

  it('Apply / Edit before applying / Try another approach / Discard are all present', () => {
    renderCard()

    expect(screen.getByRole('button', { name: 'Apply' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Edit before applying' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Try another approach' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDefined()
  })

  it('Apply calls onApply', () => {
    const onApply = vi.fn()
    renderCard({ onApply })

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalled()
  })

  it('Edit before applying reveals a textarea prefilled with proposedText and onEdit receives the edited text', () => {
    const onEdit = vi.fn()
    renderCard({ onEdit })

    fireEvent.click(screen.getByRole('button', { name: 'Edit before applying' }))
    const textarea = screen.getByLabelText(/edit proposed text/i) as HTMLTextAreaElement
    expect(textarea.value).toBe('a former county clerk')

    fireEvent.change(textarea, { target: { value: 'a former county clerk from Berkeley County' } })
    fireEvent.click(screen.getByRole('button', { name: /apply edited text/i }))

    expect(onEdit).toHaveBeenCalledWith('a former county clerk from Berkeley County')
  })

  it('Try another approach calls onTryAnother', () => {
    const onTryAnother = vi.fn()
    renderCard({ onTryAnother })

    fireEvent.click(screen.getByRole('button', { name: 'Try another approach' }))
    expect(onTryAnother).toHaveBeenCalled()
  })

  it('Discard calls onDiscard', () => {
    const onDiscard = vi.fn()
    renderCard({ onDiscard })

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onDiscard).toHaveBeenCalled()
  })
})
