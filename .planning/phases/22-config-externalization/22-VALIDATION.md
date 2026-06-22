---
phase: 22
slug: config-externalization
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-22
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seams derived from the "## Validation Architecture" section of `22-RESEARCH.md`.
> The planner fills the Per-Task Verification Map once tasks exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Pipeline framework** | pytest (existing `packages/pipeline/tests/`, `pyproject.toml`) |
| **Convex** | `pnpm --filter @eisenbalm/convex typecheck` + `codegen` (schema + seed/query compile) |
| **Byte-verification** | `verify_prompt_seed.py` standalone (live Convex) + pytest parametrize (mocked Convex) — both per research |
| **Config files** | `packages/pipeline/pyproject.toml` (exists) |
| **Quick run command** | `cd packages/pipeline && uv run pytest tests/lib/test_config_loader.py tests/api/test_runs_config_snapshot.py -q` |
| **Full suite command** | `cd packages/pipeline && uv run pytest -q && pnpm --filter @eisenbalm/convex typecheck` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant quick command (pipeline pytest OR convex typecheck)
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Success-Criterion → Validation Seam (from RESEARCH §Validation Architecture)

| # | Success Criterion | Requirement | How it's validated | Type |
|---|-------------------|-------------|--------------------|------|
| 1 | `runs.configSnapshot` JSON contains the exact prompt text + model settings used, matching active prompt versions | CFG-01, CFG-04 | pytest: `load_run_config()` returns a `RunConfig` whose per-agent systemPrompt == `load_prompt(name)` for all 11; snapshot JSON round-trips to the same values | unit (pytest) |
| 2 | Snapshot written + confirmed BEFORE `graph.ainvoke()`; mid-run edit doesn't change in-flight behavior | CFG-04 | pytest: ordering test asserting `snapshot_config()` is awaited in the HTTP handler BEFORE `asyncio.create_task()`/`ainvoke` (mock both, assert call order); a "mutate after snapshot → state unchanged" test | unit (pytest) |
| 3 | All 11 `.md` files appear in `prompt_versions` as v1 active rows; byte-comparison shows ZERO diff | CFG-02 | `verify_prompt_seed.py` (live) + pytest parametrize (mocked): for each of 11, seeded `content` == `load_prompt(name)` output byte-for-byte; assert `version==1`, `isActive==true` | unit + standalone |
| 4 | Convex unreachable at run start → fall back to disk `.md` + `llm_config.py`, log WARNING, no crash | CFG-03 | pytest: hard-failure path (Convex raises) → `RunConfig` from disk/code defaults + single WARNING logged (caplog); per-key path (one row missing) → that agent falls back + per-agent WARNING; process does not raise | unit (pytest) |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-T1 API_CONTRACTS §7 amend | 22-01 | 0 | CFG-01/02/03/04 | grep | `grep "config: NotRequired\|top_p\|configSnapshot" docs/API_CONTRACTS.md` | ❌ Wave 0 creates | ⬜ pending |
| 01-T2 config_loader test scaffold | 22-01 | 0 | CFG-01/03/04 | unit (xfail) | `cd packages/pipeline && uv run pytest tests/lib/test_config_loader.py -q` | ❌ Wave 0 creates | ⬜ pending |
| 01-T3 byte-parity/snapshot/wheel scaffolds | 22-01 | 0 | CFG-02/04 | unit (xfail + wheel pass) | `cd packages/pipeline && uv run pytest tests/lib/test_prompt_seed.py tests/api/test_runs_config_snapshot.py tests/test_package_data_prompts.py -q` | ❌ Wave 0 creates | ⬜ pending |
| 02-T1 agents schema + agents.ts/pipelineConfig.ts | 22-02 | 1 | CFG-04 | typecheck | `pnpm --filter @eisenbalm/convex typecheck` | ✅ schema stub | ⬜ pending |
| 02-T2 promptVersions.ts + runs.ts | 22-02 | 1 | CFG-02/04 | typecheck+codegen | `pnpm --filter @eisenbalm/convex typecheck && pnpm --filter @eisenbalm/convex codegen` | ✅ schema stub | ⬜ pending |
| 03-T1 RunConfig + mapping + snapshot_config | 22-03 | 2 | CFG-01/04 | import check | `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.config_loader import RunConfig,AGENT_KEY_TO_PROMPT_FILE; assert len(AGENT_KEY_TO_PROMPT_FILE)==11"` | ❌ 03 creates | ⬜ pending |
| 03-T2 load_run_config two-tier fallback | 22-03 | 2 | CFG-01/03 | unit | `cd packages/pipeline && uv run pytest tests/lib/test_config_loader.py -q` | ❌ 03 creates | ⬜ pending |
| 03-T3 DispatchState.config + green loader tests | 22-03 | 2 | CFG-01 | unit | `cd packages/pipeline && uv run pytest tests/lib/test_config_loader.py tests/test_builder_wiring.py tests/test_voice.py -q` | ✅ state.py | ⬜ pending |
| 04-T1 seed_phase22.py | 22-04 | 3 | CFG-02 | ast/grep | `cd packages/pipeline && uv run python -c "import ast; s=open('scripts/seed_phase22.py').read(); ast.parse(s); assert 'load_prompt(' in s and 'open(' not in s"` | ❌ 04 creates | ⬜ pending |
| 04-T2 verify_prompt_seed.py | 22-04 | 3 | CFG-02 | ast/grep | `grep "getActive" packages/pipeline/scripts/verify_prompt_seed.py` | ❌ 04 creates | ⬜ pending |
| 04-T3 byte-parity pytest green | 22-04 | 3 | CFG-02 | unit | `cd packages/pipeline && uv run pytest tests/lib/test_prompt_seed.py -q` | ❌ 01 scaffolds, 04 greens | ⬜ pending |
| 05-T1 run_weekly snapshot-before-task wiring | 22-05 | 3 | CFG-04 | ast/grep | `cd packages/pipeline && uv run python -c "s=open('src/eisenbalm_pipeline/api/runs.py').read(); assert s.count('snapshot_config(')==1 and 'load_run_config' in s"` | ✅ runs.py | ⬜ pending |
| 05-T2 11 call-site swap | 22-05 | 3 | CFG-01 | unit | `cd packages/pipeline && uv run pytest tests/test_voice.py tests/test_section_writer_voice_propagation.py -q` | ✅ agent files | ⬜ pending |
| 05-T3 snapshot-ordering tests + full suite | 22-05 | 3 | CFG-01/04 | unit | `cd packages/pipeline && uv run pytest tests/api/test_runs_config_snapshot.py -q && uv run pytest -q` | ❌ 01 scaffolds, 05 greens | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/pipeline/tests/lib/test_config_loader.py` — CFG-01/CFG-03/CFG-04 (load_run_config happy path + two-tier fallback + snapshot round-trip) — Plan 22-01 Task 2
- [ ] `packages/pipeline/tests/lib/test_prompt_seed.py` — CFG-02 parametrized byte-comparison (11 pairs) + idempotency — Plan 22-01 Task 3
- [ ] `packages/pipeline/tests/api/test_runs_config_snapshot.py` — CFG-04 snapshot-before-invoke ordering + resume-no-resnap — Plan 22-01 Task 3
- [ ] `packages/pipeline/tests/test_package_data_prompts.py` — wheel-safe `load_prompt` resolution over the 11 stems (MUST pass at Wave 0) — Plan 22-01 Task 3
- [x] `packages/pipeline/tests/conftest.py` — shared fixtures already present (env-guard + ASGI client); reuse, do not duplicate

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live seed against the real Convex deployment | CFG-02 | Needs the live `modest-magpie-797` deployment | `cd packages/pipeline && uv run python scripts/seed_phase22.py` then `uv run python scripts/verify_prompt_seed.py` → expect "11/11 byte-identical", exit 0 |
| End-to-end live run shows a real `configSnapshot` | CFG-01/CFG-04 | Needs a full pipeline run on live infra | Trigger a run; inspect the `runs` record's `configSnapshot` field; confirm it matches the active prompt versions |

---

## Validation Sign-Off

- [x] All tasks have `<automated>`/grep verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (new pipeline test files)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner — 22-plan-phase)
