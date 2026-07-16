/**
 * Phase 47 (BRF-03) — OrgOptions (org-option-card / slate) Wave-0 scaffold.
 *
 * Organization options grouped under the active lead join three existing
 * sources on the shared `charityId`/`candidateId` (`charity-{slugify(name)}`,
 * confirmed identical across `pitchLog`/`verification_records`/
 * `agentVotes`): the Phase-46 `verificationRecords:byRunId` (verification
 * record WITH DATES), `pitchLog` (advocate case + confidence), and the
 * charity registry (prior-coverage warning, Phase 39). Each option renders
 * mechanism, verification record with dates, agent case, confidence,
 * prior-coverage warning, and its main concern ALWAYS VISIBLE — mirrors
 * `CandidateSlate.tsx`'s never-truncated `primaryConcern` discipline
 * verbatim (`__tests__/CandidateSlate.test.tsx`).
 *
 * This is a COLLECTIBLE Wave-0 scaffold (47-01) — the org-option component
 * does not exist yet, so every case is `it.todo`. The implementing plan
 * (47-06, org-options-and-needs-your-decision) fills these in.
 *
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import { describe, it, expect } from 'vitest'

/**
 * Reusable never-truncated tripwire — copied verbatim from
 * `CandidateSlate.test.tsx`'s inline assertion pair. The implementing plan
 * should apply this to the rendered "main concern" element for each org
 * option:
 *
 *   const el = screen.getByTestId('main-concern-<charityName>')
 *   assertNeverTruncated(el, longMainConcern)
 */
function assertNeverTruncated(el: { textContent: string | null; className: string }, longText: string) {
  expect(el.textContent).toBe(longText)
  expect(el.className).not.toMatch(/line-clamp|truncate/)
}
void assertNeverTruncated // referenced by the implementing plan; not invoked in this scaffold

describe('OrgOptions (BRF-03)', () => {
  it.todo('joins verificationRecords:byRunId + pitchLog + registry on the shared charityId/candidateId')

  it.todo('renders the mechanism, the verification record WITH DATES (checkedAt), and the agent case + confidence')

  it.todo('renders a prior-coverage warning when the charity registry reports one')

  it.todo(
    'renders the main concern IN FULL for every option — className must not match /line-clamp|truncate/ (assertNeverTruncated)',
  )

  it.todo('gracefully degrades an org option with no matching verification record (no crash)')
})
