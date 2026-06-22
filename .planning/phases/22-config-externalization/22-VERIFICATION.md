---
phase: 22-config-externalization
verified: 2026-06-21T00:00:00Z
status: passed
score: 4/4 must-haves verified
human_verification:
  - test: "Run seed_phase22.py then verify_prompt_seed.py against live Convex"
    expected: "verify prints '11/11 byte-identical' and exits 0; prompt_versions rows are version=1, isActive=true"
    why_human: "Requires a live Convex deployment + NEXT_PUBLIC_CONVEX_URL; CI proves the seed CONTENT contract via mocks but cannot exercise the live round-trip"
  - test: "Trigger a real pipeline run, then edit an active prompt in Convex mid-run"
    expected: "The in-flight run's runs.configSnapshot is unchanged and the run continues using the snapshotted prompt; the edit only affects the NEXT run"
    why_human: "Mid-run mutation timing against a live deployment cannot be exercised in unit tests"
---

# Phase 22: Config Externalization Verification Report

**Phase Goal:** The pipeline reads all agent config (prompts, model, temperature, tokens, enabled flag) from Convex once at run start; a full config snapshot is written to the `runs` record BEFORE the LangGraph graph is invoked; the existing prompt `.md` files are migrated into Convex as version-1 active rows with byte-verification; agents read from `state["config"]` not from disk mid-run; disk files are retained as fallback.

