/**
 * Phase 32 (GLY-05, D-03, Plan 32-01 Wave 0 RED) — SectionChipList `counts`
 * upgrade tests.
 *
 * D-03: "The existing SectionChipList upgrades in place into the design's
 * chip strip: per-section finding counts (severity-aware, open findings
 * only)." This file extends the Phase 31 `SectionChipList.tsx` component
 * test coverage (same import path — the component is upgraded IN PLACE,
 * not replaced) with the new `counts` contract.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 *
 * RED at authoring time: the current Phase 31 `SectionChipList` ignores an
 * unknown `counts` prop entirely — no numeric badge or unresolved marker
 * renders yet. Turns GREEN in Plan 32-07.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import SectionChipList from '../app/(dashboard)/review-desk/[runId]/_components/SectionChipList'

afterEach(() => {
  cleanup()
})

describe('SectionChipList — counts prop (Phase 32 GLY-05 upgrade)', () => {
  it('shows the numeric open-finding count on the matching chip', () => {
    const counts: Record<string, { open: number; unresolved: number }> = {
      originStory: { open: 3, unresolved: 1 },
      problemStatement: { open: 0, unresolved: 0 },
    }

    render(<SectionChipList selected="originStory" onSelect={vi.fn()} counts={counts} />)

    const chip = screen.getByText('Origin Story').closest('button')
    expect(chip).not.toBeNull()
    expect(chip?.textContent).toContain('3')
  })

  it('marks a chip with an open unresolved finding via a data-unresolved attribute', () => {
    const counts: Record<string, { open: number; unresolved: number }> = {
      originStory: { open: 2, unresolved: 1 },
    }

    const { container } = render(
      <SectionChipList selected="originStory" onSelect={vi.fn()} counts={counts} />,
    )

    expect(container.querySelector('[data-unresolved="true"]')).not.toBeNull()
  })

  it('shows no count badge for a section with zero open findings', () => {
    const counts: Record<string, { open: number; unresolved: number }> = {
      originStory: { open: 0, unresolved: 0 },
    }

    render(<SectionChipList selected="originStory" onSelect={vi.fn()} counts={counts} />)

    const chip = screen.getByText('Origin Story').closest('button')
    expect(chip?.querySelector('[data-testid="chip-count"]')).toBeNull()
  })

  it('clicking a chip still calls onSelect with that section id (existing contract preserved)', () => {
    const onSelect = vi.fn()
    render(<SectionChipList selected="originStory" onSelect={onSelect} counts={{}} />)

    fireEvent.click(screen.getByText('Problem').closest('button')!)
    expect(onSelect).toHaveBeenCalledWith('problemStatement')
  })
})
