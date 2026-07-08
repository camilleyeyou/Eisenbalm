---
phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
plan: 03
subsystem: pipeline
tags: [pydantic, provenance, claims, writer-agents, langgraph]

# Dependency graph
requires:
  - phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
    provides: "35-01 — full API_CONTRACTS.md §35 provenance contract (ClaimSpanRef shape, claims whitelist injection design) this plan implements verbatim"
provides:
  - "graph/blocks.py ClaimSpanRef flat sidecar model (claimId + asWritten), mirroring BodyBlock's no-oneOf discipline"
  - "lib/voice.py build_claims_block() helper + build_section_writer_prompt(claims=...) kwarg — terse claims whitelist injected into the USER message only, never system (voice isolation preserved)"
  - "5 prose writers (origin_story, problem, founder_bio, case_study, bonus[specAd]) emit claimSpans: list[ClaimSpanRef], wired to a per-run claims whitelist computed from state['research']['claims'], with D-07 lenient unknown-claimId drop (logged, never fatal)"
affects: [35-04-publisher-provenance-seeding, 35-05-galley-provenance-wash, 35-06-decision-rail-source-index]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared claims-block formatter (voice.build_claims_block) reused by both build_section_writer_prompt (4 narrative writers) and bonus.py's independent _build_spec_ad_prompt template path, so the writer-facing claims format never drifts between the two prompt-assembly mechanisms"
    - "D-07 lenient whitelist-drop: computed once per writer as `valid_ids = {c['claimId'] for c in research.get('claims', [])}`, applied to `out_dict.get('claimSpans') or []` immediately after the existing defensive dict-extraction block, logged via the module logger, never raised"

key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py
    - packages/pipeline/tests/agents/test_origin_story.py
    - packages/pipeline/tests/agents/test_problem.py
    - packages/pipeline/tests/agents/test_founder_bio.py
    - packages/pipeline/tests/agents/test_case_study.py
    - packages/pipeline/tests/agents/test_bonus.py

key-decisions:
  - "bonus.py's SpecAd branch does not call build_section_writer_prompt (it assembles system/user messages from on-disk .md templates via _build_spec_ad_prompt) — factored the claims-block formatting into a standalone, importable voice.build_claims_block(claims) helper so both prompt-assembly mechanisms produce byte-identical claims-whitelist formatting without duplicating the string-building logic"
  - "Updated 4 pre-existing voice-isolation tests' allowed-kwargs sets (+ origin_story's output-schema-shape test) to account for the new additive claims/claimSpans fields — these were forward-compatible additions made during Task 1 (RED phase) / confirmed necessary and fixed during Task 3, not scope creep"

requirements-completed: [PRV-02]

# Metrics
duration: ~15min
completed: 2026-07-08
---

# Phase 35 Plan 03: Writer ClaimSpans Summary

