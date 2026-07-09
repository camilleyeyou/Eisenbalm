---
phase: 36-voice-pass-de-slop-screen
plan: 02
subsystem: api
tags: [pipeline, qa, sign-off, axis, voice-pass, fastapi]

# Dependency graph
requires:
  - phase: 36-voice-pass-de-slop-screen
    provides: "Plan 36-01 — §36 contract (§36.2/§36.3/§36.7) + Convex qaCorrections.axis gains machine-tell/structural-variety literals"
  - phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
    provides: "sign_offs table + POST /issues/{run_id}/sign-off with kind-branching (facts-cleared server-gated, sounds-human interim ungated D-06)"
provides:
  - "agents/qa/__init__.py::qa() writes each Layer-1 finding's true predicate axis (gravity/sentiment/irony-signaling/precision) — the 'hard-rule' collapse is retired"
  - "api/signoffs.py VOICE_AXES constant + facts-cleared narrowing (excludes voice-axis errors) + new sounds-human server-enforced prerequisite (409 open_voice_findings)"
affects: [36-05-machine-tell-predicate, 36-04-voice-pass-screen, 36-06-rewrite-popover-signoff]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sign-off prerequisite partition: two disjoint open-error scans over the SAME qaCorrections table, split by axis membership in VOICE_AXES — no new table, no new query shape"
    - "Axis passthrough at write time: Layer-1 predicates already carry their true axis; the orchestrator's job is to NOT collapse it, not to re-derive it"

key-files:
  created:
    - packages/pipeline/tests/agents/qa/test_qa_axis_passthrough.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py
    - packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py
    - packages/pipeline/tests/test_signoffs_endpoints.py

key-decisions:
  - "Left the pre-existing test_sounds_human_ungated test in test_signoffs_endpoints.py unmodified — its fixture finding carries no 'axis' key at all, so it stays outside VOICE_AXES and the test remains a true green under the new gated behavior (it still correctly proves sounds-human never consults the claims-signoff prerequisite); no rename needed since its assertions did not change"
  - "Used the plan's own docs/API_CONTRACTS.md §36.2/§36.7 code blocks verbatim rather than re-deriving the VOICE_AXES set or the 409 detail shape — contract-first discipline already resolved these decisions in Plan 36-01"

requirements-completed: [VOX-03, VOX-04]

# Metrics
duration: ~10min
completed: 2026-07-09
---

# Phase 36 Plan 02: Pipeline Axis Foundations Summary

**Layer-1 QA findings now write their true predicate axis (no more collapse to "hard-rule"), and the sign-off endpoint partitions its open-error prerequisite by VOICE_AXES so facts-cleared and sounds-human gate on disjoint halves of the same qaCorrections table.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `agents/qa/__init__.py::qa()` no longer overwrites every Layer-1 finding's axis to `"hard-rule"` — `check_exclamation_marks`/`check_ai_reference` findings now write `axis="gravity"`, `check_sentiment_keywords` writes `axis="sentiment"`, `check_winking` writes `axis="irony-signaling"`, and `check_unverified_name` writes `axis="precision"` — all proven by capturing the actual `qaCorrections:insert` Convex mutation payload, not just the in-process `QAFinding`
- `api/signoffs.py` gains a `VOICE_AXES = {"gravity", "sentiment", "irony-signaling", "machine-tell"}` constant; the `facts-cleared` open-error scan is narrowed to exclude voice-axis findings (a voice error no longer double-blocks facts clearance); a new `elif body.kind == "sounds-human":` branch server-enforces zero open voice-axis error findings, 409ing `{"reason": "open_voice_findings", "count": n}` when they exist — upgrading Phase 34 D-06's interim ungated attestation in place, per D-12/D-14
- Both foundations proven RED-first: 4 new tests in `test_qa_axis_passthrough.py` (new file) and 4 new tests in `test_signoffs_endpoints.py` (2 of which failed against the pre-change code, confirming the partition was actually enforced by the new code, not already true)

## Task Commits

Each task was committed atomically (TDD RED→GREEN pairs):

