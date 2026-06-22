---
phase: 24-prompt-editor-versioning
plan: 04b
subsystem: pipeline
tags: [prompts, langgraph, user-templates, asset-externalization, seed, config]

# Dependency graph
requires:
  - phase: 24-03-pipeline-asset-loading-infra
    provides: RunConfig.user_templates dict + load_prompt() marker loader + _hydrate_asset disk fallback
  - phase: 24-04a-user-template-md-and-byte-test
    provides: 11 *_user.md assets + token-name contract + GREEN byte-equivalence oracle
provides:
  - 8 agent call sites read their user-message template from RunConfig.user_templates[key] with on-disk .md fallback
  - byte-identical assembled user messages (token substitution via str.replace)
  - idempotent byte-verified seed (scripts/seed_phase24_assets.py, USER_TEMPLATE_KEYS) for the 11 active v1 user-template rows
affects: [24-05b-guidance-rubric-callsites-and-seed, 24-06-voice-versioning-and-test-run-backend, 24-07-editor-ui-variable-awareness]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Config-first user-template read: cfg.user_templates.get(key) if cfg and present else load_prompt(key), then .replace token chain"
    - "Seed script designed around seed_assets(http, agent_keys) so Plans 05b/06 reuse it by passing their own key tuples"
    - "Per-key byte-verification: assert non-empty + _extract round-trip before upsertActive (never a raw file read)"

key-files:
  created:
    - packages/pipeline/scripts/seed_phase24_assets.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/game.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py

key-decisions:
  - "Each call site mirrors the established Phase 22 system-prompt config-read shape (cfg-present guard + disk fallback) so the two reads read identically at every agent."
  - "design base user template externalized only; the D-15 regenerate-once retry-error suffix stays assembled in code (joined onto the base user via the same \\n join), preserving byte parity on both the no-retry and retry paths."
  - "editor.py gets BOTH editor_gate1_user and editor_final_user; editor_final extracts the two json.dumps(...) results into named variables (qa_corrections_json / section_headlines_json) to feed the {token} replace chain."
  - "Seed script accepts a passed-in key iterable (seed_assets) and seeds USER_TEMPLATE_KEYS for this plan; Plans 05b/06 extend it without re-editing the core."

# Metrics
duration: 6min
completed: 2026-06-22
---

# Phase 24 Plan 04b: User-Template Call-Sites and Seed Summary

**Switched all 8 agent `_build_messages` user-message constructions to read from `RunConfig.user_templates[agentKey]` (with on-disk `.md` fallback) and added an idempotent, byte-verified seed script that upserts the 11 user-template rows — assembled user messages stay byte-identical to the pre-externalization inline strings.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-22T10:19:42Z
- **Completed:** 2026-06-22T10:26:19Z
- **Tasks:** 2
- **Files modified:** 9 (1 created, 8 modified)

## Accomplishments

- **Task 1 (`f0d9be2`):** Replaced the inline `user = (...)` construction in every agent's `_build_messages` with a config-first read: `cfg.user_templates.get("<key>") if cfg and cfg.user_templates.get("<key>") else load_prompt("<key>")`, followed by the `str.replace("{token}", value)` chain using the exact tokens captured in Plan 04a. Covered scout, advocate, calibrator (static, no tokens), editor (both gate-1 + final), researcher, game, design (base no-retry), and all three bonus variants. System-prompt read paths and message role order ([system, user]) left unchanged.
- **Task 2 (`f5b5d16`):** Created `scripts/seed_phase24_assets.py` — iterates `USER_TEMPLATE_KEYS`, sources content via `load_prompt` (the byte oracle, never a raw read), byte-verifies each (non-empty + `_extract` round-trip), and upserts via `promptVersions:upsertActive` (idempotent: version stays 1, isActive stays true). Designed around `seed_assets(http, agent_keys)` so Plans 05b/06 extend it.

## Task Commits

1. **Task 1 — agent call-site swaps** — `f0d9be2` (feat)
2. **Task 2 — idempotent byte-verified seed** — `f5b5d16` (feat)

**Plan metadata:** _(final docs commit)_

## Token Map (per call site)

| Agent | Key | Tokens |
| --- | --- | --- |
| scout | `scout_user` | `{results_block}` |
| advocate | `advocate_user` | `{candidates_json}` |
| calibrator | `calibrator_user` | (static) |
| editor gate1 | `editor_gate1_user` | `{issue_number}`, `{candidates_block}` |
| editor final | `editor_final_user` | `{qa_corrections_json}`, `{section_headlines_json}` |
| researcher | `researcher_user` | `{charity}`, `{results_block}` |
| game | `game_user` | `{charity_name}`, `{mission_statement}` |
| design | `design_user` | `{charity_name}`, `{visual_direction}` (base only) |
| bonus ×3 | `bonus_big_budget_user` / `bonus_jingle_user` / `bonus_spec_ad_user` | `{charity_name}`, `{mission_statement}`, `{visual_direction}` |

## Verification Results

- `tests/test_prompt_version_seeds.py::test_user_template_seed_byte_equivalence` + `tests/test_voice.py` + `tests/test_section_writer_voice_propagation.py` — **19 passed** (the owned byte-equivalence oracle + all voice/structure tripwires green).
- `grep -rho "user_templates.get" .../agents/` → 22 occurrences across all 8 edited files (≥8 required); editor.py contains both `editor_gate1_user` and `editor_final_user`.
- Task 2 verify: `PARSES` + `SEED_OK`; `_byte_verify` passes for all 11 user-template keys; `upsertActive` ×4, `USER_TEMPLATE_KEYS` ×4 in the script.

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Issues

The full pipeline suite (`uv run pytest -x -q`) is NOT 0-exit because four tests fail — but all four are **pre-existing RED scaffolds owned by later plans**, failing identically before and after 04b's changes (verified via `git stash`):

1. `test_prompt_version_seeds.py::test_voice_constraints_seed_byte_equivalence` — needs `prompts/voice_constraints.md` (Plan 06).
2. `test_prompt_version_seeds.py::test_rubric_seed_byte_equivalence` — needs `prompts/rubric.md` (Plan 05b).
3. `test_voice_db_override.py::test_db_override_passthrough` — needs `assemble_voice(db_voice_override=...)` kwarg (Plan 06).
4. `test_voice_db_override.py::test_db_override_used_when_provided` — same Plan 06 kwarg.

These were called out as out-of-scope in the 24-04a SUMMARY "Scope Boundary Note" (each carries an explicit `RED until Plan 06` / asset-not-yet-seeded comment). Logged to `deferred-items.md`. Plan 04b owns only `test_user_template_seed_byte_equivalence`, which is GREEN. No 04b-introduced regressions — every test that passed before 04b still passes.

## Known Stubs

None. The seed script is operator-runnable; no placeholder/empty-value stubs introduced.

## Next Phase Readiness

- Plan 05b can extend `seed_assets(http, agent_keys)` with `SECTION_GUIDANCE_KEYS` (+ later the rubric) and swap the narrative-section guidance call sites the same way.
- Plan 07 (editor UI variable awareness) can rely on the `{token}` names surfaced per user template here as the editable-variable contract.

---
*Phase: 24-prompt-editor-versioning*
*Completed: 2026-06-22*

## Self-Check: PASSED
- `packages/pipeline/scripts/seed_phase24_assets.py` verified present on disk.
- `24-04b-SUMMARY.md` verified present.
- Both task commits (`f0d9be2`, `f5b5d16`) verified in git history.
