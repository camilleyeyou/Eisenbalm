---
phase: 36-voice-pass-de-slop-screen
plan: 05
subsystem: api
tags: [pipeline, qa, machine-tell, ai-slop, voice-pass, tdd]

# Dependency graph
requires:
  - phase: 36-voice-pass-de-slop-screen
    provides: "Plan 36-01 — Convex qaCorrections.axis union gains the machine-tell literal (so this predicate's findings actually persist instead of silently dropping)"
  - phase: 36-voice-pass-de-slop-screen
    provides: "Plan 36-02 — agents/qa/__init__.py Layer-1 axis passthrough (predicate axis is written verbatim, not collapsed to hard-rule)"
provides:
  - "agents/qa/rules.py::check_machine_tell + MACHINE_TELL_LEXICON — a conservative, high-precision v1 AI-slop lexicon (delve, tapestry, a testament to, it's important to note, etc.) emitting axis=\"machine-tell\" findings"
  - "check_machine_tell registered in run_all_predicates's per-section fan-out — seeds the machine-tell findings Voice Pass (36-04) reads instantly"
  - "rubric.md (+ its byte-identical prompts/rubric.md lockstep mirror) documents the machine-tell axis as rules-only — the judge's Evaluation Axes/Output Format are untouched"
affects: [36-04-voice-pass-screen, 36-06-rewrite-popover-signoff]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New Layer-1 predicate mirrors check_sentiment_keywords structurally verbatim (module-level regex list + re.finditer + 30-char quotedSpan window) — zero new mechanism, just a new axis + lexicon"
    - "Lockstep-sync discipline extended to a THIRD location discovered at verification time: agents/qa/rules.py <-> agents/qa/rubric.md <-> src/eisenbalm_pipeline/prompts/rubric.md (the Convex-seed-loader byte-mirror) — all three must move together"

key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/rubric.md
    - packages/pipeline/tests/agents/qa/test_rules.py

key-decisions:
  - "Conservative v1 lexicon of 12 regex patterns (delve, tapestry, a testament to, in the realm of, it's important/worth noting, navigate the landscape, underscores the importance, not-only-but-also correlative overuse, at the end of the day, ever-evolving, plays a pivotal/crucial/vital role) — favors precision over recall since severity='error' gates the Sounds-human sign-off; Andrew extends the list over time via Keep-not-a-tell dismissals (per 36-CONTEXT D-05/D-09)"
  - "Did NOT mirror the machine-tell lexicon into lib/voice.py's generation-time forbidden sets — Claude's-discretion call per 36-CONTEXT D-05: this is a Voice-Pass-specific detection-time addition, not a writer-prompt constraint, in v1"
  - "Did NOT add machine-tell to judge.py's JudgeFinding.axis Literal — stays a rules-only axis per the plan's explicit instruction; verified via grep (structural-variety count=1, machine-tell count=0 in judge.py)"

requirements-completed: [VOX-01, VOX-04]

# Metrics
duration: ~10min
completed: 2026-07-09
---

# Phase 36 Plan 05: Machine-Tell Predicate Summary

**New `check_machine_tell` Layer-1 QA predicate with a conservative 12-pattern AI-slop lexicon (delve, tapestry, "a testament to", "it's important to note", etc.) emitting `axis="machine-tell"` findings, registered in `run_all_predicates`, proven RED-first including a dedicated over-fire guard against legitimate factual prose.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2 completed
- **Files modified:** 4 (3 pipeline source/prompt files, 1 test file)

