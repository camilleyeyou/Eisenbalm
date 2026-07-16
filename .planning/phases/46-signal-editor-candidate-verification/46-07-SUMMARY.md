---
phase: 46-signal-editor-candidate-verification
plan: 07
subsystem: testing
tags: [langgraph, checkpoint-resume, convex, pytest, integration-gate]

# Dependency graph
requires:
  - phase: 46-01
    provides: "story_leads/verification_records Convex tables + byRunId queries, live on dev:modest-magpie-797; Wave-0 skip-guarded test scaffold"
  - phase: 46-06
    provides: "20-node compiled graph (calibrator -> signal_editor -> scout -> verify_candidates -> advocate -> ...), live-introspection confirmed"
provides:
  - "test_checkpoint_resume_phase46.py — SGE-04 pause/resume test asserting story_leads + verification_records survive the editor_gate_1 interrupt/resume cycle via storyLeads:byRunId / verificationRecords:byRunId Convex reads (pre- and post-resume row-count parity)"
  - "Phase 46 integration gate closed: full pipeline suite green (615 passed / 37 skipped / 0 failed), Convex live-sync + parity confirmed"
  - "deferred-items.md — logs the discovered-but-out-of-scope `_force_no_winner`/forceNoWinner dead-toggle gap in editor_gate_1"
affects: [47-story-brief-stage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Convex byRunId row-count parity (before/after resume) as a proxy for Postgres-checkpoint state-preservation when the HTTP resume harness only exposes status, not raw DispatchState"

key-files:
  created:
    - .planning/phases/46-signal-editor-candidate-verification/deferred-items.md
  modified:
    - packages/pipeline/tests/test_checkpoint_resume_phase46.py

key-decisions:
  - "Checkpoint-resume proof uses Convex storyLeads:byRunId/verificationRecords:byRunId row-count parity (pre-resume vs post-resume), not a direct AsyncPostgresSaver channel-value read — the existing resume-test precedent (test_editor_gate_1_resume.py) only exposes the HTTP status/Sanity-draft surface, and 46-07-PLAN.md Task 1 explicitly pre-approved this fallback"
  - "Logged (did not fix) a discovered pre-existing gap: DispatchState._force_no_winner is set by api/runs.py's forceNoWinner request field but never read by editor_gate_1 (Phase 5's D-18 real-Opus interrupt condition is driven purely by live score_gap/confidence/requiresHumanInput) — out of this plan's scope per the scope-boundary rule, written to deferred-items.md instead"

requirements-completed: [SGE-04]

# Metrics
duration: ~20min
completed: 2026-07-16
---

# Phase 46 Plan 07: Checkpoint Resume & Integration Gate Summary

**Filled the SGE-04 Postgres-checkpoint pause/resume test (asserting story_leads + verification_records survive the editor_gate_1 interrupt via Convex byRunId row-count parity) and closed Phase 46's integration gate: full pipeline suite green (615/37/0), Convex live-sync + parity confirmed on dev:modest-magpie-797.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-16
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- `test_checkpoint_resume_phase46.py`'s Wave-0 `pytest.skip("filled by 46-07")` stub is replaced with `test_story_leads_and_verification_records_survive_resume`, mirroring `test_editor_gate_1_resume.py`'s `forceNoWinner` → `awaiting-review` → resume → terminal HTTP flow. It reads `storyLeads:byRunId` / `verificationRecords:byRunId` for the run both immediately after the pause (proving the D-01 pre-fan-out spine — `signal_editor → scout → verify_candidates` — genuinely ran before the interrupt) and after resume/completion (asserting unchanged row counts — proving the resumed run continued from the Postgres checkpoint rather than losing state or silently re-running the spine from scratch, which would double the row counts). The `SUPABASE_POSTGRES_URL` module-level skip-guard is unchanged; the module still collects and skips cleanly (0.02s) in this environment, matching the acceptance criterion "SKIPPED in CI without Postgres."
- **Integration gate, all three checks green:**
  1. `cd packages/pipeline && uv run pytest tests/ -q` → **615 passed / 37 skipped / 0 failed** — identical to the 46-06 baseline (the new test still skips here, so the count is unchanged; zero regressions).
  2. `pnpm --filter @eisenbalm/convex dev:once` → completed in 9.91s with no schema/validator error ("Convex functions ready!").
  3. `pnpm check:convex-parity` → exit 0: "56 called functions all present on dev:modest-magpie-797 (131 deployed)" — confirms `storyLeads:insert`/`storyLeads:byRunId`, `verificationRecords:insert`/`verificationRecords:byRunId`, and every other pipeline call site are live and undrifted.
- **Discovered (logged, not fixed) a pre-existing gap:** `DispatchState._force_no_winner` — the Phase-4-era toggle `forceNoWinner` sets in initial state — is never read by `agents/editor.py::editor_gate_1`. Phase 5's D-18 real-Opus implementation drives the interrupt condition purely from the live LLM's `confidence`/`requiresHumanInput` plus the real Advocate score gap, so the toggle no longer forces anything. Both this plan's new resume test and the pre-existing `test_editor_gate_1_resume.py` use it as their trigger mechanism (per this plan's explicit instruction to mirror that precedent); in a genuinely live run neither may reliably trigger the interrupt via the flag alone. This is unrelated to any Phase 46 change and does not block this plan's acceptance (both tests skip cleanly here regardless, since `SUPABASE_POSTGRES_URL` in `.env` points at a Railway-internal host unreachable from this sandbox) — written up in `deferred-items.md` for whoever next runs a live integration pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fill test_checkpoint_resume_phase46.py (SGE-04)** - `423a6c2` (test)
2. **Task 2: Phase integration gate — full suite + Convex parity + live-sync** — no code changes (verification-only task); results recorded above and in this SUMMARY.

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## Files Created/Modified
- `packages/pipeline/tests/test_checkpoint_resume_phase46.py` - Wave-0 stub replaced with the real SGE-04 pause/resume test (`test_story_leads_and_verification_records_survive_resume`); module docstring documents the Convex-byRunId-parity proof strategy and the `_force_no_winner` gap
- `.planning/phases/46-signal-editor-candidate-verification/deferred-items.md` - New: logs the discovered `_force_no_winner`/`forceNoWinner` dead-toggle gap as an out-of-scope, unfixed observation with a suggested follow-up

