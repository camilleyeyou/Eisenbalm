/**
 * Phase 41 Plan 41-05 (WSP-02/WSP-07) — WorkspaceOutline tests.
 *
 * The outline's 5-state per-section vocabulary (clean/review/must-fix/
 * changed-since-review/not-generated) and the blocker-fix guard: while
 * `useWorkspaceState().sectionStates` is `undefined` (the authoritative
 * draft is still loading/unavailable), the outline MUST show a loading
 * state — never a wall of "not generated" rows silently inferred from an
 * empty set.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { SectionState } from '@/lib/derivedState'

vi.mock('../app/(dashboard)/issues/_components/WorkspaceStateProvider', () => ({
  useWorkspaceState: vi.fn(),
}))

import { useWorkspaceState } from '../app/(dashboard)/issues/_components/WorkspaceStateProvider'
import WorkspaceOutline from '../app/(dashboard)/issues/_components/WorkspaceOutline'
import { EDITABLE_SECTIONS } from '../app/(dashboard)/review-desk/[runId]/_components/SectionChipList'

type SectionStatesMap = Record<string, { state: SectionState; openCount: number }>

function mockSectionStates(sectionStates: SectionStatesMap | undefined) {
  ;(useWorkspaceState as unknown as Mock).mockReturnValue({ sectionStates })
}

/** All sections at a given state — a convenient all-clean/all-not-generated base. */
function allSections(state: SectionState): SectionStatesMap {
  return Object.fromEntries(EDITABLE_SECTIONS.map(s => [s.id, { state, openCount: 0 }]))
}

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom does not implement scrollIntoView — stub it once per test.
  Element.prototype.scrollIntoView = vi.fn()
  const anchor = document.createElement('div')
  anchor.id = 'galley-originStory'
  document.body.appendChild(anchor)
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

// ── (a) every EDITABLE_SECTIONS id renders a row when sectionStates is defined ──

describe('WorkspaceOutline rows (WSP-02)', () => {
  it('renders one row per EDITABLE_SECTIONS entry when sectionStates is defined', () => {
    mockSectionStates(allSections('clean'))
    render(<WorkspaceOutline />)
    for (const section of EDITABLE_SECTIONS) {
      expect(screen.getByTestId(`outline-row-${section.id}`)).toBeDefined()
    }
  })
})

// ── (b)/(c) not-generated is a visible marker; clean is never mislabeled (WSP-07 + blocker guard) ──

describe('WorkspaceOutline "not generated" marker (WSP-07)', () => {
  it('shows a visible "not generated" marker for a not-generated section — never blank', () => {
    const sectionStates = allSections('clean')
    sectionStates.game = { state: 'not-generated', openCount: 0 }
    mockSectionStates(sectionStates)
    render(<WorkspaceOutline />)

    const row = screen.getByTestId('outline-row-game')
    expect(row.textContent).toMatch(/not generated/i)
    expect(row.textContent?.trim().length).toBeGreaterThan(0)
  })

  it('renders a clean mark for a clean section and NOT the "not generated" text (blocker guard)', () => {
    const sectionStates = allSections('not-generated')
    sectionStates.originStory = { state: 'clean', openCount: 0 }
    mockSectionStates(sectionStates)
    render(<WorkspaceOutline />)

    const row = screen.getByTestId('outline-row-originStory')
    expect(row.textContent).toMatch(/clean/i)
    expect(row.textContent).not.toMatch(/not generated/i)
  })
})

// ── (d) must-fix renders the "Must fix" label ──────────────────────────────

describe('WorkspaceOutline must-fix state', () => {
  it('shows a "Must fix" label for a must-fix section', () => {
    const sectionStates = allSections('clean')
    sectionStates.problemStatement = { state: 'must-fix', openCount: 2 }
    mockSectionStates(sectionStates)
    render(<WorkspaceOutline />)

    const row = screen.getByTestId('outline-row-problemStatement')
    expect(row.textContent).toMatch(/must fix/i)
  })
})

// ── (e) sectionStates undefined -> loading state, never a wall of "not generated" ──

describe('WorkspaceOutline loading state (blocker fix)', () => {
  it('renders a loading state — never a wall of "not generated" rows — while sectionStates is undefined', () => {
    mockSectionStates(undefined)
    render(<WorkspaceOutline />)

    expect(screen.getByTestId('outline-loading')).toBeDefined()
    for (const section of EDITABLE_SECTIONS) {
      expect(screen.queryByTestId(`outline-row-${section.id}`)).toBeNull()
    }
  })
})

// ── (f) clicking a row jumps to the galley anchor ───────────────────────────

describe('WorkspaceOutline jump-to-section', () => {
  it('scrolls the galley to the clicked section anchor', () => {
    mockSectionStates(allSections('clean'))
    render(<WorkspaceOutline />)

    fireEvent.click(screen.getByTestId('outline-row-originStory'))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    })
  })
})

// ── Legend (label + icon vocabulary, always visible) ────────────────────────

describe('WorkspaceOutline legend', () => {
  it('always renders all five state labels, even ones this phase never produces', () => {
    mockSectionStates(allSections('clean'))
    render(<WorkspaceOutline />)

    expect(screen.getByTestId('outline-legend-clean')).toBeDefined()
    expect(screen.getByTestId('outline-legend-review')).toBeDefined()
    expect(screen.getByTestId('outline-legend-must-fix')).toBeDefined()
    expect(screen.getByTestId('outline-legend-changed-since-review')).toBeDefined()
    expect(screen.getByTestId('outline-legend-not-generated')).toBeDefined()
  })
})