## Accomplishments
- `agents/qa/rules.py` gains `MACHINE_TELL_LEXICON` (12 word-boundaried regex patterns) + `check_machine_tell(section_id, body)`, mirroring `check_sentiment_keywords`'s structure exactly (iterate lexicon, `re.finditer` case-insensitive, 30-char `quotedSpan` window, `severity="error"`, `axis="machine-tell"`)
- Registered in `run_all_predicates`'s per-section fan-out loop alongside the four existing predicates — machine-tell findings are now seeded at pipeline QA time for every run, ready to flow through the Phase 36 axis pipeline: rules.py -> qaCorrections (36-01's Convex literal) -> Voice Pass screen (36-04)
- Four RED-first tests added to `test_rules.py`: a fire test (delve + tapestry, >=2 findings), a phrase-hit test ("a testament to" + "it's important to note" both independently detected), an **over-fire guard** (plain factual clinic-stats prose yields zero findings — the conservative-lexicon requirement from the plan's `<important>` block), and a registration proof against `run_all_predicates`
- `rubric.md` documents the new axis under a "Machine-tells (deterministic, Layer-1 only)" subsection: rules-only, pointer (not restatement) to `rules.py` as the lexicon's single source of truth, explicit statement that the judge does NOT emit this axis — its Evaluation Axes/Output Format are untouched (verified: `structural-variety` count=1, `machine-tell` count=0 in `judge.py`)
- Full pipeline suite green after this plan: **480 passed, 36 skipped** (was 476/36 after Plan 36-02 — net +4 from this plan's new tests, zero regressions)

## Task Commits

Each task was committed atomically (TDD RED->GREEN pair for Task 1, plus a discovered lockstep-fix commit):

1. **Task 1: Add check_machine_tell predicate + lexicon, register in run_all_predicates**
   - `af93af3` (test, RED) — 4 new tests added to `test_rules.py`; confirmed failing (`ImportError: cannot import name 'check_machine_tell'`) against the pre-change `rules.py`
   - `d16e065` (feat, GREEN) — `MACHINE_TELL_LEXICON` + `check_machine_tell` added; registered in `run_all_predicates`
2. **Task 2: Document the machine-tell axis + lockstep note in rubric.md**
   - `0b25ba2` (docs) — `agents/qa/rubric.md` gains the Machine-tells subsection
   - `9517d54` (fix) — Rule 3 auto-fix: `src/eisenbalm_pipeline/prompts/rubric.md` (the Convex-seed byte-mirror of `agents/qa/rubric.md`, enforced by `test_rubric_seed_byte_equivalence`) updated in lockstep — discovered as a blocking failure only when the plan's mandated full-suite run surfaced it

**Plan metadata:** (this commit) - docs: complete plan

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py` - `MACHINE_TELL_LEXICON` module constant (12 patterns) + `check_machine_tell` predicate; registered in `run_all_predicates`
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md` - New "Machine-tells (deterministic, Layer-1 only)" subsection under "Forbidden", with a lockstep pointer to `rules.py`
- `packages/pipeline/src/eisenbalm_pipeline/prompts/rubric.md` - Byte-mirror update (between the `PROMPT START`/`PROMPT END` markers) to keep `load_prompt("rubric")` byte-identical to `agents/qa/rubric.md`
- `packages/pipeline/tests/agents/qa/test_rules.py` - +4 tests: `test_machine_tell_lexicon_caught`, `test_machine_tell_phrase_hits`, `test_machine_tell_over_fire_guard`, `test_machine_tell_registered_in_run_all_predicates`

## Decisions Made
- Lexicon kept conservative/high-precision (12 patterns, all word-boundaried or phrase-anchored) since `severity="error"` gates the "Sounds human" sign-off (Phase 36 D-12) — false positives are costly (block sign-off), false negatives are cheap (Andrew catches them manually or the on-demand judge catches them later per D-06)
- Left `lib/voice.py`'s generation-time forbidden sets untouched — the machine-tell lexicon is a Voice-Pass detection-time addition only in v1, per 36-CONTEXT D-05's explicit "Claude's discretion" carve-out
- Left `judge.py`'s `JudgeFinding.axis` Literal and rubric's "Evaluation Axes"/"Output Format" sections untouched — machine-tell is unambiguously rules-only per the plan's `<action>` instruction

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Synced `prompts/rubric.md` lockstep mirror**
- **Found during:** Task 2 verification (the plan's mandated `cd packages/pipeline && uv run pytest -q` full-suite run)
- **Issue:** `src/eisenbalm_pipeline/prompts/rubric.md` is a byte-identical mirror of `agents/qa/rubric.md` consumed by `load_prompt("rubric")` (the Convex-seed loader path); `test_prompt_version_seeds.py::test_rubric_seed_byte_equivalence` asserts byte-equality between the two. Editing only `agents/qa/rubric.md` (per the plan's literal task text) broke this invariant and failed the full suite.
- **Fix:** Applied the identical "Machine-tells" subsection edit to `prompts/rubric.md` between its `<!-- PROMPT START -->`/`<!-- PROMPT END -->` markers, restoring byte-equality.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/prompts/rubric.md`
- **Verification:** `uv run pytest tests/test_prompt_version_seeds.py -q` → 15 passed; full suite re-run → 480 passed, 36 skipped, 0 failed
- **Committed in:** `9517d54`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary correctness fix to honor the plan's own "lockstep-sync note (rules.py <-> lib/voice.py <-> rubric.md)" instruction — the plan's phrasing named two lockstep files but the codebase has a third (the Convex-seed mirror) that the same invariant applies to. No scope creep; caught by the plan's own mandated full-suite verification step.

## Issues Encountered
None beyond the deviation above.

## User Setup Required

None - no external service configuration required. The new `machine-tell` axis literal was already added to the Convex validators in Plan 36-01; this plan's findings will persist through the existing pipeline write path (`agents/qa/__init__.py`, Plan 36-02) with no further Convex/dashboard changes needed.

## Next Phase Readiness

- Every pipeline run now seeds `axis="machine-tell"` findings at QA time for any of the 12 lexicon patterns present in the six writer sections — combined with 36-01 (Convex literal) and 36-02 (axis passthrough), these findings reach Convex `qaCorrections` unmodified and will render instantly on Plan 36-04's Voice Pass screen (VOX-04's "deterministic rules render instantly").
- Plan 36-04 (Voice Pass screen) and 36-06 (rewrite popover + sign-off) have a live, non-empty machine-tell data source to build the "lights machine-tells inline" UI (VOX-01) and the tell-count against.
- Full pipeline suite green: `cd packages/pipeline && uv run pytest -q` → 480 passed, 36 skipped, 0 failed (no regression to any prior-phase test).
- Reconciliation note (per plan's own verification section): this plan ran on the MAIN checkout (no worktree) — no reconciliation-onto-master step is needed before Wave 3; the `rules.py` change is already on `master`.

---
*Phase: 36-voice-pass-de-slop-screen*
*Completed: 2026-07-09*

## Self-Check: PASSED

All claimed files exist on disk (`rules.py`, `agents/qa/rubric.md`,
`prompts/rubric.md`, `test_rules.py`, this SUMMARY.md). All claimed commit
hashes (`af93af3`, `d16e065`, `0b25ba2`, `9517d54`) are present in
`git log --oneline --all`.
