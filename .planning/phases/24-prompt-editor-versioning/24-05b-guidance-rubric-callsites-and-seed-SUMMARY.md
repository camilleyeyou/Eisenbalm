---
phase: 24-prompt-editor-versioning
plan: 05b
subsystem: pipeline
tags: [prompt-externalization, config-loader, section-guidance, rubric, seed]
requires:
  - "RunConfig.section_guidance / RunConfig.rubric (Plan 04a/22)"
  - "section_guidance_*.md + rubric.md seed files (Plan 05a)"
  - "scripts/seed_phase24_assets.py seed_assets() (Plan 04b)"
provides:
  - "Section writers + QA judge read guidance/rubric from RunConfig at run start"
  - "Seed script covers user templates + section guidance + rubric"
affects:
  - "packages/pipeline/src/eisenbalm_pipeline/agents/{origin_story,problem,founder_bio,case_study}.py"
  - "packages/pipeline/src/eisenbalm_pipeline/agents/qa/{judge,__init__}.py"
  - "packages/pipeline/scripts/seed_phase24_assets.py"
tech-stack:
  added: []
  patterns:
    - "config-first read with in-code/disk fallback (cfg.section_guidance.get(...) or CONST)"
    - "runtime .format(role=role) applied to whichever source produced the unformatted template"
key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py
    - packages/pipeline/scripts/seed_phase24_assets.py
decisions:
  - "qa/judge.run_llm_judge gained an optional rubric kwarg (None → disk _load_rubric fallback) rather than reading state directly — keeps judge.py state-agnostic; the orchestrator threads state['config'].rubric"
  - "_select_guidance_and_scrub gained a section_guidance dict param (default None) so founder_bio/case_study stay unit-testable without a full RunConfig; .format(role=role) applies to config OR code source identically"
metrics:
  duration: 12m
  completed: 2026-06-22
  tasks: 2
  files: 7
---

# Phase 24 Plan 05b: Guidance / Rubric Call-Sites and Seed Summary

Cleared the two Phase-22 deferrals at their call sites: the four section writers and the QA judge now read section guidance and the rubric from `RunConfig` (resolved once at run start), with the in-code constants / on-disk `.md` as a byte-identical fallback; the Phase 24 seed script was extended to cover `SECTION_GUIDANCE_KEYS` + `'rubric'` alongside the Plan-04b user templates.

## What Was Built

**Task 1 — Call-site swaps (5 sites across 6 files):**
- `origin_story.py` / `problem.py`: read `cfg.section_guidance.get("section_guidance_origin" | "section_guidance_problem")` with `or SECTION_GUIDANCE` fallback, guarded by `if cfg else SECTION_GUIDANCE`.
- `founder_bio.py` / `case_study.py`: `_select_guidance_and_scrub` now takes the `RunConfig.section_guidance` map; verified/anonymous branches prefer the config key (`founder_bio_verified`/`_anonymous`, `case_study_verified`/`_anonymous`) and fall back to the in-code `GUIDANCE_*`. The anonymous path keeps `.format(role=role)` applied to whichever source produced the unformatted `{role}` template — the literal `{role}` is stored UNFORMATTED in both the constant and the `.md` seed.
- `qa/judge.py`: `run_llm_judge` gained an optional `rubric` kwarg; when `None` it falls back to the on-disk `_load_rubric()` (byte-identical to legacy). `qa/__init__.py` passes `state['config'].rubric` (None when no config). `JudgeFinding` shapes, the narrator addendum, and the single-Opus-call structure are untouched.

**Task 2 — Seed extension:**
- `seed_assets()` gained a `note` kwarg for accurate per-group provenance.
- `main()` now seeds `USER_TEMPLATE_KEYS` (Plan 04b) + `SECTION_GUIDANCE_KEYS` (6 keys) + `'rubric'` (1 key), each byte-verified against the `load_prompt` oracle before `promptVersions:upsertActive` (idempotent, version stays 1).
- Dry-run byte-verify confirmed all 6 guidance keys + rubric pass `_byte_verify` round-trip.

## Verification Results

- `tests/test_voice.py` + `tests/test_section_writer_voice_propagation.py`: 8/8 PASS.
- Full suite: 306 passed, 35 skipped, with 3 pre-existing reds deselected (see Deferred Issues). `test_rubric_seed_byte_equivalence` is GREEN (Plan 05a landed `rubric.md`).
- Task 1 greps: 10 config guidance/rubric reads across edited files (≥5 required); `.format(role=` present 2× in each of founder_bio.py / case_study.py.
- Task 2: `PARSES` + `SEED_OK`; `SECTION_GUIDANCE_KEYS` ×4, `USER_TEMPLATE_KEYS` ×5 in the seed; byte-verify wired.

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Issues (out of scope — Plan 06)

Three pre-existing RED test scaffolds owned by Plan 06 (PRM-06, voice constraints). They fail identically on the 24-04b baseline BEFORE any 05b change (verified via `git stash`), and Plan 05b does not touch voice constraints. Logged in `deferred-items.md`:
- `tests/test_prompt_version_seeds.py::test_voice_constraints_seed_byte_equivalence` — needs `prompts/voice_constraints.md` (Plan 06).
- `tests/test_voice_db_override.py::test_db_override_passthrough` — needs `assemble_voice(db_voice_override=...)` (Plan 06).
- `tests/test_voice_db_override.py::test_db_override_used_when_provided` — same Plan 06 kwarg.

## Commits

- `6cf58b5` feat(24-05b): read section guidance + rubric from RunConfig at call sites
- `a77315e` feat(24-05b): extend seed script with section guidance + rubric keys

## Self-Check: PASSED

- FOUND: all 7 modified files exist on disk.
- FOUND: `6cf58b5`, `a77315e` in git log.
