---
phase: 24-prompt-editor-versioning
plan: 05a
subsystem: pipeline-prompts
tags: [prompts, externalization, byte-equivalence, qa-rubric, section-guidance]
requires:
  - "load_prompt() loader (Plan 04a) with PROMPT START/END marker convention"
  - "agents/qa/rubric.md canonical QA rubric source"
  - "SECTION_GUIDANCE / GUIDANCE_VERIFIED / GUIDANCE_ANONYMOUS in-code constants"
provides:
  - "prompts/section_guidance_origin.md (byte-identical to origin SECTION_GUIDANCE)"
  - "prompts/section_guidance_problem.md (byte-identical to problem SECTION_GUIDANCE)"
  - "prompts/section_guidance_founder_bio_verified.md / _anonymous.md"
  - "prompts/section_guidance_case_study_verified.md / _anonymous.md"
  - "prompts/rubric.md (byte-identical to agents/qa/rubric.md)"
affects:
  - "Plan 05b (call-site swaps + prompt_versions v1 seed extension)"
tech-stack:
  added: []
  patterns:
    - "Externalize in-code prompt constants to .md byte-identically via PROMPT START/END markers"
    - "Anonymous guidance variants stored UNformatted (literal {role} preserved for runtime .format)"
    - "Byte-faithful rubric copy via programmatic write to preserve trailing newline"
key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_origin.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_problem.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_founder_bio_verified.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_founder_bio_anonymous.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_case_study_verified.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_case_study_anonymous.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/rubric.md
  modified: []
decisions:
  - "Test scaffold for section-guidance/rubric byte-equivalence already existed in test_prompt_version_seeds.py (Plan-01 scaffold) — no test edits needed; authored the .md files to turn the existing RED tests GREEN"
  - "rubric.md generated programmatically (not hand-typed) to guarantee byte-fidelity of the 3492-byte source including its single trailing newline"
metrics:
  duration: 6
  completed: "2026-06-22"
---

# Phase 24 Plan 05a: Guidance + Rubric .md and Byte-Test Summary

Externalized the two Phase-22-deferred guidance corpora to disk as 7 `.md` files byte-identical to their in-code Python constants: the four section-writer guidance strings (origin, problem, founder_bio ×2, case_study ×2 — including the `STRUCTURE_CONTRACT` suffix appended at module load) and the QA `rubric.md`, with the existing byte-equivalence oracle tests turned GREEN.

## What Was Built

- **6 section_guidance_*.md files** — each authored so `load_prompt(name)` returns a string byte-identical to the FINAL Python constant (post `X = X + STRUCTURE_CONTRACT` append). The constant (not a hand copy) is the source of truth.
- **2 anonymous variants** (`founder_bio_anonymous`, `case_study_anonymous`) — store the UNformatted template with the literal `{role}` placeholder intact, so the runtime `.format(role=role)` branch in `_select_guidance_and_scrub` (founder_bio.py:111, case_study.py:104) still works unchanged.
- **rubric.md** — copied verbatim from `agents/qa/rubric.md` (3492 bytes incl. trailing newline) into `prompts/rubric.md` wrapped in PROMPT START/END markers; `load_prompt("rubric")` equals the original byte-for-byte.

## Verification

- `test_section_guidance_seed_byte_equivalence` — GREEN (all 6 guidance constants round-trip)
- `test_rubric_seed_byte_equivalence` — GREEN (rubric byte-equal)
- `test_anonymous_guidance_seed_retains_role_token` — GREEN (`{role}` preserved in both anonymous variants)
- `test_user_template_seed_byte_equivalence` (Plan 04a, 11 params) — all still GREEN (untouched)
- Acceptance greps: `STRUCTURE CONTRACT` present in origin; `{role}` present in founder_bio_anonymous; all 7 files carry PROMPT START / PROMPT END sentinels.

Only out-of-scope failure observed in the shared test file is `test_voice_constraints_seed_byte_equivalence` (Plan 06's `voice_constraints.md`, not this plan's responsibility).

## Deviations from Plan

### 1. [Rule 3 - Blocking adjustment] Test scaffold already complete — no test edits required

- **Found during:** Task 1 (read_first of test_prompt_version_seeds.py)
- **Issue:** The plan instructed to "extend test_prompt_version_seeds.py with `test_section_guidance_seed_byte_equivalence` and `test_rubric_seed_byte_equivalence` (the Plan-01 scaffolds)". On inspection, those two functions (plus `test_anonymous_guidance_seed_retains_role_token`) were already present in the file as the Plan-01 RED scaffold.
- **Fix:** Authored only the 7 `.md` files to turn the pre-existing RED tests GREEN. Made no edits to the shared test file, which also cleanly avoids clobbering the parallel 24-04b/04a executor's changes to that file.
- **Files modified:** none beyond the 7 created `.md` files.
- **Commit:** f90fee3

### 2. [Rule 1 - Correctness] rubric.md generated programmatically for byte-fidelity

- **Found during:** Task 1 (rubric authoring)
- **Issue:** The QA rubric source contains markdown headers, fenced code blocks, and a single trailing newline; a hand-typed copy risks byte drift (especially the trailing newline the loader strips one of).
- **Fix:** Wrote `rubric.md` via a Python one-liner reading the source verbatim and wrapping it with `<!-- PROMPT START -->\n{src}\n<!-- PROMPT END -->\n` so the loader's one-trailing-newline strip leaves the source's own trailing newline intact.
- **Commit:** f90fee3

## Parallel-Execution Note

Ran as a parallel executor (24-05a) alongside 24-04b. Owned only the `section_guidance_*.md` / `rubric.md` assets. Re-read the shared `test_prompt_version_seeds.py` before any action and made zero edits to it, avoiding contention. All commits used `--no-verify` per parallel-execution protocol.

## Known Stubs

None. The 7 `.md` files are real byte-faithful externalizations; call-site swaps and `prompt_versions` v1 seeding are explicitly Plan 05b's scope.

## Self-Check: PASSED

All 7 prompt .md files exist on disk, SUMMARY.md exists, and commit f90fee3 is present in git history.
