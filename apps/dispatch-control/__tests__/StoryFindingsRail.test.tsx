/**
 * quick 260730-i4j (Task 3d) — StoryFindingsRail: the story-scoped
 * open-findings rail rendered inside the Draft canvas.
 *
 * Pure fixture test — no Convex, no fetch (the component takes only
 * `resolved`/`unresolved` + callbacks).
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import StoryFindingsRail from '../app/(dashboard)/review-desk/[runId]/_components/StoryFindingsRail'
import type { ResolvedAnnotation } from '../lib/galley/spanResolver'

afterEach(() => {
  cleanup()
})

function resolvedFixture(overrides: Partial<ResolvedAnnotation> = {}): ResolvedAnnotation {
  return {
    findingId: 'f1',
    sectionId: 'founderBio',
    blockIndex: 0,
    start: 0,
    end: 10,
    severity: 'error',
    reason: 'The source interview gives 1963.',
    quotedSpan: 'was born in 1961',
    ...overrides,
  }
}

describe('StoryFindingsRail — zero findings', () => {
  it('renders null — the rail is not rendered, not collapsed', () => {
    const { container } = render(
      <StoryFindingsRail resolved={[]} unresolved={[]} onJump={vi.fn()} onFixInEditor={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })
})

describe('StoryFindingsRail — 2 findings', () => {
  it('renders both with severity chip, quoted span, why line, and Jump to it; header reads the count', () => {
    const onJump = vi.fn()
    render(
      <StoryFindingsRail
        resolved={[
          resolvedFixture(),
          resolvedFixture({
            findingId: 'f2',
            severity: 'warning',
            axis: 'gravity',
            reason: 'Promotional register.',
            quotedSpan: 'a truly remarkable piece of work',
          }),
        ]}
        unresolved={[]}
        onJump={onJump}
        onFixInEditor={vi.fn()}
      />,
    )

    expect(screen.getByText('2')).toBeDefined()
    expect(screen.getByText('Must fix')).toBeDefined()
    expect(screen.getByText('Voice')).toBeDefined()
    expect(screen.getByText(/was born in 1961/)).toBeDefined()
    expect(screen.getByText('The source interview gives 1963.')).toBeDefined()

    const jumpButtons = screen.getAllByRole('button', { name: /jump to it/i })
    expect(jumpButtons).toHaveLength(2)
    jumpButtons[0]?.click()
    expect(onJump).toHaveBeenCalledWith('f1')
  })
})

describe('StoryFindingsRail — unresolved finding with no quotedSpan', () => {
  it('renders "Fix in editor" instead of "Jump to it" — never a blank row', () => {
    const onFixInEditor = vi.fn()
    render(
      <StoryFindingsRail
        resolved={[]}
        unresolved={[{ findingId: 'u1', severity: 'warning', reason: 'Unsourced statistic.' }]}
        onJump={vi.fn()}
        onFixInEditor={onFixInEditor}
      />,
    )

    expect(screen.getByText('Unsourced statistic.')).toBeDefined()
    expect(screen.queryByRole('button', { name: /jump to it/i })).toBeNull()
    const fixButton = screen.getByRole('button', { name: /fix in editor/i })
    fixButton.click()
    expect(onFixInEditor).toHaveBeenCalledWith('u1')
  })
})

describe('StoryFindingsRail — non-voice warning axis', () => {
  it('renders the "Review" chip (neither Must fix nor Voice)', () => {
    render(
      <StoryFindingsRail
        resolved={[]}
        unresolved={[
          {
            findingId: 'u2',
            severity: 'warning',
            axis: 'precision',
            reason: 'Check this stat.',
            quotedSpan: 'eleven districts',
          },
        ]}
        onJump={vi.fn()}
        onFixInEditor={vi.fn()}
      />,
    )
    expect(screen.getByText('Review')).toBeDefined()
  })
})