1. **Task 1: Remove Layer-1 axis collapse (§36.2)**
   - `7a82505` (test, RED) — `test_qa_axis_passthrough.py` added; confirmed failing against the pre-change orchestrator
   - `86c120f` (feat, GREEN) — `layer1 = layer1_raw` replaces the axis-collapsing comprehension; stale docstring/comments updated
2. **Task 2: Partition sign-off prerequisites by axis (§36.7)**
   - `47a4163` (test, RED) — 4 new tests added to `test_signoffs_endpoints.py`; 2 confirmed failing against the pre-change endpoint
   - `b46abe3` (feat, GREEN) — `VOICE_AXES` constant, narrowed facts-cleared scan, new sounds-human branch, docstring guard-list update

**Plan metadata:** (this commit) - docs: complete plan

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py` - Layer-1 axis passthrough: `layer1 = layer1_raw` (was a comprehension forcing `axis="hard-rule"`); docstring/comments updated to describe the retired collapse without repeating the literal string (acceptance criterion: `grep -c "hard-rule"` == 0)
- `packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py` - `VOICE_AXES` module constant; `facts-cleared`'s `open_errors` filter gains `and f.get("axis") not in VOICE_AXES`; new `elif body.kind == "sounds-human":` branch scanning `open_voice_errors` (axis in VOICE_AXES) and 409ing `open_voice_findings`; module + endpoint docstrings updated
- `packages/pipeline/tests/agents/qa/test_qa_axis_passthrough.py` - NEW: 4 tests — sentiment/gravity/precision axis survival in `state['qa_corrections']`, plus a direct assertion on the captured `qaCorrections:insert` mutation payload
- `packages/pipeline/tests/test_signoffs_endpoints.py` - +4 tests: `test_sounds_human_409_open_voice_findings`, `test_sounds_human_success_no_open_voice_findings`, `test_facts_cleared_ignores_open_voice_axis_error` (Pitfall 2 regression guard), `test_facts_cleared_409_open_factual_axis_error`

## Decisions Made
- Left the pre-existing Phase 34 `test_sounds_human_ungated` test unmodified — see key-decisions above; its fixture finding has no `axis` key, so it's outside `VOICE_AXES` and remains a valid green assertion that sounds-human never consults the claims-signoff prerequisite (a narrower but still-true claim than "fully ungated")
- No new Convex query/mutation shapes introduced — both foundations reuse `qaCorrections:byRunId` (already queried by the endpoint) and the existing `_finding_to_qa_correction` / mutation-payload construction in `qa()`

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their `<action>`/`<acceptance_criteria>`/`<verify>` blocks with no auto-fixes required. One acceptance-criteria nuance: the plan's literal grep `"layer1 = layer1_raw"` doesn't match the actual line (`layer1: list[QAFinding] = layer1_raw`, which keeps the existing type annotation) — the plan's own wording anticipated this ("or an equivalent non-overriding assignment"), so this is not a deviation.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The D-05 machine-tell predicate (Plan 36-05) can now write `axis="machine-tell"` findings that will actually surface through Voice Pass's axis filter — no silent collapse to a shared bucket.
- The sign-off endpoint's `VOICE_AXES`/factual partition is live and tested; Plan 36-04 (Voice Pass screen) and 36-06 (rewrite popover + sign-off) can wire the "Sounds human" UI button directly against this server-enforced 409, with no further pipeline-side gating work needed.
- Full pipeline suite green after this plan: `cd packages/pipeline && uv run pytest -q` → 476 passed, 36 skipped, 0 failed (no regression to the shipped facts-cleared path, the QA orchestrator, or any other pipeline test).
- Reconciliation note (per plan's own verification section): this plan ran on the MAIN checkout (no worktree) — no reconciliation-onto-master step is needed before Wave 3.

---
*Phase: 36-voice-pass-de-slop-screen*
*Completed: 2026-07-09*

## Self-Check: PASSED

All claimed files exist on disk (`test_qa_axis_passthrough.py`,
`agents/qa/__init__.py`, `api/signoffs.py`, `test_signoffs_endpoints.py`,
this SUMMARY.md). All claimed commit hashes (`7a82505`, `86c120f`,
`47a4163`, `b46abe3`) are present in `git log --oneline --all`.
