---
phase: quick-260718-7dk
plan: 01
subsystem: pipeline
tags: [convex, verify-candidates, tavily, run-b106e87a, sge-03, data-loss, false-positive-kill]

# Dependency graph
requires:
  - phase: 29 (D-1 pipelineSecret injection)
    provides: convex_mutation's central secret-injection point (the fix site for Bug A)
  - phase: 46 (Plan 05 — verify_candidates SGE-03 node)
    provides: the three-check kill-rule node that Bug B's policy rework targets
provides:
  - "convex_mutation omits None-valued args on the wire (Convex v.optional accepts ABSENT, rejects null) — storyLeads:insert / verificationRecords:insert with None optionals now persist instead of silently ArgumentValidationError-ing"
  - "verify_candidates never kills for missing registration; it performs its own bounded, site-scoped Tavily registration self-lookup that can only upgrade confidence, never remove a candidate"
  - "Obscurity press-scan widened 5->10 results with a genuinely definitive 9/10 kill bar (was 4/5, false-killed even mildly-covered orgs)"
affects: [signal_editor (storyLeads writes), scout-to-advocate graph edge, run-b106e87a-class live runs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shallow None-strip immediately before secret merge in a single central mutation function, rather than per-call-site cleanup — every current and future guarded-path caller benefits with zero call-site edits"
    - "Self-lookup instead of relying on an upstream agent to populate a field: verify_candidates now does its own bounded (max 2), short-circuiting Tavily search rather than trusting Scout to fill charityNavigatorUrl/guidestarUrl"

key-files:
  created:
    - packages/pipeline/tests/lib/test_convex_client_none_strip.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py
    - packages/pipeline/tests/agents/test_verify_candidates.py

key-decisions:
  - "Strip is shallow (top-level keys only) — verified both real None-passing callers (signal_editor.py brandRiskReason/repetitionWarning, verify_candidates.py registrationId/killReason) only carry optionals at the top level, so no nested-strip complexity is needed"
  - "Verified convex_mutation_safe routes through the exact same convex_mutation code path (no duplicate serialization logic to fix separately)"
  - "Registration self-lookup is bounded to at most 2 site-scoped searches per candidate (charitynavigator.org, then guidestar.org), short-circuiting on the first hit — a Tavily hit is treated as verified without a second fetch, for per-run cost containment"
  - "_apply_kill_rule's registration parameter is kept for signature stability (avoids touching the call site / VerificationRecord unpack) even though it's no longer read for kill decisions"
  - "Reconciled all 3 pre-existing verify_candidates tests to explicitly patch _check_registration rather than relying on candidate URL fields, so no live-Tavily-shaped ambiguity remains in the suite"

patterns-established:
  - "When an optional Convex arg can be Python None, strip at the single central mutation function rather than patching every call site — this is now the enforced convention for any future None-passing caller"

requirements-completed: [SGE-03]

# Metrics
duration: ~35min
completed: 2026-07-18
---

# Quick Task 260718-7dk: Fix run-killing verification (None vs null) Summary

**Two live-run-breaking pipeline bugs fixed: `convex_mutation` now omits None-valued args instead of serializing them as JSON `null` (which Convex's `v.optional` rejects), and `verify_candidates` no longer kills every candidate for lacking a `charityNavigatorUrl`/`guidestarUrl` that Scout never populates — it now runs its own bounded, site-scoped Tavily registration self-lookup that can only upgrade confidence, never kill.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2
- **Files modified:** 4 (2 source, 2 test — 1 new test file)

## Accomplishments

- **Bug A (data loss):** `convex_mutation` strips None-valued keys from `args` before the `pipelineSecret` merge. `storyLeads:insert` (signal_editor's `brandRiskReason`/`repetitionWarning`) and `verificationRecords:insert` (verify_candidates' `registrationId`/`killReason`) now serialize with those keys ABSENT when None, matching what Convex's `v.optional(v.string())` actually accepts — instead of an explicit `null` that triggers `ArgumentValidationError` and gets silently dropped by `convex_mutation_safe`'s try/except. Run b106e87a lost 4 story leads and 2 verification records this exact way.
- **Bug B (run-killer):** `verify_candidates._apply_kill_rule` no longer treats registration absence as a kill signal. `_check_registration` now performs its own bounded lookup: if the candidate already carries a registry URL, verify its reachability (unchanged behavior); otherwise run up to 2 site-scoped Tavily searches (`site:charitynavigator.org "{name}"`, then `guidestar.org`), short-circuiting on the first hit. A found registry page upgrades `registrationVerified`; nothing found or a search error is inconclusive and the candidate is KEPT as `unverified` for the human Editor Gate (D-12).
- Obscurity press-scan widened from a 5-result cap (4/5 hair-trigger falsely killed even mildly-covered orgs — e.g. a niche accessibility nonprofit saturating at 5/5) to a 10-result cap with a genuinely definitive 9/10 "not obscure enough" kill bar.
- Dead-domain kill (definitive 4xx) is the only kill rule carried forward unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Bug A — strip None-valued args in convex_mutation (+ RED test)** - `16c4fb4` (fix)
2. **Task 2: Bug B — registration self-lookup, registration-never-kills, advisory obscurity (+ RED tests)** - `86db8ee` (fix)

_TDD tasks: RED tests were written and confirmed FAILING against the unmodified code, then the fix was applied and confirmed GREEN, per plan — both changes landed in their respective single task commit (test + implementation together) per this repo's TDD convention._

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` - `convex_mutation` now strips None-valued args (`cleaned = {k: v for k, v in args.items() if v is not None}`) before the guarded-path `pipelineSecret` merge
- `packages/pipeline/tests/lib/test_convex_client_none_strip.py` (new) - RED-gated respx tests: a guarded path (`storyLeads:insert`) omits None keys and still injects `pipelineSecret`; an unguarded path (`agentRuns:noop`) omits None keys and does NOT inject `pipelineSecret`
- `packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py` - `_check_registration` reworked into a self-lookup (existing-URL reachability check preserved; otherwise a bounded, short-circuiting Tavily site search); `_apply_kill_rule` drops the registration kill rule; obscurity constants widened (`OBSCURITY_SCAN_MAX_RESULTS=10`, `OBSCURITY_PASS_MAX_HITS=3`, `OBSCURITY_FAIL_MIN_HITS=9`); new `_REGISTRATION_SITES` constant
- `packages/pipeline/tests/agents/test_verify_candidates.py` - 5 new RED-gated tests (no-registration survives unverified; lookup found→verified; lookup error→kept; heavy-press still kills at the new 9/10 bar; dead domain still kills) + 3 pre-existing tests reconciled to explicitly patch `_check_registration` (no live-Tavily ambiguity)

## Decisions Made

- Strip is shallow (top-level only) — confirmed both real None-passing callers only carry optionals at the top level, so no recursive strip is needed, and confirmed `convex_mutation_safe` calls through the same `convex_mutation` code path (no separate serialization to patch)
- Registration self-lookup reuses `web_search` (D-11 — no new paid/government API), bounded to at most 2 calls/candidate, short-circuiting on the first hit
- `_apply_kill_rule`'s `registration` parameter is kept in the signature (unused for kill decisions now) to avoid touching the call site's tuple-unpack or the `VerificationRecord` shape
- All 3 pre-existing verify_candidates tests were reconciled to explicitly `patch(..._check_registration)` rather than relying on candidate URL fields, per the plan's directive to keep every test's intent (and the "zero live Tavily calls" guarantee) unambiguous

## Deviations from Plan

None — plan executed exactly as written. All four interface anchors (convex_client.py's fix site, verify_candidates.py's four edit sites, the test idioms to mirror) matched the codebase at execution time.

**Cost delta** (as required by the plan's output spec): the obscurity press scan stays at 1 Tavily call/candidate (same call count, just a wider 10-result cap instead of 5). The registration self-lookup adds 1-2 site-scoped Tavily calls/candidate (short-circuits on the first hit). Net: +1..2 Tavily calls per candidate. For a typical ~5-candidate run: ~5 calls before this fix → ~10-15 calls after, within CLAUDE.md's per-run cost-containment guidance (Signal Editor and Scout already issue multiple searches per run).

## Issues Encountered

None. Both RED gates were observed failing pre-fix exactly as specified in the plan's critical reminders before any fix was applied.

## User Setup Required

None — no external service configuration required. No deploy/push performed (Railway auto-deploys on push per the plan's followups; not this executor's responsibility).

## Next Phase Readiness

- Full pipeline suite is green: `cd packages/pipeline && uv run pytest tests/ -q` → 707 passed, 38 skipped, 0 failed.
- `tests/test_verify_candidates_brief_mode.py`'s three characterization cases remain green unchanged (all kills there are domain-404-driven; the passing case has a reachable registry URL — unaffected by the registration-kill removal).
- No edits to `convex/*.ts`, `state.py`, Scout's schema, graph wiring, `API_CONTRACTS.md`, or any frontend — confirmed via `git status`/diff scope before each commit.
- **Not in this task, flagged for the orchestrator per the plan's followups:** the all-candidates-killed interrupt UI affordance (separate upcoming task); deploy — Railway auto-deploys on push, not performed here.
- A future live run should be watched to confirm Signal Desk leads and verification records now persist end-to-end (the manual reasoning check in the plan's `<verification>` block traces this path but cannot be executed without a live Convex round-trip).

---
*Phase: quick-260718-7dk*
*Completed: 2026-07-18*

## Self-Check: PASSED

All 4 modified/created files confirmed present on disk; both task commits (`16c4fb4`, `86db8ee`) confirmed present in git log.
