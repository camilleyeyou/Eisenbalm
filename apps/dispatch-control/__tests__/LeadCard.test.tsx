/**
 * Phase 47 (BRF-01) — LeadCard Wave-0 scaffold.
 *
 * `LeadCard` reads the Phase-46 `storyLeads:byRunId` Convex query and must
 * render every field IN FULL — premise, the dated peg + `pegSourceUrl` link,
 * readerEnergy, charitableAngle, category, confidence, and (when present)
 * the brandRiskReason warning — never truncated, never tooltip-hidden. This
 * mirrors the exact never-truncated `primaryConcern` discipline established
 * in `__tests__/CandidateSlate.test.tsx` (Phase 37, SIG-01).
 *
 * This is a COLLECTIBLE Wave-0 scaffold (47-01) — `LeadCard` does not exist
 * yet, so every case is `it.todo`. The implementing plan (47-05,
 * workspace-subscriptions-lead-card-actions) fills these in with real
 * render() assertions and removes the `.todo`.
 *
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import { describe, it, expect } from 'vitest'

/**
 * Reusable never-truncated tripwire — copied verbatim from
 * `CandidateSlate.test.tsx`'s inline assertion pair. The implementing plan
 * should import/inline this against the rendered brandRiskReason element:
 *
 *   const el = screen.getByTestId('brand-risk-reason-<leadId>')
 *   assertNeverTruncated(el, longBrandRiskReason)
 */
function assertNeverTruncated(el: { textContent: string | null; className: string }, longText: string) {
  expect(el.textContent).toBe(longText)
  expect(el.className).not.toMatch(/line-clamp|truncate/)
}
void assertNeverTruncated // referenced by the implementing plan; not invoked in this scaffold

describe('LeadCard (BRF-01)', () => {
  it.todo('renders the premise field in full')

  it.todo('renders the dated peg (datedPeg) and a pegSourceUrl link that is a REAL, sourced URL')

  it.todo('renders readerEnergy, charitableAngle, category, and confidence')

  it.todo(
    'when brandRiskFlag is true, renders the brandRiskReason warning IN FULL — className must not match /line-clamp|truncate/ (assertNeverTruncated)',
  )

  it.todo('when brandRiskFlag is false, renders no brand-risk warning at all')

  it.todo('renders the repetitionWarning advisory when present, without suppressing the lead card')
})
