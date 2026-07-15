---
phase: 42-fact-check-stage
plan: 08
type: execute
wave: 6
depends_on: ["42-01", "42-02", "42-03", "42-04", "42-05", "42-06", "42-07"]
files_modified:
  - .planning/phases/42-fact-check-stage/42-VERIFICATION.md
autonomous: false
requirements: [FCT-01, FCT-02, FCT-03, FCT-04, FCT-05, FCT-06, FCT-07]

must_haves:
  truths:
    - "The full pipeline pytest suite and the full dispatch-control vitest suite are green; the strict dispatch-control build exits 0; the dispatch-control-no-sanity-write tripwire is green"
    - "The new convex/*.ts (schema fields + claimChecks functions) are SYNCED to the dev deployment — not merely committed"
    - "The load-bearing demo leg runs live end-to-end: My Tasks → Fact Check claim detail → Ask agent for better evidence → Confirm replacement → counters/My-Tasks/Approval-readiness/header all update"
  artifacts:
    - path: ".planning/phases/42-fact-check-stage/42-VERIFICATION.md"
      provides: "the recorded gate results (suite output summaries + demo-leg observations)"
      contains: "## Phase 42 Verification"
  key_links:
    - from: "convex/schema.ts + convex/claimChecks.ts"
      to: "dev:modest-magpie-797 Convex deployment"
      via: "pnpm --filter @eisenbalm/convex dev:once (committing .ts != deployed)"
      pattern: "dev:once"
---

<objective>
Phase gate: prove the whole Fact Check stage holds together — both full test suites green, the strict frontend build clean, the no-Sanity-write tripwire green, Convex synced to dev, and the load-bearing demo leg verified live by the operator.

