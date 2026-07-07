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
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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
