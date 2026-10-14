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
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
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
    const fixButton = screen.getByRole('button', { name: /fix it in the editor/i })
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

describe('StoryFindingsRail — grouped cards (quick 261014-lbr)', () => {
  const dup = [
    { findingId: 'g1', sectionId: 'game', severity: 'error' as const, reason: 'Unsourced year.', quotedSpan: 'operating in that watershed since 2009' },
    { findingId: 'g2', sectionId: 'game', severity: 'error' as const, reason: 'Conflicts with research.', quotedSpan: 'Operating in that watershed since 2009' },
  ]
  it('collapses duplicate spans into one card with bulleted reasons', () => {
    render(<StoryFindingsRail resolved={[]} unresolved={dup} canAnnotate={false} onJump={vi.fn()} onFixInEditor={vi.fn()} />)
    expect(screen.getAllByText('Must fix')).toHaveLength(1)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText(/from 2 findings/)).toBeDefined()
  })
  it('canAnnotate=false shows Fix it in the editor, no Jump', () => {
    const onFix = vi.fn()
    render(<StoryFindingsRail resolved={[]} unresolved={dup} canAnnotate={false} onJump={vi.fn()} onFixInEditor={onFix} />)
    expect(screen.queryByRole('button', { name: /jump to it/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /fix it in the editor/i }))
    expect(onFix).toHaveBeenCalledWith('g1')
  })
  it('anchored group jumps to the anchored id; no anchor falls back to editor', () => {
    const onJump = vi.fn()
    const { unmount } = render(
      <StoryFindingsRail resolved={[resolvedFixture()]} unresolved={[]} onJump={onJump} onFixInEditor={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /jump to it/i }))
    expect(onJump).toHaveBeenCalledWith('f1')
    unmount()
    render(<StoryFindingsRail resolved={[]} unresolved={dup} onJump={onJump} onFixInEditor={vi.fn()} />)
    expect(screen.getByRole('button', { name: /fix it in the editor/i })).toBeDefined()
  })
  it('Apply fix only with suggestedFix + canAnnotate; passes all members', async () => {
    const withFix = dup.map(d => ({ ...d, suggestedFix: 'since 2011' }))
    const onApplyFix = vi.fn().mockResolvedValue({ note: null })
    const { unmount } = render(
      <StoryFindingsRail resolved={[]} unresolved={withFix} onJump={vi.fn()} onFixInEditor={vi.fn()} onApplyFix={onApplyFix} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /apply fix/i }))
    await waitFor(() => expect(onApplyFix).toHaveBeenCalled())
    expect(onApplyFix.mock.calls[0][0].map((m: { findingId: string }) => m.findingId)).toEqual(['g1', 'g2'])
    unmount()
    render(
      <StoryFindingsRail resolved={[]} unresolved={withFix} canAnnotate={false} onJump={vi.fn()} onFixInEditor={vi.fn()} onApplyFix={onApplyFix} />,
    )
    expect(screen.queryByRole('button', { name: /apply fix/i })).toBeNull()
    cleanup()
    render(<StoryFindingsRail resolved={[]} unresolved={dup} onJump={vi.fn()} onFixInEditor={vi.fn()} onApplyFix={onApplyFix} />)
    expect(screen.queryByRole('button', { name: /apply fix/i })).toBeNull()
  })
  it('Dismiss needs a reason and dismisses every id', async () => {
    const onDismiss = vi.fn().mockResolvedValue({ note: null })
    render(<StoryFindingsRail resolved={[]} unresolved={dup} onJump={vi.fn()} onFixInEditor={vi.fn()} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    const confirm = screen.getByRole('button', { name: /confirm dismiss/i }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText(/why\?/i), { target: { value: 'fine as is' } })
    fireEvent.click(confirm)
    await waitFor(() => expect(onDismiss).toHaveBeenCalledWith(['g1', 'g2'], 'fine as is'))
  })
})
