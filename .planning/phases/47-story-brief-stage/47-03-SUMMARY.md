---
phase: 47-story-brief-stage
plan: 03
subsystem: pipeline
tags: [langgraph, python, prompt-engineering, voice, pytest]

# Dependency graph
requires:
  - phase: 47-story-brief-stage
    plan: 02
    provides: "graph/state.py: Brief TypedDict + DispatchState['brief']; agents/editor.py: _assemble_brief deterministically populating state['brief'] on every editor_gate_1 winner-resolution path"
provides:
  - "lib/voice.py: build_brief_block(brief) — the shared, None-safe Story Brief formatter reused by build_section_writer_prompt AND the 3 bespoke writer prompt builders"
  - "lib/voice.py: build_section_writer_prompt gains a keyword-only 5th `brief` param (default None), rendered into the USER message only — brief=None is byte-identical to the pre-Phase-47 shape"
  - "All 7 SECTION_WRITERS (origin_story, problem, founder_bio, case_study, game, bonus, design) thread state.get(\"brief\") into their prompts — the 4 helper-routed writers via build_section_writer_prompt's brief= kwarg, the 3 bespoke builders (game, bonus's 3 branches, design) via direct build_brief_block() calls"
affects: [47-07-brief-field-table-and-strengthen, 47-08-story-brief-screen-mount-and-phase-gate, 48-start-from-my-brief]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared None-safe block formatter reused across a hard-invariant helper AND bespoke callers: build_brief_block(brief) is the single formatting source of truth for all 7 writers, avoiding 3 duplicated ad-hoc renderings in game.py/bonus.py/design/__init__.py while keeping build_section_writer_prompt's AGT-09 4(+1)-content-param invariant intact"
    - "Deliberate 5th content-block addition to a code-reviewed prompt-isolation invariant: brief is documented in build_section_writer_prompt's docstring as the deliberate Phase-47 exception to the 'ONLY the four content blocks' rule, not a workaround around it"

key-files:
  created:
    - packages/pipeline/tests/agents/test_writer_brief_threading.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/game.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
    - packages/pipeline/tests/lib/test_voice.py
    - packages/pipeline/tests/agents/test_problem.py
    - packages/pipeline/tests/agents/test_origin_story.py
    - packages/pipeline/tests/agents/test_founder_bio.py
    - packages/pipeline/tests/agents/test_case_study.py

key-decisions:
  - "Extracted a shared build_brief_block(brief) formatter in lib/voice.py rather than duplicating the six-field rendering logic three times in game.py/bonus.py/design/__init__.py — one formatting source of truth for all 7 writers, consistent with how build_claims_block is already shared between build_section_writer_prompt and bonus.py's SpecAd branch."
  - "The 3 bespoke writer prompt builders (game, bonus's 3 internal builders, design) call build_brief_block(state.get(\"brief\")) directly and append its output to their user prompt string, rather than threading a `brief` parameter through their function signatures — since each already receives `state` as a parameter, this is the smaller, more mechanical change and keeps the None-safe append pattern identical to how bonus.py's SpecAd branch already appends build_claims_block."
  - "Updated the 4 pre-existing AGT-09 voice-isolation whitelist tests (test_origin_story/problem/founder_bio/case_study.py's `allowed` kwarg sets) to include \"brief\" — these tests assert build_section_writer_prompt is called with ONLY a whitelisted kwarg set, and this plan's Task 1 interfaces block explicitly documents brief as the deliberate 5th content block, so the whitelist itself needed updating, not the new brief= call site."

patterns-established:
  - "When a hard-invariant helper (documented 'accepts ONLY N content blocks, code review flags workarounds') needs a deliberate new content block, add it as an explicitly-documented, None-safe optional kwarg with a shared formatter function reused by any bespoke callers that bypass the helper entirely — one formatting source of truth, one signature change, mechanical call-site updates."

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-07-16
---

# Phase 47 Plan 03: Writer Brief Threading Summary

