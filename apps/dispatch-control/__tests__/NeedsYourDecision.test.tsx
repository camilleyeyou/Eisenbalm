/**
 * Phase 47 (BRF-04) — NeedsYourDecision Wave-0 scaffold.
 *
 * The stage enters "Needs your decision" when agents can't confidently
 * choose — the human-facing label is LITERALLY "Needs your decision", NEVER
 * `requiresHumanInput` (that flag is internal only — CONTEXT D-07, state
 * model §105-110). The top two options render side by side (what each makes
 * possible, evidence quality, risk, burden). "Choose this story" requires a
 * rationale and resumes the run via the EXISTING, UNCHANGED write path:
 * `adjudicateGate1(runId, { selection: { charityName }, reason }, token)` ->
 * the Clerk-guarded `POST /issues/{run_id}/adjudicate` bridge (§37.3) ->
 * `_resume_paused_run`. Adapts `AdjudicationPanel.tsx` (Phase 37) to a
 * richer two-option comparison layout — the resume machinery itself is
 * UNCHANGED (D-02).
 *
 * This is a COLLECTIBLE Wave-0 scaffold (47-01) — `NeedsYourDecision` does
 * not exist yet, so every case is `it.todo`. The implementing plan (47-06,
 * org-options-and-needs-your-decision) fills these in.
 *
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import { describe, it } from 'vitest'

describe('NeedsYourDecision (BRF-04)', () => {
  it.todo('renders the label "Needs your decision" — never the internal requiresHumanInput flag')

  it.todo('renders the top two options side by side: what each makes possible, evidence quality, risk, burden')

  it.todo('the "Choose this story" action is disabled until a rationale is entered')

  it.todo(
    'submitting a choice calls adjudicateGate1(runId, { selection: { charityName }, reason }, token) — the unchanged Phase-37 resume bridge',
  )

  it.todo('a successful choice flips the header System-activity chip away from "⏸ Paused for you"')
})
