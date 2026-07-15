---
phase: 42-fact-check-stage
plan: 08
subsystem: testing
tags: [integration-gate, convex, vitest, pytest, nextjs-build, dev-sync]

# Dependency graph
requires:
  - phase: 42-fact-check-stage
    plan: 01
    provides: "§42 contract + claim_checks additive fields (importance/changedSinceCheck/conflict) + five pipeline-lane Convex functions"
  - phase: 42-fact-check-stage
    plan: 02
    provides: "Researcher/publisher importance plumbing"
  - phase: 42-fact-check-stage
    plan: 03
    provides: "_reset_touched_claims content-patch reset-to-unchecked hook"
  - phase: 42-fact-check-stage
    plan: 04
    provides: "The six claim-action + evidence preview/apply endpoints"
  - phase: 42-fact-check-stage
    plan: 05
    provides: "deriveFactCheckSummary + corrected importance-aware deriveTasks"
  - phase: 42-fact-check-stage
    plan: 06
    provides: "Shared ClaimProvenanceCard + the real Stage 3 Fact Check screen + factCheckFilters"
  - phase: 42-fact-check-stage
    plan: 07
    provides: "Draft (ClaimMark) and Approval (SourceIndex) reuse of the shared provenance card"
provides:
  - "The Phase 42 phase-gate: full pipeline pytest + full console vitest + the no-Sanity-write tripwire + strict dispatch-control build + Convex typecheck all green"
  - "Convex schema/functions (importance/changedSinceCheck/conflict fields + claimChecks.ts additions) SYNCED live to dev:modest-magpie-797 (not merely committed) — confirmed by both `dev:once` and the deploy-parity guard"
  - "42-VERIFICATION.md recording the gate results"
  - "The live 8-step demo-leg UAT recorded as a pending human-verification item (not yet performed)"
affects: [43-my-tasks-decision-log, 44-inspector, 45-agent-revision-generalization, 49-rbac]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase-gate convention: run the full automated suite/build/typecheck/sync matrix once at phase end, record results in a `##_Phase_N_Verification` doc, and defer any genuinely end-to-end-reactive-UI checks to an explicit human-UAT item rather than skipping or fabricating them"

key-files:
  created:
    - .planning/phases/42-fact-check-stage/42-VERIFICATION.md
  modified: []

key-decisions:
  - "The Convex dev-deployment sync (pnpm --filter @eisenbalm/convex dev:once) was run and succeeded against dev:modest-magpie-797, closing the 'committed but unsynced' gap flagged in 42-01/42-04/42-06's SUMMARYs and in project memory (the Phase 39 prod-500 precedent). Verified twice: the sync's own success output AND the independent check:convex-parity guard (53/53 called functions present, 124 deployed total)."
  - "The no-Sanity-write tripwire was additionally run in isolation (npx vitest run __tests__/dispatch-control-no-sanity-write.test.ts from apps/dispatch-control) rather than trusting only its pass within the full-suite run, per the plan's explicit Task 1 step 3 instruction to assert it explicitly."
  - "Per the auto-mode checkpoint instructions for this execution, Task 2 (the manual demo-leg UAT) is NOT self-approved as 'verified' — it is recorded as a pending human-verification item in this SUMMARY and 42-VERIFICATION.md, carried forward to the phase's human-UAT flow, rather than fabricated as passed."

patterns-established:
  - "Any future phase-08-style integration gate should run the no-Sanity-write tripwire (or equivalent tripwire tests) BOTH inside the full suite run and in isolation, since a full-suite pass does not by itself distinguish 'this specific tripwire ran and passed' from 'it happened to not regress'."

requirements-completed: [FCT-01, FCT-02, FCT-03, FCT-04, FCT-05, FCT-06, FCT-07]

# Metrics
duration: ~25min
completed: 2026-07-15
---

# Phase 42 Plan 08: Integration Gate Summary

