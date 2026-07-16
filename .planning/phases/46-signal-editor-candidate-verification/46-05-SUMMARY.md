---
phase: 46-signal-editor-candidate-verification
plan: 05
subsystem: pipeline-agents
tags: [langgraph, httpx, respx, verification, kill-policy, interrupt, checkpoint-resume]

# Dependency graph
requires:
  - phase: 46-01
    provides: "VerificationRecord TypedDict shape + verificationRecords:insert Convex mutation, live on dev:modest-magpie-797 and guarded"
  - phase: 46-02
    provides: "graph/state.py VerificationRecord TypedDict + DispatchState.verification_records JSON-safe field"
provides:
  - "agents/verify_candidates.py — deterministic non-LLM node: domain-live, registration-reachability, obscurity press-scan checks; kills ONLY on definitive failure; persists every record to Convex; filters survivors"
  - "editor_gate_1 all-candidates-killed recovery path (D-14): awaiting-review + interrupt() instead of raise RuntimeError, with a synthetic winning_charity built from the human-supplied name on resume"
affects: [46-06, 46-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bare async node (no @agent_node, no LLM, no cost, no deliberationEvent) mirroring agents/verify.py's conservative fetch posture, extended to a 3-check kill/keep decision + Convex persistence"
    - "respx.mock() context manager to exercise the REAL httpx try/except path (not just mock the wrapper function) — proves a real httpx.TimeoutException genuinely collapses to unverified, not just an assumed contract"

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py
  modified:
    - packages/pipeline/tests/agents/test_verify_candidates.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
    - packages/pipeline/tests/agents/test_editor.py

key-decisions:
  - "VerificationRecord.domainLive is a required bool per the API_CONTRACTS §46.3 contract (not Optional) — a transient/unresolved domain check is coerced to False in that field, with the tri-state ambiguity captured instead in the record's overall status='unverified'. The kill decision itself only ever reads the pre-coercion Optional[bool]/None value, so the coercion never leaks into the kill rule."
  - "Registration check kill signal is 'neither charityNavigatorUrl nor guidestarUrl present at all' (registration_id is None) — an unreachable-but-present URL is treated as a transient failure (kept, status stays eligible for 'unverified'), never a kill on its own. This matches D-11's 'no registration found at all' framing distinctly from 'URL present but flaky'."
  - "Used httpx.TimeoutException (the real httpx 0.28.1 exception class) instead of the plan's illustrative httpx.TimeoutError, which does not exist in this httpx version — verified via direct import check before writing the test. Behavior is unaffected since the implementation's except clause is a bare Exception catch, per the verify.py precedent."
  - "editor_gate_1's all-candidates-killed recovery path returns immediately (skips deterministic ranking, the Opus acomplete() call, and the existing interrupt block entirely) rather than threading a fake single-candidate list through the normal path — keeps the degraded path's cost at zero LLM calls and its logic fully separate from the scored-candidates path, per the plan's Task 2 action item 3."

requirements-completed: [SGE-03]

# Metrics
duration: ~15min
completed: 2026-07-16
---

# Phase 46 Plan 05: Verify Candidates & Editor Recovery Summary

**Deterministic verify_candidates node (domain-live + registration-reachability + bounded obscurity press-scan, kill-only-on-definitive-failure) plus editor_gate_1's conversion from a hard RuntimeError crash to an awaiting-review + interrupt() recovery when every candidate is killed.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-16T08:02:54Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `agents/verify_candidates.py` runs three deterministic checks per candidate — `_check_domain_live` (httpx GET, 10s timeout, follow_redirects, desktop UA), `_check_registration` (reachability of `charityNavigatorUrl`/`guidestarUrl`, no new paid/government API per D-11), `_obscurity_press_scan` (bounded `web_search`, `max_results=5`) — and kills a candidate ONLY on a DEFINITIVE failure (`domain_live is False`, no registration field present at all, or `pressHits >= OBSCURITY_FAIL_MIN_HITS`). Every other outcome (timeout, 5xx, SSL/DNS blip, ambiguous middle-band press count) marks the record `status='unverified'` and KEEPS the candidate — never a kill on a blip (D-12).
- Every candidate produces exactly one `VerificationRecord`, persisted via `convex_mutation_safe("verificationRecords:insert", ...)` with the flat args matching the §46.6 Convex validator (`obscurity: {pressHits, verdict}` is re-flattened to `pressHits`/`obscurityVerdict` at the call site). Killed records always carry a non-empty `killReason` — nothing silently dropped.
- `editor_gate_1`'s `raise RuntimeError(...)` guard on empty `state['candidates']` is replaced with a recovery path: `pipelineRuns:updateStatus('awaiting-review')` is written BEFORE `interrupt()` (Phase 4 D-13 ordering, verified by test), the human-supplied `charityName` is accepted from the same three resume shapes the existing gate-1 interrupt handles, and a minimal synthetic `winning_charity` dict (every `CharityCandidate` key present, empty where there's no scored data) is built and returned — with zero LLM calls, since there is nothing to rank.
- Full pipeline suite: 606 passed / 37 skipped / 0 failed (baseline was 596 passed / 39 skipped at 46-02 — the increase reflects `test_verify_candidates.py`'s module-level `importorskip` guard now resolving to 3 real passing tests, plus 2 new `editor.py` recovery tests).

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement agents/verify_candidates.py (deterministic, conservative)** - `3327cfa` (feat)
2. **Task 2: Make editor_gate_1 recover from all-candidates-killed (D-14)** - `26c18a9` (fix)

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py` - New: bare `async def verify_candidates(state) -> dict`; `_check_domain_live`, `_check_registration`, `_obscurity_press_scan`, `_apply_kill_rule`, `_obscurity_verdict`, `_record_status` helpers; `OBSCURITY_PASS_MAX_HITS=2` / `OBSCURITY_FAIL_MIN_HITS=4` tunable constants; `_charity_id_for` join-key helper matching `agents/advocate.py`
- `packages/pipeline/tests/agents/test_verify_candidates.py` - Replaced the 3 skip-guarded Wave-0 stubs with real `respx`-mocked httpx tests: `test_kills_definitive_failure`, `test_keeps_on_transient_error`, `test_killed_record_has_reason`
- `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` - `editor_gate_1`'s empty-candidates guard replaced with the awaiting-review/interrupt/synthetic-winner recovery path (D-14); non-empty path unchanged
- `packages/pipeline/tests/agents/test_editor.py` - 2 new tests: `test_editor_gate_1_no_candidates_triggers_recoverable_interrupt` (GraphInterrupt not RuntimeError, pre-interrupt status write), `test_editor_gate_1_no_candidates_resume_builds_synthetic_winner` (resume -> synthetic winner, no acomplete() call, model_versions preserved)

## Decisions Made
- `domainLive: bool` (required, non-Optional per the §46.3 contract) coerces a transient/unresolved check to `False`; the tri-state ambiguity lives in the record's `status` field (`'unverified'`) instead of a separate per-check flag. The kill rule itself reads the pre-coercion `Optional[bool]` so this coercion never contaminates the kill decision.
- "No registration found" (a kill signal per D-11) is defined strictly as "neither `charityNavigatorUrl` nor `guidestarUrl` present at all" — a present-but-currently-unreachable URL is a transient condition, not a kill, consistent with D-12's "ambiguous errors keep the candidate" posture.
- `httpx.TimeoutException` (not the plan's illustrative `httpx.TimeoutError`, which doesn't exist in httpx 0.28.1 — confirmed via direct import) is the real exception used in the transient-error test; the implementation's bare `except Exception` catch means this substitution has zero behavioral effect.
- The all-candidates-killed recovery path in `editor_gate_1` returns immediately after building the synthetic winner rather than reusing any part of the scored-candidates code path — keeps the degraded path at zero LLM cost and fully isolated from the normal ranking/interrupt logic.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria passed on the first attempt; no auto-fixes, no blocking issues, no architectural questions. The only adjustment was substituting the real `httpx.TimeoutException` for the plan's illustrative `httpx.TimeoutError` reference in the test (that exact name doesn't exist in this httpx version) — a test-authoring correction, not a behavior or scope change.

## Issues Encountered

None. `verify_candidates.py` imported cleanly on the first attempt; all 3 Task 1 tests and both Task 2 tests passed without iteration. The full 643-test pipeline suite (606 passed / 37 skipped) confirmed zero regressions from either task.

## User Setup Required

None - no external service configuration required. `verificationRecords:insert` was already deployed and guarded by Plan 46-01.

## Next Phase Readiness

- `verify_candidates` is fully built and unit-tested but **NOT yet wired into the graph** — that lands in Plan 46-06 (`calibrator → signal_editor → scout → verify_candidates → advocate` chain, per D-01).
- `editor_gate_1`'s D-14 recovery path is ready for Plan 46-07's checkpoint pause/resume test spanning the new nodes — an all-candidates-killed run now reaches `'awaiting-review'` (not `'failed'`), which Plan 46-07's integration gate can assert against.
- Plan 46-06 should also update `api/runs.py`'s hardcoded `agent_keys` list and `tests/test_pipeline_real_mode.py`'s patch targets (RESEARCH Pitfalls 2/3) — neither was touched by this plan since `verify_candidates` isn't wired into the graph yet.

## Self-Check

- [x] `packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py` exists, contains `async def verify_candidates`, no `@agent_node` decorator
- [x] `grep -q "verificationRecords:insert"` and `grep -q "OBSCURITY_FAIL_MIN_HITS"` both match in `verify_candidates.py`
- [x] `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` no longer contains `raise RuntimeError` in the empty-candidates guard; contains `"all-candidates-killed"`
- [x] `uv run pytest tests/agents/test_verify_candidates.py -q` — 3/3 passed
- [x] `uv run pytest tests/agents/test_editor.py -k no_candidates -q` — 2/2 passed
- [x] `uv run pytest tests/agents/test_editor.py -q` — 12/12 passed (no regressions)
- [x] Full suite `uv run pytest tests/ -q` — 606 passed / 37 skipped / 0 failed
- [x] Commits `3327cfa`, `26c18a9` both present in `git log`

## Self-Check: PASSED

All 4 created/modified files confirmed present on disk; both task commits (`3327cfa`, `26c18a9`) confirmed in `git log`; full pipeline suite green with zero regressions.

---
*Phase: 46-signal-editor-candidate-verification*
*Plan: 05-verify-candidates-and-editor-recovery*
*Completed: 2026-07-16*
