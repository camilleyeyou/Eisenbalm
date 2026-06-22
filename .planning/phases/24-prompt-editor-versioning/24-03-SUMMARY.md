---
phase: 24-prompt-editor-versioning
plan: 03
subsystem: pipeline-config
tags: [config-loader, prompt-versions, asset-hydration, runconfig, cfg-03]
requires:
  - "24-01: prompt_versions schema + canonical agentKey list (API_CONTRACTS §4A.2b)"
provides:
  - "RunConfig.{voice_constraints,user_templates,section_guidance,rubric} — typed home for the newly-externalized assets"
  - "USER_TEMPLATE_KEYS / SECTION_GUIDANCE_KEYS / SINGLETON_ASSET_KEYS / SYSTEM_PROMPT_KEYS registries"
  - "_hydrate_asset() + _load_prompt_or_none() — per-key Convex→disk fallback, missing-file safe"
affects:
  - "24-04 (user templates): writes .md + seed + swaps call site to read RunConfig.user_templates"
  - "24-05 (section guidance + rubric): writes .md + seed + swaps call sites"
  - "24-06 (voice): seeds voice_constraints; threads RunConfig.voice_constraints into assemble_voice"
tech-stack:
  added: []
  patterns:
    - "Two-tier per-key fallback extended from system prompts to the new asset surface (CFG-03 discipline)"
    - "Frozen subset constant (SYSTEM_PROMPT_KEYS) to decouple a Phase 22 consumer from an extended shared mapping"
key-files:
  created:
    - "packages/pipeline/tests/test_config_loader_assets.py"
  modified:
    - "packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py"
    - "packages/pipeline/scripts/seed_phase22.py"
    - "packages/pipeline/tests/lib/test_prompt_seed.py"
    - "docs/API_CONTRACTS.md"
decisions:
  - "Missing seed .md between Wave 2/Wave 3 logs at DEBUG (not WARNING) to preserve the D-06 single-WARNING-per-hard-failure contract"
  - "Added SYSTEM_PROMPT_KEYS (frozen 11) so the Phase 22 seed + its test stay scoped to their prompts after AGENT_KEY_TO_PROMPT_FILE was extended"
metrics:
  duration_min: 6
  completed: "2026-06-22"
  tasks: 3
  files: 5
---

# Phase 24 Plan 03: Pipeline Asset-Loading Infra Summary

Externalized the newly-versioned pipeline assets (user templates, section guidance, QA rubric, voice constraints) into a single typed `RunConfig` surface with Convex-first / disk-fallback hydration, so the three migration plans (04/05/06) only add `.md` files + swap call sites without re-touching `config_loader.py` internals.

## What Was Built

- **RunConfig extension** — four defaulted, asdict-serializable fields: `voice_constraints: Optional[str]`, `user_templates: dict[str,str]`, `section_guidance: dict[str,str]`, `rubric: Optional[str]`.
- **Asset-key registries** — `USER_TEMPLATE_KEYS` (11), `SECTION_GUIDANCE_KEYS` (6), `SINGLETON_ASSET_KEYS` (2), declared once as the single source of truth; all new keys added to `AGENT_KEY_TO_PROMPT_FILE` (existing 11 system-prompt entries untouched).
- **Hydration helpers** — `_hydrate_asset(http, agent_key)` mirrors the existing per-key prompt fallback (`promptVersions:getActive` → disk), and `_load_prompt_or_none(agent_key)` is a `FileNotFoundError`-safe disk read so the pipeline stays bootable before Plans 04/05/06 land the seed files. Both `load_run_config` (Convex path) and `_build_fallback_config` (disk-only path) populate the new fields.
- **Test + contract** — `test_config_loader_assets.py` (3 tests: field defaults, registry counts, fallback-missing-files-no-raise) and API_CONTRACTS §7 RunConfig annotations for the three new fields.

## Key Decisions

