---
phase: 22-config-externalization
plan: 05
subsystem: pipeline-run-wiring
tags: [config-externalization, snapshot-ordering, langgraph, convex, call-site-swap, byte-parity]

# Dependency graph
requires:
  - phase: 22-config-externalization (Plan 03)
    provides: "lib/config_loader: load_run_config(), snapshot_config(), RunConfig.agents[key].system_prompt, DispatchState.config field"
  - phase: 22-config-externalization (Plan 02)
    provides: "convex/runs.ts runs:create (triggerSource required; status+startedAt server-side) + runs:setConfigSnapshot"
  - phase: 04-pipeline-skeleton
    provides: "api/runs.py run_weekly/resume_run handlers + lib/prompts.load_prompt byte oracle + @agent_node DispatchState contract"
provides:
  - "api/runs.py run_weekly: runs:create + load_run_config + awaited snapshot_config BEFORE asyncio.create_task (CFG-04); RunConfig threaded onto initial_state['config'] (CFG-01)"
  - "11 prompt call sites (8 agent files) read state['config'].agents[key].system_prompt with load_prompt disk fallback guard; str.replace token chains preserved"
  - "tests/api/test_runs_config_snapshot.py green: snapshot-before-create_task ordering + resume-no-resnap (non-vacuous, asserts mock awaited)"