**`build_section_writer_prompt` gained a keyword-only 5th `brief` param + a shared `build_brief_block` formatter in `lib/voice.py`; all 7 section writers (4 via the helper's `brief=` kwarg, 3 bespoke builders via direct `build_brief_block()` calls) now thread `state.get("brief")` into their prompts, completing BRF-05's "section writers draft from it" half.**

## Performance

- **Duration:** 5 min (task commits 04:23:15 → 04:27:47 PDT)
- **Started:** 2026-07-16T11:23:15Z
- **Completed:** 2026-07-16T11:27:47Z
- **Tasks:** 2
- **Files modified:** 13 (1 new test file, 12 modified)

## Accomplishments
- `lib/voice.py` gained `build_brief_block(brief)` — a shared, None-safe formatter rendering the six Story Brief fields (premise, currentPeg, centralClaim, readerEffect, knownRisks, voiceIntention) into a "STORY BRIEF (draft from this)" USER-message block, returning `""` when `brief` is falsy so every call site can concatenate unconditionally.
- `build_section_writer_prompt` gained a keyword-only `brief: dict[str, Any] | None = None` param, documented in its docstring as the deliberate Phase-47 exception to the AGT-09 "ONLY four content blocks" invariant. `brief=None` produces a message list byte-identical to the pre-Phase-47 shape; a supplied brief's six values render in the USER message only, never the SYSTEM message.
- All 4 helper-routed writers (`origin_story.py:125`, `problem.py:158`, `founder_bio.py:173`, `case_study.py:168`) now pass `brief=state.get("brief")` into `build_section_writer_prompt`.
- The 3 bespoke prompt builders — `game.py::_build_messages`, `bonus.py`'s 3 internal builders (`_build_big_budget_prompt`, `_build_jingle_prompt`, `_build_spec_ad_prompt`), and `design/__init__.py::_build_messages` — each call `build_brief_block(state.get("brief"))` directly and append the (possibly empty) result to their user prompt, since none of them route through `build_section_writer_prompt` (confirmed per 47-RESEARCH Pattern 5 / this plan's accuracy correction).
- `grep -rl 'state.get("brief")'` across all 7 writer modules returns exactly 7 — every SECTION_WRITER threads the Brief.
- Updated the 4 pre-existing AGT-09 voice-isolation whitelist tests to include `"brief"` as an allowed kwarg (it is now a deliberate 5th content block, not a violation of the isolation invariant).
- New `test_writer_brief_threading.py`: source-level proof (via `inspect.getsource`) that all 7 modules reference `state.get("brief")`, plus a behavioral capture test confirming the 4 helper writers forward the exact `state["brief"]` value into `build_section_writer_prompt`'s `brief=` kwarg.
- Full pipeline suite: 661 passed, 37 skipped, zero regressions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 5th `brief` param to build_section_writer_prompt + render it** - `30623d1` (feat)
2. **Task 2: Pass the Brief into all 7 section writers** - `47d0de1` (feat)