## Decisions Made
- **Convex row-count parity, not a raw checkpoint-state read.** The existing resume-test precedent (`test_editor_gate_1_resume.py`) only exercises the HTTP `client`/`convex_query_fn`/`sanity_*` fixture surface — there is no existing harness that reads the AsyncPostgresSaver's checkpoint tuple directly. 46-07-PLAN.md Task 1 explicitly pre-approves the Convex-byRunId fallback ("assert the resumed run reaches terminal without losing the leads by reading them back via the Convex `storyLeads:byRunId` / `verificationRecords:byRunId` queries"), so the test asserts (a) non-empty rows immediately post-interrupt (proves the pre-fan-out spine ran) and (b) unchanged row counts post-resume-and-completion (proves neither state loss — which would crash downstream nodes depending on the same checkpointed `candidates`/`story_leads`/`verification_records` — nor silent re-execution of `signal_editor`/`verify_candidates`, which would double the counts).
- **Did not attempt to fix the `_force_no_winner` gap.** Per the scope-boundary rule ("Only auto-fix issues DIRECTLY caused by the current task's changes"), this is a pre-existing Phase-4/5 gap unrelated to any Phase 46 change. Fixing it is either an architectural question (should the toggle synthesize a canned low-confidence `EditorDecision`, bypassing the LLM call — mirroring the D-14 all-candidates-killed recovery path?) or a live-environment debugging task once Postgres is actually reachable — out of scope for a phase-gate plan. Logged to `deferred-items.md` instead.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria passed on the first attempt; no auto-fixes, no blocking issues requiring Rules 1-3, no architectural questions requiring Rule 4. The `_force_no_winner` discovery was handled per the SCOPE BOUNDARY instructions (logged to `deferred-items.md`, not fixed) rather than as a deviation to the plan's own tasks.

