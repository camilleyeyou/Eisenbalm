/**
 * Quick 260724-x4b (Fix 3, LD-3) — StoryDeskGrid open-vs-edit tests.
 *
 * A normal card click opens the section read-only (`onOpen`); the discrete
 * "Edit →" affordance jumps straight into edit mode (`onOpenEdit`) — the two
 * never fire together (stopPropagation on the Edit button).
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { EDITABLE_SECTIONS } from '../app/(dashboard)/review-desk/[runId]/_components/SectionChipList'
import StoryDeskGrid from '../app/(dashboard)/review-desk/[runId]/_components/StoryDeskGrid'
import type { DraftResponse } from '@/lib/contentPatchClient'

const sectionId = EDITABLE_SECTIONS[0]!.id // 'originStory'

function buildDraft(): DraftResponse {
  return {
    revisionId: 'rev-1',
    sections: {},
    theme: {},
    game: {},
    bonus: {},
    bonusType: 'specAd',
    podcast: {},
    conversation: [],
  }
}

afterEach(() => {
  cleanup()
})

describe('StoryDeskGrid (LD-3)', () => {
  it('clicking a card opens the section read-only (onOpen), never onOpenEdit', () => {
    const onOpen = vi.fn()
    const onOpenEdit = vi.fn()
    render(
      <StoryDeskGrid
        draft={buildDraft()}
        chipCounts={{}}
        onOpen={onOpen}
        onOpenEdit={onOpenEdit}
      />,
    )

    fireEvent.click(screen.getByTestId(`story-card-${sectionId}`))
    expect(onOpen).toHaveBeenCalledWith(sectionId)
    expect(onOpenEdit).not.toHaveBeenCalled()
  })

  it('clicking the "Edit →" affordance jumps straight into edit mode (onOpenEdit), never onOpen', () => {
    const onOpen = vi.fn()
    const onOpenEdit = vi.fn()
    render(
      <StoryDeskGrid
        draft={buildDraft()}
        chipCounts={{}}
        onOpen={onOpen}
        onOpenEdit={onOpenEdit}
      />,
    )

    fireEvent.click(screen.getByTestId(`story-card-edit-${sectionId}`))
    expect(onOpenEdit).toHaveBeenCalledWith(sectionId)
    expect(onOpen).not.toHaveBeenCalled()
  })
})