**Verified:** 2026-06-21
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 (CFG-01) | A pipeline run shows a config snapshot on the `runs` record containing the exact prompt text + model settings used, comparable to active prompt versions in Convex | ✓ VERIFIED | `load_run_config()` resolves all 18 agent keys from Convex (`agents:listForWorkspace`, `promptVersions:getActive`, `pipelineConfig:getAll`); `snapshot_config()` serializes the full `RunConfig` (`dataclasses.asdict`) to `runs.configSnapshot`. `run_weekly` threads it onto `initial_state["config"]` (api/runs.py:252). |
| 2 (CFG-04) | The config snapshot is written and confirmed BEFORE graph invocation; mid-run edits don't change in-flight behavior | ✓ VERIFIED | api/runs.py:236-237 awaits `load_run_config` then `snapshot_config` BEFORE `asyncio.create_task` at :264. `test_snapshot_before_task` asserts `await_count==1` (non-vacuous) AND index ordering. `resume_run` does NOT re-snapshot (`snapshot_config(` count == 1; `test_resume_no_resnap` green). |
| 3 (CFG-02) | All migrated prompt `.md` files appear in Convex `prompt_versions` as v1 active rows; byte-comparison shows zero diff | ✓ VERIFIED | 11 actual prompt files (12 in dir incl. non-prompt README.md). `AGENT_KEY_TO_PROMPT_FILE` has exactly 11 entries. Seed routes content through `load_prompt()` (3 calls, 0 raw `open(`). `upsertActive` inserts `version:1, isActive:true`, idempotent (patches content, no version bump). Behavioral spot-check: 11/11 fallback bytes == `load_prompt()`. |
| 4 (CFG-03) | If Convex is unreachable at run start, pipeline falls back to on-disk `.md` files and logs a warning — no crash, no silent degradation | ✓ VERIFIED | `load_run_config` wraps the agents/pipeline_config round-trip in try/except → single WARNING + `_build_fallback_config()` (D-06). Per-key gap → per-agent WARNING + `load_prompt()` fallback (D-07). `test_hard_failure_fallback` + `test_partial_fallback_per_key` green. Agent call sites have `if cfg else load_prompt(...)` guards. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py` | RunConfig/AgentConfig, AGENT_KEY_TO_PROMPT_FILE (11), load_run_config, snapshot_config, _build_fallback_config | ✓ VERIFIED | 248 lines; all symbols present; SAMPLING_BY_AGENT (not AGENT_GEN_PARAMS); 2-tier fallback implemented |
| `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` | DispatchState.config NotRequired field, no circular import | ✓ VERIFIED | `config: NotRequired[Optional["RunConfig"]]` (:218); TYPE_CHECKING import + deferred runtime bind (:242) |
| `convex/runs.ts` | create (triggerSource only, server-side status/startedAt) + setConfigSnapshot | ✓ VERIFIED | create idempotent by_runId guard, status='running'+startedAt server-side; setConfigSnapshot throws "Run not found" on miss |
| `convex/promptVersions.ts` | upsertActive (v1 idempotent) + getActive | ✓ VERIFIED | inserts version:1/isActive:true; patches content on re-run, no version bump |
| `convex/agents.ts` | upsert + listForWorkspace | ✓ VERIFIED | exists, by_workspace_agentKey idempotent upsert |
| `convex/pipelineConfig.ts` | upsert + getAll | ✓ VERIFIED | exists |
| `convex/schema.ts` | agents top_p/max_tokens/description + runs.configSnapshot | ✓ VERIFIED | columns at :258-260; configSnapshot at :225 |
| `packages/pipeline/scripts/seed_phase22.py` | idempotent seed via load_prompt() | ✓ VERIFIED | 3 load_prompt calls, 0 raw open; uses ALL_AGENT_KEYS + AGENT_KEY_TO_PROMPT_FILE |
| `packages/pipeline/scripts/verify_prompt_seed.py` | live byte-comparison, exit 1 on diff | ✓ VERIFIED | getActive + load_prompt + sys.exit(1) + version/isActive assertions |
| 8 agent files (scout/advocate/calibrator/researcher/editor/bonus/game/design) | 11 call sites read state['config'].agents[key].system_prompt | ✓ VERIFIED | All 11 swapped with `if cfg else load_prompt(...)` guard; bonus=3, editor=2; no `.format(` in prompt assembly |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `api/runs.py run_weekly` | `config_loader.snapshot_config` | awaited before asyncio.create_task | ✓ WIRED | top-level import; :237 await precedes :264 create_task |
| `config_loader.load_run_config` | `convex agents/promptVersions/pipelineConfig` | convex_query at run start | ✓ WIRED | three query paths called |
| `config_loader._build_fallback_config` | `lib.prompts.load_prompt + lib.llm_config` | disk/code fallback oracle | ✓ WIRED | 11/11 byte-identical confirmed via spot-check |
| `agents/*.py` call sites | `state['config'].agents[key].system_prompt` | config-threaded prompt read | ✓ WIRED | 11 sites; str.replace preserved |
| `scripts/seed_phase22.py` | `promptVersions:upsertActive` w/ load_prompt content | byte-exact seed | ✓ WIRED | no raw open; idempotent |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `runs.configSnapshot` | `run_config` | `load_run_config()` (Convex query OR disk fallback) | Yes — resolves all 18 keys; never `[]`/`{}` static | ✓ FLOWING |
| agent `system` strings | `cfg.agents[key].system_prompt` | `state["config"]` (threaded from run_weekly) OR `load_prompt()` guard | Yes — byte-identical to disk in fallback | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Fallback bytes == load_prompt for all 11 | `python -c "_build_fallback_config() vs load_prompt"` | 11/11 byte-identical; 18 agent keys | ✓ PASS |
| AGENT_KEY_TO_PROMPT_FILE has 11 entries | import + len() | 11 | ✓ PASS |
| Phase-22 targeted test suite | `pytest test_config_loader test_prompt_seed test_runs_config_snapshot test_package_data_prompts` | 31 passed | ✓ PASS |
| Voice byte-equivalence guard | `pytest test_voice test_section_writer_voice_propagation test_builder_wiring` | 12 passed | ✓ PASS |
| Full pipeline suite (deterministic) | `pytest -q -p no:randomly` | 282 passed, 33 skipped, 0 failed | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| CFG-01 | 01, 03, 05 | Active agent config lives in Convex, read at run start | ✓ SATISFIED | load_run_config + state threading + 11 call-site swaps |
| CFG-02 | 01, 02, 04 | Prompt `.md` files migrated as v1 active rows, byte-verified | ✓ SATISFIED | seed + verify scripts + upsertActive v1 + 11/11 byte parity |
| CFG-03 | 01, 03 | Load once at run start; disk fallback if store unavailable, no crash | ✓ SATISFIED | 2-tier fallback, WARNING logs, fallback tests green |
| CFG-04 | 01, 02, 05 | Immutable snapshot written BEFORE graph invoke | ✓ SATISFIED | snapshot before create_task; resume no-resnap; ordering test |

No orphaned requirements: REQUIREMENTS.md maps exactly CFG-01..CFG-04 to Phase 22 (CFG-05 belongs to Phase 21). All four are claimed by plans and verified.

### Prompt-Count Nuance (resolved)

The goal text says "12 prompt `.md` files." The codebase has 12 files in `prompts/` but one is `README.md` (not a prompt). The 11 actual prompts are correctly mapped in `AGENT_KEY_TO_PROMPT_FILE` (editor.md → editor_gate1; three bonus variants). The implementation's count of **11** is correct; the "12" is the directory listing including README. Not a defect.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (none) | — | No TODO/FIXME/placeholder/stub in any phase-22 file | — | — |

### Human Verification Required

1. **Live seed + byte-verify** — Run `seed_phase22.py` then `verify_prompt_seed.py` against live Convex. Expect "11/11 byte-identical", exit 0, rows version=1/isActive=true. (CI proves the content contract via mocks; live round-trip needs a deployment.)
2. **Mid-run edit immutability** — Trigger a run, edit an active prompt in Convex mid-run; confirm `runs.configSnapshot` is unchanged and the run uses the snapshotted prompt.

### Gaps Summary

No gaps. All four observable truths are verified against the actual codebase, not just SUMMARY claims:
- The config loader is substantive (248 lines) with both fallback tiers implemented and behaviorally confirmed byte-identical.
- The CFG-04 critical path (snapshot awaited before `asyncio.create_task`) is wired in `run_weekly` and enforced by a non-vacuous ordering test.
- All 11 prompt call sites read from `state["config"]` with disk-fallback guards; voice byte-equivalence tests stay green.
- Convex functions are idempotent and schema-complete; the seed sources content exclusively through `load_prompt()` (no byte-mismatch risk).

Two deferred items (DEF-22-01 clerk-auth fixture flake under pytest-randomly; DEF-22-02 stale calibrator test signature) are documented as pre-existing and out-of-scope; the full suite is green under deterministic ordering (282 passed / 0 failed). Two items routed to human verification require a live Convex deployment and cannot be exercised in unit tests.

---

_Verified: 2026-06-21_
_Verifier: Claude (gsd-verifier)_