**5 prose writers (origin_story, problem, founder_bio, case_study, bonus's SpecAd branch) now emit a flat `claimSpans: [{claimId, asWritten}]` sidecar bound at generation time to a per-run claims whitelist injected into their user prompt, with unknown claimIds dropped leniently.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3 (TDD: RED → GREEN → GREEN)
- **Files modified:** 12

## Accomplishments
- Added `ClaimSpanRef` (flat, no `oneOf`/discriminated union — mirrors the `BodyBlock` "Phase 18 post-launch fix" incident) to `graph/blocks.py`
- Added `build_claims_block()` + a `claims` kwarg to `lib/voice.py::build_section_writer_prompt` — injects a terse `SOURCEABLE CLAIMS` whitelist (claimId + text only, per Research Pitfall 7 cost note) into the USER message; the system message and the no-claims path stay byte-identical to the pre-Phase-35 shape (voice isolation, D-05)
- Wired `claimSpans: list[ClaimSpanRef] = []` + a `claims` whitelist + a D-07 lenient unknown-claimId drop into all 4 narrative writers (`origin_story`, `problem`, `founder_bio`, `case_study`)
- Extended `bonus.py`'s `SpecAdBonus` model + `_build_spec_ad_prompt` + the `bonus()` agent function to do the same for the SpecAd branch only (D-06); reused `voice.build_claims_block()` since SpecAd's prompt assembly doesn't route through `build_section_writer_prompt`. `BigBudgetBonus`/`JingleBonus` are untouched (non-prose exempt)
- Full pipeline pytest suite: 380 passed, 33 skipped, zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: RED tests — claimSpans emitted, unknown claimId dropped, claims whitelist injected** - `907c5c6` (test)
2. **Task 2: Add ClaimSpanRef model + claims-whitelist injection in build_section_writer_prompt** - `b7e4f5f` (feat)
3. **Task 3: Add claimSpans to the 5 prose writers + wire claims + drop unknown claimIds** - `3e0bf81` (feat)

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py` - `ClaimSpanRef` sibling class to `BodyBlock`
- `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` - `build_claims_block()` helper + `claims` kwarg on `build_section_writer_prompt`
- `packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py` - `claimSpans` field, claims whitelist computation, D-07 drop
- `packages/pipeline/src/eisenbalm_pipeline/agents/problem.py` - same pattern (pdfContent shape untouched)
- `packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py` - same pattern (claims computed from unscrubbed research, per RESEARCH Pitfall 5)
- `packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py` - same pattern (mirror of founder_bio)
- `packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` - `SpecAdBonus.claimSpans`, `_build_spec_ad_prompt` claims-block injection, `bonus()` D-07 drop scoped to `bonus_type == "specAd"`
- `packages/pipeline/tests/agents/test_origin_story.py` - drop-unknown-claimId test + 3 `build_section_writer_prompt` claims-injection tests + updated output-schema-shape/allowed-kwargs assertions
- `packages/pipeline/tests/agents/test_problem.py` - drop-unknown-claimId test + updated allowed-kwargs assertion
- `packages/pipeline/tests/agents/test_founder_bio.py` - drop-unknown-claimId test + updated allowed-kwargs assertion
- `packages/pipeline/tests/agents/test_case_study.py` - drop-unknown-claimId test + updated allowed-kwargs assertion
- `packages/pipeline/tests/agents/test_bonus.py` - SpecAd drop-unknown-claimId test

## Decisions Made
- Factored the claims-whitelist string formatting into a single shared `voice.build_claims_block()` helper rather than duplicating the format string in `bonus.py` — both `build_section_writer_prompt` and `_build_spec_ad_prompt` now produce byte-identical `SOURCEABLE CLAIMS` blocks despite using two structurally different prompt-assembly mechanisms (kwarg-built strings vs. on-disk `.md` template `.replace()` calls)
- Scoped the SpecAd claimSpans/drop logic to `bonus_type == "specAd"` explicitly inside `bonus()`, rather than applying it unconditionally to `out_dict` — `BigBudgetBonus`/`JingleBonus` never gain a `claimSpans` key at all, preserving D-06's non-prose exemption
- Computed the claims whitelist from the UNSCRUBBED `research` dict in `founder_bio`/`case_study` (not the name-scrubbed copy passed to the prompt) since claim provenance is orthogonal to the founderName/subjectName anonymity scrub (RESEARCH Pitfall 5) — this matches the plan's literal instruction (`state.get("research")`, not the scrubbed variant)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 4 pre-existing voice-isolation tests' allowed-kwargs sets + 1 output-schema-shape assertion**
- **Found during:** Task 3 (wiring `claims=claims` into the 4 narrative writers)
- **Issue:** `test_{origin_story,problem,founder_bio,case_study}.py`'s `test_*_voice_isolation` tests assert `set(captured.keys()).issubset(allowed)` against a hardcoded 7-key `allowed` set. Adding the new `claims` kwarg to each writer's `build_section_writer_prompt(...)` call (required by this plan's own Task 3) would make `captured.keys()` include `"claims"`, which is not in the old `allowed` set — these 4 tests would go from GREEN to spuriously RED as a side effect of Task 3's intended change, not a genuine voice-isolation regression. Similarly, `test_origin_story.py::test_output_schema_shape` asserted `OriginStoryOutput.model_fields.keys() == {"headline", "body"}`, which no longer holds once `claimSpans` is added.
- **Fix:** Added `"claims"` to each `allowed` set (documented inline as an 8th whitelisted kwarg, mirroring the existing Phase 16 `voice_constraints` precedent); updated the output-schema-shape assertion to `{"headline", "body", "claimSpans"}`.
- **Files modified:** `test_origin_story.py`, `test_problem.py`, `test_founder_bio.py`, `test_case_study.py`
- **Verification:** Full pipeline pytest suite passes (380 passed, 33 skipped) after the fix; `voice_constraints`/`claims` additions are both provably NOT sibling-section state (the same reasoning already applied to `voice_constraints` in Phase 16 applies identically to `claims`).
- **Committed in:** `3e0bf81` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — regression fix necessitated by this plan's own intended change)
**Impact on plan:** Necessary to keep the pre-existing voice-isolation test suite green; no scope creep — the fix only touches assertions whose expected-value sets needed to grow by exactly the fields this plan added.

## Issues Encountered

**Worktree/main-checkout split:** This executor ran in an isolated parallel-execution worktree (`.claude/worktrees/agent-ac4c4ca5e276d26c6`) whose own `.planning/` directory is a stale, unrelated snapshot (Phase 30-era `STATE.md`/`ROADMAP.md`, no `phases/` subdirectory) — a leftover from whenever this worktree was created, not connected to the Phase 35 planning docs. The plan file, `35-01-SUMMARY.md`, and `docs/API_CONTRACTS.md` were read from the main checkout (`/Users/user/Desktop/Eisenbalm`), which — thanks to a `findProjectRoot()` parent-directory heuristic in `gsd-tools.cjs` (any git-repo ancestor with its own `.planning/` is treated as the project root) — is also where `gsd-tools` commands run from within this worktree actually resolve and operate. All code edits (Task 1-3 source/test files) were made and committed to the isolated worktree branch (`worktree-agent-ac4c4ca5e276d26c6`) as instructed. This `SUMMARY.md` was authored in the worktree's own `.planning/phases/.../` (created fresh, since it didn't exist) and mirrored via a plain filesystem copy into the main checkout's matching path so the `gsd-tools state`/`roadmap`/`requirements` bookkeeping commands (which resolve to the main checkout) can see it. No functional impact on the plan's actual deliverable; documented here for the orchestrator's visibility into how the shared docs commit was produced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 35-04 (Publisher provenance seeding) can now assume all 5 prose writers emit `claimSpans` alongside `body`/`headline`, and can read `state['research']['claims']` + each section's `claimSpans` to seed `claim_checks` rows with `claimId`/`sourceUrl`/`retrievedAt` per §35.4/§35.5
- Plans 35-05/35-06 (galley wash, decision rail) can rely on the writer half of the provenance contract being complete: a `claimId` present on a `claim_checks` row traces back to a real writer-declared `claimSpans` entry, never a post-hoc fuzzy match
- No blockers — Plan 35-02 (Researcher index-bound claims) runs independently in Wave 2 alongside this plan and both converge on the same `state['research']['claims']` contract shape from §35.2

---
*Phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering*
*Completed: 2026-07-08*

## Self-Check: PASSED

All 12 created/modified source and test files verified present on disk; SUMMARY.md verified present at `.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-03-SUMMARY.md`; all 3 task commit hashes (907c5c6, b7e4f5f, 3e0bf81) verified present in `git log --oneline --all`.