affects: [config-externalization-complete, runtime-config-reads, snapshot-immutability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Run-start sequence: pipelineRuns:create → runs:create (triggerSource only) → load_run_config → AWAITED snapshot_config → asyncio.create_task (snapshot-race fix, Pitfall 1)"
    - "Config-threaded prompt read: cfg = state.get('config'); base = cfg.agents[key].system_prompt if cfg else load_prompt(file) — guard keeps legacy/test paths (no config) byte-identical"
    - "str.replace preserved verbatim at every call site (no str.format) → voice byte-equivalence intact"
    - "Resume path leaves snapshot untouched (Pitfall 6) — snapshot_config appears EXACTLY ONCE in api/runs.py"

key-files:
  created:
    - "(none — test file pre-existed as Plan 01 xfail scaffold; finalized here)"
  modified:
    - "packages/pipeline/src/eisenbalm_pipeline/api/runs.py"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/scout.py"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/editor.py"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/game.py"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py"
    - "packages/pipeline/tests/api/test_runs_config_snapshot.py"
    - "packages/pipeline/tests/agents/test_game.py"
    - "packages/pipeline/tests/agents/test_calibrator.py"
    - "packages/pipeline/tests/agents/test_design.py"

key-decisions:
  - "Threaded `state` into each prompt-builder helper (rather than passing a pre-resolved string) so the fallback guard `cfg = state.get('config')` lives at the single assembly point — keeps the load_prompt import live (used by the guard) and matches the plan's recommended pattern"
  - "Snapshot-ordering test invokes the real run_weekly/resume_run coroutines directly with a lightweight SimpleNamespace fake Request (no FastAPI app / env vars) — avoids the env-gated `client` fixture skip and tests the ordering precisely; patches the api.runs binding of snapshot_config"
  - "Updated 3 helper-direct test call sites (test_game/test_calibrator/test_design) to pass state={} for the new required signature — the empty state triggers the load_prompt fallback, preserving the original assertions"

requirements-completed: [CFG-01, CFG-04]

# Metrics
duration: 9min
completed: 2026-06-22
---

# Phase 22 Plan 05: Run-Start Wiring + 11 Call-Site Swap Summary

**`api/runs.py run_weekly` now creates the `runs` row (triggerSource only), resolves the immutable `RunConfig`, and AWAITS `snapshot_config()` BEFORE `asyncio.create_task()` (CFG-04 snapshot-race fix) while threading the config onto `initial_state['config']` (CFG-01); all 11 `load_prompt(...)` call sites across 8 agent files now read `state['config'].agents[key].system_prompt` with a `load_prompt` disk-fallback guard and verbatim `str.replace` chains, keeping the voice byte-equivalence tripwires green; the snapshot-before-invoke + resume-no-resnap tests are green and non-vacuous.**

## Performance

- **Duration:** ~9 min
- **Completed:** 2026-06-22
- **Tasks:** 3
- **Files modified:** 13 (0 created, 13 modified)

## Accomplishments

- **Run-start wiring (Task 1)** — In `run_weekly`, after `pipelineRuns:create`: `runs:create` (workspace_id + runId + `triggerSource="manual"`; status + startedAt set server-side per Plan 02), then `run_config = await load_run_config(...)` and `await snapshot_config(...)` — both AWAITED in the handler body BEFORE `asyncio.create_task` (CFG-04 / Pitfall 1). `initial_state["config"] = run_config` threads the resolved config to every agent (CFG-01). Top-level `from ...config_loader import load_run_config, snapshot_config` import binds the names into the `api.runs` namespace (the patch target for Task 3). Resume path untouched — `snapshot_config(` appears EXACTLY ONCE in the file.
- **11 call-site swaps (Task 2)** — scout / advocate / calibrator / researcher / editor (gate1 + final) / bonus (big_budget + jingle + spec_ad) / game / design. Each resolves `cfg = state.get("config")` then `base = cfg.agents[key].system_prompt if cfg else load_prompt(file)`, preserving the full trailing `str.replace("{token}", value)` chain verbatim (no `str.format`). `state` was threaded into each `_build_messages` / `_build_*_prompt` / `_call_llm` helper (design routes through `_call_llm`).
- **Snapshot-ordering tests (Task 3)** — Finalized `test_runs_config_snapshot.py`: removed xfail, invoke the real handlers with a fake Request. `test_snapshot_before_task` patches the api.runs binding of `snapshot_config` + `asyncio.create_task` into a shared recorder, asserts `await_count == 1` (non-vacuous) AND `index("snapshot") < index("create_task")`. `test_resume_no_resnap` drives a mocked paused graph through `resume_run` and asserts `snapshot_config` was never called.

## Task Commits

1. **Task 1: wire run_weekly runs:create + load_run_config + awaited snapshot** — `c6b3732` (feat)
2. **Task 2: swap 11 prompt call sites to state['config'].agents[key].system_prompt** — `e017d5b` (feat)
3. **Task 3: green snapshot-before-create_task + resume-no-resnap tests** — `52200dd` (test)

## Decisions Made

- **`state`-threaded helpers, not pre-resolved strings**: each prompt-builder now takes `state` and does the `cfg.agents[key].system_prompt if cfg else load_prompt(file)` resolution at the single assembly point. This keeps the `load_prompt` import live (the guard uses it), centralizes the fallback, and matches the plan's recommended pattern. The 4 narrative writers (origin_story/problem/founder_bio/case_study) were untouched — they assemble prompts via `build_section_writer_prompt`, not the 11 `load_prompt` sites.
- **Direct-coroutine snapshot test, not the HTTP `client` fixture**: the `client` fixture is env-gated and skips without a real FastAPI app + env vars. Calling `run_weekly`/`resume_run` directly with a `SimpleNamespace` fake Request tests the ordering deterministically and runs without external services. Patching the `api.runs` binding (not `lib.config_loader`) is required because `run_weekly` resolves `snapshot_config` as a module-global of `api.runs`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three helper-direct test call sites broke on the new required `state` signature**
- **Found during:** Task 2 (after swapping the helpers).
- **Issue:** `tests/agents/test_game.py`, `test_calibrator.py`, and `test_design.py` call `_build_messages(...)` directly with the OLD signature (no `state`). The new required `state` parameter would raise `TypeError`.
- **Fix:** Passed `state={}` (game uses positional `{}`) at each of the 3 call sites. An empty state has no `config` key, so the `load_prompt` fallback fires — the original byte assertions (VOICE_CONSTRAINTS / FORBIDDEN_CONSTRUCTS / Machine Editorial envelope present) hold unchanged.
- **Files modified:** `tests/agents/test_game.py`, `tests/agents/test_calibrator.py`, `tests/agents/test_design.py`
- **Commit:** `e017d5b`

**2. [Note — not a deviation] Plan interface's `str.replace` chains were under-specified for several sites**
- The plan's `<interfaces>` block listed calibrator / editor:194 / bonus-spec-ad as bare `load_prompt(...)`, but the actual code carries `.replace(...)` chains at those sites (and bonus-big-budget / bonus-jingle carry VOICE_CONSTRAINTS replaces the interface omitted). Followed the ACTUAL code at each site, preserving every existing `.replace` chain verbatim — exactly what the byte-equivalence acceptance criteria require.

## Deferred Issues

None new. The pre-existing Phase 18 `PydanticSerializationUnexpectedValue` (`BodyBlock` discriminated-union) warnings still surface in the real-mode run — out of scope, not regressions (documented in 22-01/22-03 summaries).

## Verification

- `cd packages/pipeline && uv run pytest -q` → **282 passed, 33 skipped, 0 failed** (12.4s)
- `uv run pytest tests/api/test_runs_config_snapshot.py tests/test_voice.py -q` → green
- `snapshot_config(` appears exactly once in `api/runs.py`
- `runs:create` passes `triggerSource`, does NOT pass `startedAt`/`status` (server-side defaults — matches `convex/runs.ts` handler)
- 11 call sites swapped (`grep 'cfg.agents\['` → 11: bonus×3, editor×2, others×1); no `.format(` in prompt assembly; voice byte-equivalence intact

## Known Stubs

None — all 11 call sites read real config with a real disk fallback; no placeholder/hardcoded-empty data flows to a consumer. Non-prompted agent keys (chronicler/qa/origin_story/problem/founder_bio/case_study) intentionally carry `system_prompt=""` per Plan 03 D-02 (their `.md` migration is Phase 24) and are NOT among the 11 swapped sites — a documented intentional gap, not a stub blocking this plan's goal.

## Self-Check: PASSED

All 13 modified files exist on disk; all 3 task commits (`c6b3732`, `e017d5b`, `52200dd`) present in git history.

---
*Phase: 22-config-externalization*
*Completed: 2026-06-22*