**Phase 42's full automated gate is green end-to-end — pipeline pytest (578 passed/36 skipped), console vitest (743 passed/2 todo across 86 files), the no-Sanity-write tripwire (isolated pass), the strict dispatch-control build (exit 0), Convex typecheck (clean), and the Convex dev-deployment sync (confirmed live on dev:modest-magpie-797 by both `dev:once` and the independent deploy-parity guard) — with the one genuinely manual item, the 8-step live demo-leg UAT, explicitly recorded as pending rather than self-approved.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-15T06:44Z
- **Completed:** 2026-07-15T07:00Z
- **Tasks:** 1 of 2 (`type="auto"` Task 1 complete; `type="checkpoint:human-verify"` Task 2 deferred to human UAT per auto-mode instructions)
- **Files modified:** 1 (created)

## Accomplishments

- **Ran and recorded the full Phase 42 gate.** All seven automated checks pass: pipeline pytest suite (578 passed, 36 skipped, 0 failed), console vitest suite (86 files passed | 1 skipped, 743 tests passed | 2 todo), the no-Sanity-write tripwire in isolation (2/2), the strict `pnpm --filter dispatch-control build` (exit 0, all 30 routes including `/issues/[issueNumber]/fact-check` generated), the Convex `tsc --noEmit` typecheck (exit 0), and the Convex dev-deployment sync.
- **Closed the "committed but unsynced" gap.** `pnpm --filter @eisenbalm/convex dev:once` ran against `dev:modest-magpie-797` and reported `✔ Convex functions ready! (5.7s)` — this is the exact gap flagged as outstanding by 42-01, 42-04, and 42-06's SUMMARYs (deferred by design to this plan). Independently confirmed by the project's own `check:convex-parity` deploy-parity guard (added in quick-task 260710-fxx specifically to catch this class of gap): `53 called functions all present on dev:modest-magpie-797 (124 deployed)`.
- **Wrote `42-VERIFICATION.md`** with the `## Phase 42 Verification` heading, a pass/fail table for all 7 checks, and the tail of each command's output, per the plan's Task 1 acceptance criteria.
- **Did not fabricate the manual UAT.** Per this execution's auto-mode instructions (and the plan's own "Do NOT self-approve" acceptance criterion on Task 2), the 8-step live demo-leg walkthrough was NOT performed and is NOT marked as verified — it is recorded below and in `42-VERIFICATION.md` as a pending human-verification item.

## Task Commits

Each task was committed atomically:

1. **Task 1: Full suites + strict build + Convex dev sync + tripwire, recorded to 42-VERIFICATION.md** - `7c90e66` (docs)

**Task 2** (the manual demo-leg UAT checkpoint) was reached, and per the auto-mode checkpoint instructions for this execution it was NOT self-approved — it is recorded as a deferred human-verification item (see below), not completed as a task.

**Plan metadata:** this SUMMARY + STATE/ROADMAP/REQUIREMENTS update, committed separately (final-commit step).

## Files Created/Modified

- `.planning/phases/42-fact-check-stage/42-VERIFICATION.md` - Phase 42 gate results: pass/fail table for all 7 automated checks + command output tails + the deferred manual-UAT note

## Decisions Made