Purpose: Project memory has bitten this repo twice: vitest does NOT type-check (a phase shipped Vercel/Linux bugs), and committing convex/*.ts ≠ deployed (a phase shipped a prod 500). This gate closes both, plus the human-only end-to-end reactive verification of FCT-05/FCT-06.
Output: green suites + build + Convex sync + a recorded 42-VERIFICATION.md and an operator sign-off on the demo leg.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/42-fact-check-stage/42-CONTEXT.md
@.planning/phases/42-fact-check-stage/42-VALIDATION.md
@.planning/phases/42-fact-check-stage/42-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Full suites + strict build + Convex dev sync + tripwire, recorded to 42-VERIFICATION.md</name>
  <files>.planning/phases/42-fact-check-stage/42-VERIFICATION.md</files>
  <read_first>
    - .planning/phases/42-fact-check-stage/42-VALIDATION.md (the sampling/gate contract: full suite = vitest + strict build + pytest; Convex synced to dev before verify)
    - .planning/phases/42-fact-check-stage/42-RESEARCH.md (Validation Architecture lines 562-601 — the exact commands + Wave 0 gaps that must now all be green)
    - convex/package.json (dev:once script) and the project memory note on dev:modest-magpie-797
  </read_first>
  <action>
Run and record (into a new .planning/phases/42-fact-check-stage/42-VERIFICATION.md with a `## Phase 42 Verification` heading + a pass/fail table + the tail of each command's output):
1. `cd packages/pipeline && uv run pytest -x -q` — full pipeline suite green (includes test_researcher_importance, test_publisher_importance, test_content_patch_endpoints reset cases, test_factcheck_endpoints).
2. `pnpm --filter dispatch-control test:unit` — full console suite green (includes claimChecksFactcheck, derivedState, ClaimProvenanceCard, factCheckFilters, ClaimMark, claimProvenance, SourceIndex, and the no-Sanity-write tripwire).
3. `pnpm --filter dispatch-control test:unit -- __tests__/dispatch-control-no-sanity-write.test.ts` — explicitly assert this tripwire is green (factCheckClient.ts / ClaimProvenanceCard.tsx introduced no direct Sanity write).
4. `pnpm --filter dispatch-control build` — strict build exits 0 (the real type-check gate; vitest does not type-check).
5. `pnpm --filter @eisenbalm/convex typecheck` — convex tsc clean.
6. `pnpm --filter @eisenbalm/convex dev:once` — SYNC the schema fields + new claimChecks functions to the dev deployment (dev:modest-magpie-797). Record the deploy confirmation.
If any command fails, STOP and report the failure in 42-VERIFICATION.md with the failing assertion — do not paper over it.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest -x -q && cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control test:unit && pnpm --filter dispatch-control build && pnpm --filter @eisenbalm/convex typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `.planning/phases/42-fact-check-stage/42-VERIFICATION.md` exists and contains `## Phase 42 Verification`
    - The recorded table shows PASS for: pipeline pytest, console vitest, no-sanity-write tripwire, dispatch-control build, convex typecheck, and the dev:once sync
    - `cd packages/pipeline && uv run pytest -x -q` exits 0
    - `pnpm --filter dispatch-control test:unit` exits 0
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>Both full suites + strict build + convex typecheck are green, the no-Sanity-write tripwire holds, and the new Convex schema/functions are live on the dev deployment (not just committed).</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Operator verifies the live Fact Check demo leg end-to-end</name>
  <files>none (manual verification)</files>
  <action>
    Present the running dispatch-control app to the operator and walk them through the 8-step demo leg described in how-to-verify below. This is a manual, human-only verification — end-to-end reactive UI across Convex + pipeline + Sanity, which cannot be asserted automatically. Ensure Task 1 (suites/build/convex sync) is green first, then pause and wait for the operator's "approved" or their list of deviations. Do NOT self-approve.
  </action>
  <what-built>
    Stage 3 (Fact Check) is live in the Issue Workspace: affirmative summary, 7 filters, the shared provenance card on claim selection, the six actions, and "Ask agent for better evidence" (preview → apply). The Researcher now emits importance; content edits reset touched claims to unchecked.
  </what-built>
  <how-to-verify>
    On a real or seeded issue run with claims (an unsourced Load-bearing claim present — e.g. an "outpaces supply four to one"-style statistic):
    1. Open My Tasks; confirm a "Resolve an unsupported statistic" (Must fix) task appears for the unsourced Load-bearing claim, and does NOT appear for an unsourced Incidental claim (importance-aware severity).
    2. Click through to the Stage 3 Fact Check claim detail; confirm the affirmative summary renders every counter (checked X of Y, must fix, conflicting sources = "0 conflicting sources" when zero, checks not run, changed since check, last verified) — nothing blank.
    3. Apply the "must fix" filter and confirm the table narrows to the unsourced Load-bearing claim(s); try the "numbers & dates" and "organization claims" filters.
    4. Select the claim → the provenance card opens in the context panel with all 9 fields (unsourced shows "Unsourced", confidence "—", never blank).
    5. Click "Ask agent for better evidence" → a comparison card returns a replacement source (with publisher) AND a rewritten claim; click Confirm replacement.
    6. Verify LIVE: the claim's prose updates (content patch), its chip flips to checked/sourced, the must-fix counter decrements, the My Tasks task clears, the header/publish-lock status updates, and the Approval readiness reflects the change — all without a manual refresh.
    7. Edit a section's prose that contains a checked claim and confirm that claim flips back to "Changed"/unchecked and the "changed since check" counter increments (FCT-07).
    8. Confirm the Draft galley popover and the Approval SourceIndex now render the SAME provenance card content (FCT-04).
  </how-to-verify>
  <verify>
    <automated>MANUAL — operator-driven end-to-end verification; automated coverage of the underlying units is in Plans 42-02..42-07 and Task 1 above.</automated>
  </verify>
  <acceptance_criteria>
    - Operator confirms steps 1-8 each behave as described, OR reports specific deviations
    - No blank-as-verified state observed anywhere in the summary or card
    - The Ask-agent Confirm applies BOTH the source and the rewrite atomically and the counters/tasks/header update live
  </acceptance_criteria>
  <done>Operator has confirmed (or itemized deviations for) the 8-step demo leg; FCT-01..FCT-07 are exercised live.</done>
  <resume-signal>Type "approved" or describe the deviations observed.</resume-signal>
</task>

</tasks>

<verification>
- All automated suites/build/typecheck/sync recorded green in 42-VERIFICATION.md.
- Operator sign-off on the 8-step demo leg (FCT-01/02/03/04/05/06/07 all exercised live).
</verification>

<success_criteria>
Phase 42 is verifiably complete: FCT-01..FCT-07 pass their automated tests, the strict build + convex typecheck are clean, Convex is synced to dev, the no-Sanity-write boundary holds, and the operator has confirmed the load-bearing demo leg updates counters/tasks/readiness/header live.
</success_criteria>

<output>
After completion, create `.planning/phases/42-fact-check-stage/42-08-SUMMARY.md`.
</output>