_No TDD RED/GREEN split — both `type="auto" tdd="true"`/`type="auto"` tasks landed implementation + tests in one commit each, per this project's established single-commit-per-auto-task convention (e.g. 47-02's identical note)._

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` - `build_brief_block(brief)` shared formatter; `build_section_writer_prompt` gains the `brief` param + USER-message rendering
- `packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py` - `brief=state.get("brief")` added to the `build_section_writer_prompt` call
- `packages/pipeline/src/eisenbalm_pipeline/agents/problem.py` - same
- `packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py` - same
- `packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py` - same
- `packages/pipeline/src/eisenbalm_pipeline/agents/game.py` - `_build_messages` appends `build_brief_block(state.get("brief"))` to the user prompt
- `packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` - all 3 internal prompt builders (`_build_big_budget_prompt`, `_build_jingle_prompt`, `_build_spec_ad_prompt`) append the Brief block
- `packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` - `_build_messages` appends the Brief block (voiceIntention informs visual direction)
- `packages/pipeline/tests/lib/test_voice.py` - brief=None byte-identity test, six-values-in-USER-not-SYSTEM test, keyword-only signature test, `build_brief_block` None-safety tests
- `packages/pipeline/tests/agents/test_problem.py`, `test_origin_story.py`, `test_founder_bio.py`, `test_case_study.py` - AGT-09 whitelist `allowed` sets updated to include `"brief"`
- `packages/pipeline/tests/agents/test_writer_brief_threading.py` (new) - source-grep proof for all 7 modules + behavioral capture test for the 4 helper writers

## Decisions Made
- **Shared `build_brief_block` formatter** rather than duplicating the six-field rendering logic three times: one formatting source of truth for all 7 writers, mirroring how `build_claims_block` is already shared between `build_section_writer_prompt` and `bonus.py`'s SpecAd branch.
- **Bespoke builders call `build_brief_block` directly** rather than threading a new `brief` parameter through their function signatures — each already receives `state`, so `state.get("brief")` at the call site is the smaller, more mechanical change, consistent with how `bonus.py`'s SpecAd branch already appends `build_claims_block`'s output.
- **Updated the 4 pre-existing whitelist tests** (`allowed = {...}` sets in `test_origin_story/problem/founder_bio/case_study.py`) to include `"brief"` — these AGT-09 tests assert `build_section_writer_prompt` is called with ONLY a whitelisted kwarg set; the plan's own interfaces block documents `brief` as the deliberate 5th content block, so the whitelist needed updating (Rule 1 — the failure was caused directly by this task's own change, not a pre-existing/unrelated issue).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 4 pre-existing AGT-09 voice-isolation whitelist tests broken by this task's own change**
- **Found during:** Task 2 (running the full pipeline suite after threading `brief` into the 4 helper writers)
- **Issue:** `test_origin_story.py::test_origin_story_voice_isolation` and its 3 siblings (`problem`, `founder_bio`, `case_study`) assert `set(captured.keys()).issubset(allowed)` where `allowed` is a hardcoded whitelist of `build_section_writer_prompt` kwargs. Adding `brief=state.get("brief")` at each writer's call site made `captured.keys()` a superset of the old `allowed` set, failing all 4 tests.
- **Fix:** Added `"brief"` to each test's `allowed` set with a comment explaining it as the Phase 47 deliberate 5th content block (mirroring the existing comments for `voice_constraints`/`claims`'s prior additions).
- **Files modified:** `packages/pipeline/tests/agents/test_problem.py`, `test_origin_story.py`, `test_founder_bio.py`, `test_case_study.py`
- **Verification:** `uv run pytest tests/ -q` → 661 passed, 37 skipped (was 4 failed / 657 passed before the fix)
- **Committed in:** `47d0de1` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, caused directly by this task's own change)
**Impact on plan:** Necessary correctness fix — no scope creep. The whitelist test's purpose (AGT-09: `build_section_writer_prompt` receives only intentional content blocks) is preserved; `brief` is exactly such an intentional block per this plan's own interfaces.

## Issues Encountered
None beyond the auto-fixed whitelist tests above.

## User Setup Required

None - no external service configuration required. No Convex/pipeline-secret changes in this plan (that landed in 47-01/47-02/47-04); this plan is pure prompt-assembly wiring.

## Requirements Traceability Note

This plan's frontmatter lists `requirements: [BRF-05]`. Following the precedent 47-01, 47-02, and 47-04 each established explicitly in their own SUMMARYs: `requirements mark-complete BRF-05` was **intentionally NOT run**. BRF-05's full text is "An **editable** Brief ... is generated after selection, and the section writers draft *from* it." This plan completes the "section writers draft from it" half (verified: all 7 writers thread `state.get("brief")`, confirmed by both a source-grep test and a behavioral kwarg-capture test). The "editable" half's backend boundary already landed in 47-04 (`PATCH /issues/{run_id}/brief`), but per 47-04's own note, BRF-05 describes **operator-visible** end-to-end capability that isn't usable until the console UI (47-07's `BriefFieldTable`) actually exposes editing. `BRF-05` in `.planning/REQUIREMENTS.md` stays `[ ]`; it should flip when 47-07 lands the consuming frontend and the full loop (generate → editable in console → writers draft from the possibly-edited version) is genuinely operator-visible.

## Next Phase Readiness

- Every one of the 7 section writers now drafts from `state["brief"]` when present, and degrades byte-identically to pre-Phase-47 behavior when `state["brief"]` is `None` (legacy runs, or a run that hasn't reached `editor_gate_1` under some future refactor) — no writer can crash on a missing/absent Brief.
- `lib/voice.py::build_brief_block` is now the single reusable formatter any future writer or prompt-assembly code can call to render the Brief consistently — Phase 48 ("Start from my brief") can reuse it if it needs to preview how a hand-authored Brief will render into a writer's prompt.
- No blockers. Full pipeline pytest suite (661 passed, 37 skipped) is green with zero regressions from this plan's changes.

---
*Phase: 47-story-brief-stage*
*Completed: 2026-07-16*

## Self-Check: PASSED

All files verified present and modified as claimed (lib/voice.py, 7 agent files, 5 test files including
the new test_writer_brief_threading.py). Both task commit hashes (30623d1, 47d0de1) verified present in
`git log`. Full pytest suite (661 passed, 37 skipped) re-confirmed green after the summary was drafted.
