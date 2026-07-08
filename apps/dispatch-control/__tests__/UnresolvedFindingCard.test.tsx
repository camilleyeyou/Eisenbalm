/**
 * Phase 32 (GLY-02, D-09, Plan 32-01 Wave 0 RED) — UnresolvedFindingCard tests.
 *
 * D-09: "A finding whose anchor fails renders as a visible 'unresolved'
 * card at the end of its section (showing full reason + original quoted
 * text)" — GLY-02's success-criterion phrasing to honor literally: findings
 * that fail to resolve are "visibly marked 'unresolved' — never silently
 * dropped or mis-rendered."
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 *
 * RED at authoring time:
 * `../app/(dashboard)/review-desk/[runId]/_components/UnresolvedFindingCard`
 * does not exist yet. Turns GREEN in Plan 32-06/32-07.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

// Phase 33 (D-11): the card gains Dismiss + Edit inline actions that need
// Clerk's getToken and the findings client — mocked here.
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@/lib/findingsClient', () => {
  class FindingsError extends Error {
    constructor(
      public readonly status: number,
      public readonly reason: string,
      message: string,
    ) {
      super(message)
      this.name = 'FindingsError'
    }
  }
  return {
    FindingsError,
    acceptFinding: vi.fn(),
    dismissFinding: vi.fn(async () => ({ findingId: 'f1', resolution: 'dismissed' })),
    reopenFinding: vi.fn(),
  }
})

import { dismissFinding } from '@/lib/findingsClient'
import UnresolvedFindingCard from '../app/(dashboard)/review-desk/[runId]/_components/UnresolvedFindingCard'

afterEach(() => {
  cleanup()
})

const finding = {
  findingId: 'f1',
  sectionId: 'originStory',
  severity: 'error' as const,
  axis: 'gravity',
  reason: "This claim overstates the charity's reach without evidence.",
  quotedSpan: 'the missing text',
  suggestedFix: 'Cite a specific source.',
}

describe('UnresolvedFindingCard', () => {
  it('renders the full reason text verbatim', () => {
    render(<UnresolvedFindingCard finding={finding} />)
    expect(screen.getByText(finding.reason)).toBeDefined()
  })

  it('renders the original quoted-span text verbatim', () => {
    render(<UnresolvedFindingCard finding={finding} />)
    expect(screen.getByText(finding.quotedSpan)).toBeDefined()
  })

  it('carries an "unresolved" label/marker so the finding is never silently dropped', () => {
    render(<UnresolvedFindingCard finding={finding} />)
    expect(screen.getByText(/unresolved/i)).toBeDefined()
  })

  it('renders correctly even when quotedSpan/axis/suggestedFix are absent', () => {
    render(
      <UnresolvedFindingCard
        finding={{
          findingId: 'f2',
          sectionId: 'problemStatement',
          severity: 'warning',
          reason: 'A minor factual nit with no quotable anchor.',
        }}
      />,
    )
    expect(screen.getByText('A minor factual nit with no quotable anchor.')).toBeDefined()
    expect(screen.getByText(/unresolved/i)).toBeDefined()
  })
})

describe('UnresolvedFindingCard actions (Phase 33, D-11)', () => {
  function renderWithActions() {
    const onEditSection = vi.fn()
    render(
      <UnresolvedFindingCard
        finding={finding}
        runId="run-1"
        sectionId="originStory"
        onEditSection={onEditSection}
      />,
    )
    return { onEditSection }
  }

  it('offers Dismiss and Edit inline — but NO Accept (D-07: orphans cannot be auto-applied)', () => {
    renderWithActions()

    expect(screen.getByRole('button', { name: /^dismiss$/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /edit inline/i })).toBeDefined()
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull()
  })

  it('Edit inline calls onEditSection(sectionId, findingId)', () => {
    const { onEditSection } = renderWithActions()

    fireEvent.click(screen.getByRole('button', { name: /edit inline/i }))

    expect(onEditSection).toHaveBeenCalledWith('originStory', 'f1')
  })

  it('Dismiss requires a non-empty reason before it will submit', async () => {
    renderWithActions()

    fireEvent.click(screen.getByRole('button', { name: /^dismiss$/i }))

    const submit = screen.getByRole('button', { name: /confirm dismiss/i }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/dismissal reason/i), {
      target: { value: 'Anchor is stale; text already rewritten.' },
    })
    expect(
      (screen.getByRole('button', { name: /confirm dismiss/i }) as HTMLButtonElement).disabled,
    ).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /confirm dismiss/i }))
    await waitFor(() => {
      expect(dismissFinding).toHaveBeenCalledWith(
        'run-1',
        'f1',
        { reason: 'Anchor is stale; text already rewritten.' },
        'tok-clerk',
      )
    })
  })

  it('renders no action buttons when the action context props are absent (read-only fallback)', () => {
    render(<UnresolvedFindingCard finding={finding} />)
    expect(screen.queryByRole('button', { name: /^dismiss$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /edit inline/i })).toBeNull()
  })
})
