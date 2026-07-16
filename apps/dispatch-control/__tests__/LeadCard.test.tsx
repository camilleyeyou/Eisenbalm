/**
 * Phase 47 (BRF-01) — LeadCard behavior tests.
 *
 * `LeadCard` reads the Phase-46 `storyLeads:byRunId` Convex query and must
 * render every field IN FULL — premise, the dated peg + `pegSourceUrl` link,
 * readerEnergy, charitableAngle, category, confidence, and (when present)
 * the brandRiskReason warning — never truncated, never tooltip-hidden. This
 * mirrors the exact never-truncated `primaryConcern` discipline established
 * in `__tests__/CandidateSlate.test.tsx` (Phase 37, SIG-01).
 *
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { LeadCard, type StoryLead } from '../app/(dashboard)/story-brief/_components/LeadCard'

afterEach(() => {
  cleanup()
})

/**
 * Reusable never-truncated tripwire — copied verbatim from
 * `CandidateSlate.test.tsx`'s inline assertion pair.
 */
function assertNeverTruncated(el: { textContent: string | null; className: string }, longText: string) {
  expect(el.textContent).toBe(longText)
  expect(el.className).not.toMatch(/line-clamp|truncate/)
}

function baseLead(overrides: Partial<StoryLead> = {}): StoryLead {
  return {
    _id: 'lead-1',
    premise: 'A quiet food bank has quietly fed a third of the county for a decade.',
    datedPeg: 'Their annual harvest drive starts next Tuesday.',
    pegSourceUrl: 'https://example.com/harvest-drive-announcement',
    readerEnergy: 'Quiet resolve',
    charitableAngle: 'Hunger relief, hyper-local',
    category: 'Food security',
    confidence: 'High',
    brandRiskFlag: false,
    recommended: false,
    ...overrides,
  }
}

describe('LeadCard (BRF-01)', () => {
  it('renders the premise field in full', () => {
    const lead = baseLead()
    render(
      <ul>
        <LeadCard lead={lead} />
      </ul>,
    )
    expect(screen.getByTestId(`lead-premise-${lead._id}`).textContent).toBe(lead.premise)
  })

  it('renders the dated peg (datedPeg) and a pegSourceUrl link that is a REAL, sourced URL', () => {
    const lead = baseLead()
    render(
      <ul>
        <LeadCard lead={lead} />
      </ul>,
    )
    expect(screen.getByTestId(`lead-peg-${lead._id}`).textContent).toContain(lead.datedPeg)
    const link = screen.getByTestId(`lead-peg-source-${lead._id}`) as HTMLAnchorElement
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe(lead.pegSourceUrl)
  })

  it('renders readerEnergy, charitableAngle, category, and confidence', () => {
    const lead = baseLead()
    render(
      <ul>
        <LeadCard lead={lead} />
      </ul>,
    )
    expect(screen.getByTestId(`lead-reader-energy-${lead._id}`).textContent).toBe(lead.readerEnergy)
    expect(screen.getByTestId(`lead-angle-${lead._id}`).textContent).toBe(lead.charitableAngle)
    expect(screen.getByTestId(`lead-confidence-${lead._id}`).textContent).toBe(lead.confidence)
    expect(screen.getByText(lead.category)).toBeDefined()
  })

  it('when brandRiskFlag is true, renders the brandRiskReason warning IN FULL — className must not match /line-clamp|truncate/', () => {
    const longWarning =
      'This organization received unfavorable local press coverage in 2019 over a ' +
      'leadership dispute that was never fully resolved, and any coverage of them now ' +
      'risks resurfacing that dispute in a way that would require careful, full-context ' +
      'framing rather than a single clipped sentence buried under a tooltip.'
    const lead = baseLead({ brandRiskFlag: true, brandRiskReason: longWarning })
    render(
      <ul>
        <LeadCard lead={lead} />
      </ul>,
    )
    const el = screen.getByTestId(`brand-risk-reason-${lead._id}`)
    assertNeverTruncated(el, longWarning)
    expect(el.hasAttribute('title')).toBe(false)
  })

  it('when brandRiskFlag is false, renders no brand-risk warning at all', () => {
    const lead = baseLead({ brandRiskFlag: false, brandRiskReason: undefined })
    render(
      <ul>
        <LeadCard lead={lead} />
      </ul>,
    )
    expect(screen.queryByTestId(`brand-risk-reason-${lead._id}`)).toBeNull()
  })

  it('renders the repetitionWarning advisory when present, without suppressing the lead card', () => {
    const lead = baseLead({ repetitionWarning: 'A similar hunger-relief story ran two issues ago.' })
    render(
      <ul>
        <LeadCard lead={lead} />
      </ul>,
    )
    expect(screen.getByTestId(`lead-repetition-warning-${lead._id}`).textContent).toBe(
      lead.repetitionWarning,
    )
    // The rest of the card still renders — repetitionWarning is additive, not exclusive.
    expect(screen.getByTestId(`lead-premise-${lead._id}`).textContent).toBe(lead.premise)
  })
})
