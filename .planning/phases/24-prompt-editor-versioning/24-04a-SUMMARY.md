---
phase: 24-prompt-editor-versioning
plan: 04a
subsystem: testing
tags: [prompts, langgraph, byte-equivalence, asset-externalization, pipeline]

# Dependency graph
requires:
  - phase: 24-03-pipeline-asset-loading-infra
    provides: load_prompt() marker-extraction loader + RunConfig.user_templates dict
  - phase: 24-01-contracts-and-test-scaffold
    provides: test_prompt_version_seeds.py RED scaffold + USER_TEMPLATE_KEYS enumeration
provides:
  - 11 versioned *_user.md user-prompt template assets (byte-identical to inline _build_messages strings)
  - GREEN byte-equivalence oracle (test_user_template_seed_byte_equivalence) for all 11 keys
  - Token-name contract (the {token} placeholders) that Plan 04b consumes for call-site swaps
affects: [24-04b-user-template-callsites-and-seed, 24-07-editor-ui-variable-awareness]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "User-template externalization mirrors the system-prompt .md + PROMPT START/END marker convention"
    - "{token} + str.replace() runtime substitution (NEVER str.format — literal braces survive in prose)"
    - "Byte-equivalence oracle derives expected value from the agent's own _build_messages, not a hand-copied literal"

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/prompts/scout_user.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/advocate_user.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/calibrator_user.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/editor_gate1_user.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/editor_final_user.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/game_user.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/design_user.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/bonus_big_budget_user.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/bonus_jingle_user.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/bonus_spec_ad_user.md
  modified:
    - packages/pipeline/tests/test_prompt_version_seeds.py

key-decisions:
  - "Test derives expected user string from the agent's live _build_messages (disk-fallback path) rather than a hardcoded literal — the oracle stays in lockstep with the source even if the inline strings are later reformatted before Plan 04b swaps them."
  - "design_user.md captures only the base no-retry user message; the validation-retry error suffix (D-15 regenerate-once) stays assembled in code, not in the asset."
  - "calibrator_user is a static template with no tokens (its inline user string interpolates nothing)."

patterns-established:
  - "Each *_user.md uses the same editorial-header-then-PROMPT-START/END layout as the system *.md files; load_prompt strips exactly one leading + one trailing newline for byte parity."
  - "Token names match the runtime variable they replace (results_block, candidates_json, charity_name, mission_statement, visual_direction, etc.) so Plan 04b's call-site .replace() chain is mechanical."

requirements-completed: [PRM-01]

# Metrics
duration: 9min
completed: 2026-06-22
---

# Phase 24 Plan 04a: User-Template MD and Byte-Test Summary

**Externalized all 11 agent inline user-message templates into versioned `*_user.md` assets (byte-identical to the inline `_build_messages` strings) and turned the byte-equivalence oracle GREEN.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-22T10:06:00Z
- **Completed:** 2026-06-22T10:15:00Z
- **Tasks:** 1 (TDD)
- **Files modified:** 12 (11 created, 1 modified)

## Accomplishments
- Captured the inline `user = (...)` string from every agent's `_build_messages` (scout, advocate, calibrator, editor gate1, editor final, researcher, game, design, 3× bonus) into a versioned `*_user.md` file.
- Replaced each runtime f-string interpolation with a literal `{token}` placeholder named to match the runtime variable, using the established `str.replace()` convention (never `str.format`).
- Made `test_user_template_seed_byte_equivalence` GREEN for all 11 keys with real assertions (no xfail/TODO remaining), each comparing `load_prompt(key)` + token substitution against the agent's live `_build_messages` output.

## Task Commits

TDD task — RED then GREEN:

1. **Task 1 (RED): real byte-equivalence assertions** - `4539ad0` (test)
2. **Task 1 (GREEN): 11 externalized user templates** - `3abb524` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `prompts/scout_user.md` — `{results_block}` token
- `prompts/advocate_user.md` — `{candidates_json}` token
- `prompts/calibrator_user.md` — static (no tokens)
- `prompts/editor_gate1_user.md` — `{issue_number}`, `{candidates_block}` tokens
- `prompts/editor_final_user.md` — `{qa_corrections_json}`, `{section_headlines_json}` tokens
- `prompts/researcher_user.md` — `{charity}`, `{results_block}` tokens
- `prompts/game_user.md` — `{charity_name}`, `{mission_statement}` tokens
- `prompts/design_user.md` — `{charity_name}`, `{visual_direction}` tokens (base no-retry only)
- `prompts/bonus_big_budget_user.md` / `bonus_jingle_user.md` / `bonus_spec_ad_user.md` — `{charity_name}`, `{mission_statement}`, `{visual_direction}` tokens
- `tests/test_prompt_version_seeds.py` — replaced xfail placeholder with 11 real per-key assertions

## Decisions Made
- **Oracle derives expected from live code:** rather than hand-copying each inline literal into the test, the test calls each agent's own `_build_messages(...)` with fixed synthetic inputs and compares against `load_prompt(key)` with the same tokens substituted. This keeps the byte-equivalence proof robust and self-checking.
- **design_user base-only:** the DesignAgent retry path appends prior validation errors in code (D-15). Only the base user message is externalized; the retry suffix is intentionally not part of the asset.

## Deviations from Plan

None — plan executed exactly as written. The plan anticipated `_build_messages` signatures; the only mid-task adjustment was passing `state=_STATE` to `calibrator._build_messages` (its signature is keyword-only `state`-first), which is a test-fixture detail, not a plan deviation.

## Issues Encountered
- Initial test run failed on `calibrator_user` because `calibrator._build_messages` requires a keyword-only `state` argument (unlike the plan's read-first note line numbers implied). Fixed by passing `state=_STATE`; all 11 keys then passed.

## Scope Boundary Note
The same test file also carries the RED scaffolds for Plans 05a (section guidance + rubric) and 06 (voice constraints): `test_section_guidance_seed_byte_equivalence`, `test_anonymous_guidance_seed_retains_role_token`, `test_voice_constraints_seed_byte_equivalence`, `test_rubric_seed_byte_equivalence`. These remain RED by design (their assets land in later plans) and are out of scope for Plan 04a, which owns only `test_user_template_seed_byte_equivalence` (11/11 GREEN).

## Next Phase Readiness
- Plan 04b can now swap the 11 call sites to `load_prompt("<key>_user").replace(...)` / `config.user_templates[...]` and seed the `prompt_versions` v1 rows. The token names are fixed and the byte-equivalence oracle guards the swap.

---
*Phase: 24-prompt-editor-versioning*
*Completed: 2026-06-22*

## Self-Check: PASSED
- All 11 `*_user.md` files verified present on disk.
- SUMMARY.md verified present.
- Both task commits (`4539ad0`, `3abb524`) verified in git history.