- **DEBUG, not WARNING, for missing seed files.** The plan text said "log a warning" on a missing asset `.md`, but emitting a per-key WARNING for all ~20 not-yet-created files broke the existing D-06 contract (`test_hard_failure_fallback` asserts exactly one WARNING per hard Convex failure). Missing seed files between Wave 2 and Wave 3 are an expected, benign state, so the message was downgraded to DEBUG. The CFG-03 contract (one WARNING) takes precedence over the literal plan wording.
- **`SYSTEM_PROMPT_KEYS` frozen subset.** Extending `AGENT_KEY_TO_PROMPT_FILE` from 11→30 keys broke the Phase 22 seed (`scripts/seed_phase22.py` iterated the whole mapping; `tests/lib/test_prompt_seed.py` asserted exactly 11). Rather than weaken the Phase 22 byte-parity test, a frozen `SYSTEM_PROMPT_KEYS` tuple (the original 11) was added; the seed and its test now iterate that subset. The new asset keys are seeded by the Plan 04/05/06 migration seeds, not the Phase 22 seed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Phase 22 seed/test coupled to the now-extended mapping**
- **Found during:** Task 2 (full-suite run after extending `AGENT_KEY_TO_PROMPT_FILE`).
- **Issue:** `tests/lib/test_prompt_seed.py` had a collection-time `assert len(AGENT_KEY_TO_PROMPT_FILE) == 11` and `scripts/seed_phase22.py` iterated the full mapping — both broke when the mapping grew to 30 entries (collection error halted the entire suite).
- **Fix:** Added `SYSTEM_PROMPT_KEYS` (frozen 11) to `config_loader.py`; pointed `seed_phase22._seed_prompts` and `test_prompt_seed`'s `AGENT_KEY_PROMPT_PAIRS` + its upsert-coverage loop at that subset. Phase 22 byte-parity intent fully preserved.
- **Files modified:** `config_loader.py`, `scripts/seed_phase22.py`, `tests/lib/test_prompt_seed.py`.
- **Commit:** 87b9dc8

**2. [Rule 1 - Contract-over-wording] Missing-file logging level**
- **Found during:** Task 2.
- **Issue:** Plan said "log a warning" on missing seed file; doing so emitted ~20 WARNINGs in the hard-fallback path and failed `test_hard_failure_fallback` (D-06 single-WARNING contract).
- **Fix:** Downgraded the missing-file message to `log.debug`.
- **Files modified:** `config_loader.py`.
- **Commit:** 87b9dc8

## Verification

- `tests/test_config_loader_assets.py` — 3 passed.
- Task 1 one-liner prints `OK 11 6 2`; `voice_constraints` field grep = 1; registries grep = 3; `editor_gate1` entry present.
- Task 2 greps: `_hydrate_asset` present; `user_templates=` and `voice_constraints=` each appear in both `load_run_config` and `_build_fallback_config` (count 2 each).
- Task 3: asset test passes; `grep -c "user_templates: dict" docs/API_CONTRACTS.md` = 1; `grep -c "def test_"` = 3.
- Full pipeline suite: **292 passed, 35 skipped, 11 xfailed, 6 failed**. The 6 failures (`test_voice_db_override.py` ×2, `test_prompt_version_seeds.py` ×4) are **pre-existing RED tests** confirmed failing at the baseline commit (`git stash` check) — they are intentional placeholders for Plans 04/05/06 (assert `assemble_voice(db_voice_override=...)` and seed byte-equivalence for `.md` files that do not exist yet). Zero new failures introduced; the prior collection error was fixed.

## Deferred Issues

The 6 pre-existing RED failures are owned by downstream plans and are out of scope:
- `test_db_override_passthrough` / `test_db_override_used_when_provided` → resolved by **Plan 06** (adds `assemble_voice(..., db_voice_override=...)`).
- `test_section_guidance_seed_byte_equivalence`, `test_anonymous_guidance_seed_retains_role_token`, `test_voice_constraints_seed_byte_equivalence`, `test_rubric_seed_byte_equivalence` → resolved by **Plans 04/05/06** seeding the asset `.md` files.

## Known Stubs

None that block the plan goal. The new `RunConfig` asset fields intentionally resolve to `None`/`{}` between Wave 2 and Wave 3 (seed `.md` files absent); Plans 04/05/06 fill them. This is the designed decoupling, documented in API_CONTRACTS §7 and the field comments.

## Self-Check: PASSED

All created files exist on disk; all three task commits (4b388dc, 87b9dc8, 117b631) are present in git history.