- **Ran the Convex dev sync and verified it two ways** (the sync's own success output, plus the independent `check:convex-parity` guard) rather than trusting a single signal, since this exact class of gap (schema/functions committed but not deployed) previously caused a Phase 39 production 500.
- **Ran the no-Sanity-write tripwire in isolation**, not just as part of the full suite, per the plan's explicit Task 1 step 3 ("explicitly assert this tripwire is green").
- **Did not self-approve the manual demo-leg UAT.** This execution ran in auto-mode, where `checkpoint:human-verify` gates are normally auto-approved — but this specific checkpoint requires a live browser session driving Convex + pipeline + Sanity reactivity end-to-end, which is not something this agent can perform. Per the harness's explicit checkpoint instructions for this plan, it is recorded as a pending human-verification item rather than fabricated as passed.

## Deviations from Plan

None — plan executed as written for Task 1. Task 2 (the manual checkpoint) was handled per this execution's explicit override instructions: complete everything automatable, defer the manual UAT rather than blocking or fabricating it.

## Issues Encountered

None. All seven automated checks passed on the first run with no retries needed:
- `cd packages/pipeline && uv run pytest -x -q` → 578 passed, 36 skipped
- `pnpm --filter dispatch-control test:unit` → 86 files passed | 1 skipped (87); 743 passed | 2 todo (745)
- `npx vitest run __tests__/dispatch-control-no-sanity-write.test.ts` (isolated) → 1 passed, 2/2 tests
- `pnpm --filter dispatch-control build` → exit 0
- `pnpm --filter @eisenbalm/convex typecheck` → exit 0
- `pnpm --filter @eisenbalm/convex dev:once` → succeeded, synced to dev:modest-magpie-797
- `pnpm check:convex-parity` → 53/53 called functions present, 124 deployed

No pre-existing repo state (the unrelated modified/untracked files visible in `git status` at session start — e.g. `docs/client-editable/EISENBALM-EDITABLE-COPY.docx`, other phases' VERIFICATION.md files, quick-task plans) was touched by this plan; only `42-VERIFICATION.md` was created and committed.

## Deferred Item: Manual Demo-Leg UAT (pending human test)

**Status: PENDING HUMAN TEST — not yet performed.**

Plan 42-08 Task 2 specifies an 8-step live, operator-driven walkthrough of the load-bearing demo leg:

1. My Tasks shows "Resolve an unsupported statistic" (Must fix) for an unsourced Load-bearing claim, and does NOT show it for an unsourced Incidental claim.
2. Stage 3 Fact Check claim detail's affirmative summary renders every counter, nothing blank.
3. The "must fix" / "numbers & dates" / "organization claims" filters narrow the table correctly.
4. Selecting a claim opens the provenance card with all 9 fields, never blank.
5. "Ask agent for better evidence" returns a replacement source + rewritten claim; Confirm replacement applies both.
6. The claim's prose, chip, must-fix counter, My Tasks task, header/publish-lock status, and Approval readiness all update LIVE without a manual refresh.
7. Editing a section's prose containing a checked claim flips it back to "Changed"/unchecked and increments "changed since check" (FCT-07).
8. The Draft galley popover and the Approval SourceIndex render the SAME provenance card content (FCT-04).

This is genuinely manual — it requires a live browser session driving Convex + pipeline + Sanity reactivity together, which cannot be exercised inside this autonomous gate. Every underlying unit it depends on is covered and green by the automated checks above (claimChecksFactcheck, derivedState/deriveFactCheckSummary/isMustFix, ClaimProvenanceCard, factCheckFilters, ClaimMark, claimProvenance, SourceIndex, test_factcheck_endpoints, test_content_patch_endpoints reset cases). This item is carried forward to the phase's human-UAT flow; it should be performed on a real or seeded issue run with an unsourced Load-bearing claim present (e.g. an "outpaces supply four to one"-style statistic) before Phase 42 is considered fully signed off by a human.

## User Setup Required

None for the automated portion — all required credentials (Convex dev-deployment token in `convex/.env.local`) were already present in this environment and the sync succeeded without any manual configuration.

**For the deferred manual item:** an operator (Andrew or Ghislain) needs to open the running dispatch-control app against a real or seeded issue run containing an unsourced Load-bearing claim and walk through the 8 steps above, then report "approved" or itemize deviations.

## Next Phase Readiness

- All 7 FCT requirements (FCT-01..07) are code-complete, unit/integration-tested, and their supporting infrastructure (Convex schema + functions) is live on the dev deployment — the phase's engineering work is done.
- The one open item is the human-only live demo-leg UAT (see above) — it does not block downstream phases from planning against Phase 42's shipped contract (§42 in API_CONTRACTS.md, the shared ClaimProvenanceCard, the six-action + evidence endpoints), since all of those are exercised by passing automated tests.
- Phase 43 (My Tasks screen + Decision Log component) can build on the derived task projection and `audit_log` trail this phase writes to. Phase 44 (Inspector) can reuse the shared provenance card. Phase 45 (agent-revision generalization) extends the same FCT-06 endpoint built here. Phase 49 (RBAC) wraps the six actions this phase structured for role-gating.
- No blockers to phase completion beyond the pending human demo-leg UAT.

---
*Phase: 42-fact-check-stage*
*Completed: 2026-07-15*

## Self-Check: PASSED

`.planning/phases/42-fact-check-stage/42-VERIFICATION.md` confirmed present on disk. Task 1 commit `7c90e66` confirmed present in `git log --oneline --all`. All 7 automated gate checks re-confirmed green per the command output captured above.
