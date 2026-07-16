/**
 * Phase 47 (BRF-02) — LeadActions Wave-0 scaffold.
 *
 * `LeadActions` renders "Require this lead" / "Remove — add reason" for a
 * `story_leads` row. Require calls `requireLead` (no reason). Remove is
 * disabled while the reason textarea is empty; submitting with a non-empty
 * reason calls `removeLead` and the removal surfaces in the shared Decision
 * log (`components/decision-log/DecisionLog.tsx`) via the pipeline's
 * `_emit_audit` call (docs/API_CONTRACTS.md §47.5) — mirrors
 * `factcheck.py::keep_claim`/`delete_claim` (reason mandatory on Remove).
 *
 * This is a COLLECTIBLE Wave-0 scaffold (47-01) — `LeadActions` does not
 * exist yet, so every case is `it.todo`. The implementing plan (47-05,
 * workspace-subscriptions-lead-card-actions) fills these in.
 *
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom).
 */
import { describe, it } from 'vitest'

describe('LeadActions (BRF-02)', () => {
  it.todo('clicking "Require this lead" calls requireLead(runId, leadId) with no reason required')

  it.todo('the Remove button is disabled while the reason textarea is empty')

  it.todo('Remove is enabled once a non-empty reason is entered')

  it.todo('submitting Remove with a reason calls removeLead(runId, leadId, { reason })')

  it.todo('a successful Remove surfaces the reason in the shared Decision log (DecisionLog component)')

  it.todo('a failed requireLead/removeLead call surfaces an error message, not a silent failure')
})