## Issues Encountered

None. The test file compiles cleanly, all grep-based acceptance criteria matched on the first pass, and `uv run pytest tests/test_checkpoint_resume_phase46.py -q` exits 0 (1 skipped) immediately. The full suite, `dev:once`, and `check:convex-parity` all passed on the first run with no fix cycles needed.

## Manual Tuning Items (Pending UAT — from 46-VALIDATION.md)

Recorded here per this plan's Task 2 acceptance criteria — NOT blockers, require a real pipeline run to evaluate:

1. **Obscurity press-hit threshold (SGE-03).** `OBSCURITY_PASS_MAX_HITS=2` / `OBSCURITY_FAIL_MIN_HITS=4` (set in 46-05's `agents/verify_candidates.py`) have no numeric precedent. After a real pipeline run, spot-check that well-known orgs are killed as "not obscure" and genuinely obscure orgs pass; adjust the constants if needed.
2. **Signal Editor lead quality / Jesse-voice fit (SGE-01).** On a real run, read the 3-5 emitted `story_leads`; confirm each `datedPeg`/`pegSourceUrl` is real and current (not invented) and the `premise` reads on-voice (dry, precise, no winking).

## User Setup Required

None - no external service configuration required for this plan's own acceptance. (A future live-mode smoke test to actually exercise `test_checkpoint_resume_phase46.py`'s PASSED path — as opposed to its SKIPPED path proven here — would require a reachable `SUPABASE_POSTGRES_URL`, which the current `.env` value points at a Railway-internal-only host; that provisioning step is unrelated to this plan.)

## Next Phase Readiness

- **Phase 46 is complete.** SGE-01 through SGE-05 are all satisfied:
  - SGE-01/02/05 (Signal Editor: leads, brand-risk gate, repetition warning) — 46-04.
  - SGE-03 (verify_candidates deterministic check + kill policy) — 46-05.
  - SGE-04 (20-node graph + Postgres checkpoint resume across the new nodes) — 46-06 (wiring/live-introspection) + this plan (the pause/resume test itself).
- Phase 47 (Story & Brief Stage) can now build the Stage-1 UI on top of real `story_leads`/`verification_records` data: `storyLeads:byRunId` and `verificationRecords:byRunId` are live, guarded, and proven queryable per-run.
- The `_force_no_winner` gap (deferred-items.md) is worth a look before anyone relies on `forceNoWinner=True` to deterministically trigger an interrupt in a live smoke test — it currently does not.
- No blockers for Phase 47.

## Self-Check

- [x] `packages/pipeline/tests/test_checkpoint_resume_phase46.py` contains `def test_story_leads_and_verification_records_survive_resume`, `story_leads`, `verification_records`, `SUPABASE_POSTGRES_URL`
- [x] `uv run pytest tests/test_checkpoint_resume_phase46.py -q` — 1 skipped, exit 0
- [x] `uv run pytest tests/ -q` — 615 passed / 37 skipped / 0 failed (unchanged from 46-06 baseline)
- [x] `pnpm --filter @eisenbalm/convex dev:once` — completed, no schema/validator error
- [x] `pnpm check:convex-parity` — exit 0, 56/56 called functions present
- [x] `.planning/phases/46-signal-editor-candidate-verification/deferred-items.md` exists
- [x] Commit `423a6c2` present in `git log`

## Self-Check: PASSED

Both created/modified files confirmed present on disk; commit `423a6c2` confirmed in `git log`; full pipeline suite green; Convex live-sync + parity both confirmed green.

---
*Phase: 46-signal-editor-candidate-verification*
*Plan: 07-checkpoint-resume-and-integration-gate*
*Completed: 2026-07-16*
