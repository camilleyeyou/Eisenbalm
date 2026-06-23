---
phase: 25-run-control
plan: "01"
subsystem: pipeline-contracts
tags: [contracts, schema, tdd, foundation]
dependency_graph:
  requires: []
  provides:
    - API_CONTRACTS.md §3B (run-control endpoints documented contract-first)
    - convex/schema.ts runs.cancelRequested field
    - lib/errors.py RunCancelled exception
    - seed_phase25_config.py (5 new pipeline_config keys)
    - 5 Wave 0 RED pytest scaffolds gating Plans 02-04
    - conftest convex_runs_store/convex_config_store fixtures
  affects:
    - packages/pipeline/tests/ (all plans consuming conftest fixtures)
    - convex/runs.ts (Plan 03 implements requestCancel/isCancelRequested)
    - packages/pipeline/api/control.py (Plan 02 implements endpoints)
    - packages/pipeline/lib/scheduler.py (Plan 02 implements)
tech_stack:
  added: []
  patterns:
    - Contract-first amendment (CLAUDE.md hard rule satisfied before any code)
    - Additive Convex schema field (free-string status, optional boolean flag)
    - TDD RED scaffold pattern (Wave 0 — 5 files fail RED; green in Plans 02-04)
    - In-memory Convex stub fixtures (convex_runs_store / convex_config_store)
key_files:
  created:
    - packages/pipeline/scripts/seed_phase25_config.py
    - packages/pipeline/tests/test_control.py
    - packages/pipeline/tests/test_cancel.py
    - packages/pipeline/tests/test_reroll.py
    - packages/pipeline/tests/test_budget_gate.py
    - packages/pipeline/tests/test_scheduler.py
  modified:
    - docs/API_CONTRACTS.md (§3B added)
    - convex/schema.ts (runs.cancelRequested field)
    - packages/pipeline/src/eisenbalm_pipeline/lib/errors.py (RunCancelled)
    - packages/pipeline/tests/conftest.py (convex_runs_store + convex_config_store fixtures)
decisions:
  - "Cancel-flag via Convex runs.cancelRequested (free boolean) — survives Railway restart, dashboard-visible, matches ARCHITECTURE.md §4 prescription"
  - "Pitfall-1 split documented: runs.status='cancelled' (free string, dashboard), pipelineRuns.status='failed' + errorMessage='cancelled by operator' (frozen union preserved)"
  - "5 new pipeline_config keys: per_run_cap_usd (10.0), monthly_cap_usd (200.0), alert_threshold_pct (80), schedule_cadence ({Thu 14:00 UTC}), schedule_next_run_at (0)"
  - "schedule_enabled NOT seeded by Phase 25 seed — Phase 22 default of false preserved; automation stays off until operator enables"
  - "Re-rollable set = 7 section writers only (D-03); 422 for qa/scout/advocate/editor/researcher/chronicler"
  - "_is_due + compute_next_run_at factored into lib/scheduler.py (Plan 02 creates); cursor advances strictly after now (Pitfall 6)"
metrics:
  duration: "~10 min"
  completed: "2026-06-23"
  tasks_completed: 3
  files_modified: 8
---

# Phase 25 Plan 01: Contract-first Foundation — API Contracts, Schema, Red Tests Summary

Contract-first gate for Phase 25 Run Control: amends API_CONTRACTS.md with §3B (four new endpoints + cancel-flag + pipeline_config keys), adds the additive `runs.cancelRequested` schema field + `RunCancelled` exception + idempotent config seed, and authors five Wave 0 RED pytest scaffolds with a shared in-memory Convex stub fixture.

## What Was Built

### Task 1 — API_CONTRACTS.md §3B (contract-first, CLAUDE.md hard rule)

Added `## 3B. Dashboard → Pipeline (run control)` immediately after the existing `## 3A` section, documenting:

- `POST /pipeline/run` — Clerk JWT auth, one-at-a-time + budget start-gate, `triggerSource="manual"`, `triggeredBy` from JWT sub
- `POST /pipeline/tick` — trigger-secret auth, five-step guard order (kill switch → _is_due → one-at-a-time → budget projection → fire), returns `{"status":"triggered"|"skipped","reason":...}`
- `POST /runs/{run_id}/cancel` — cooperative cancel via `runs:requestCancel` flag; idempotent on terminal runs
- `POST /runs/{run_id}/agents/{agent_key}/rerun` — section writers only (7), blocked while running (409), no `ainvoke` after `aupdate_state` (Pitfall 2)
- Cancel-flag contract subsection: `runs.cancelRequested` field, new `runs:requestCancel`/`isCancelRequested`/`updateStatus` mutations (Plan 03), Pitfall-1 status-split fully documented
- `pipeline_config` extension: 5 new keys with defaults and descriptions

Frozen `pipelineRuns.status` union (`running|awaiting-review|complete|failed`) and `deliberationEvents.eventType` union untouched.

### Task 2 — Schema, Exception, Seed

- `convex/schema.ts`: added `cancelRequested: v.optional(v.boolean())` to the `runs` table — additive only, no indexes changed, no frozen unions touched
- `lib/errors.py`: added `RunCancelled(Exception)` modeled exactly on `CostCapExceeded` (same docstring style, same `__init__` pattern); clearly documents Pitfall-1 split in the docstring
- `seed_phase25_config.py`: idempotent upsert of 5 new pipeline_config keys; `schedule_enabled` deliberately absent to preserve Phase 22 automation-off default

### Task 3 — 5 Wave 0 RED Test Files + Conftest Fixtures

Five test files fail RED (collection errors) because `eisenbalm_pipeline.api.control` and `eisenbalm_pipeline.lib.scheduler` do not exist yet:

| File | Tests | Covers |
|------|-------|--------|
| `test_control.py` | `test_manual_trigger_records_operator`, `test_tick_kill_switch_noop` | RUN-01, RUN-02 |
| `test_cancel.py` | `test_cancel_lands_cancelled`, `test_cooperative_not_violent` | RUN-04 D-01/D-02 |
| `test_reroll.py` | `test_reroll_leaves_siblings_unchanged`, `test_reroll_blocked_while_running`, `test_reroll_rejects_non_section` | RUN-05 D-03/D-04/D-05 |
| `test_budget_gate.py` | `test_start_gate_refuses_over_budget`, `test_per_run_cap_from_db`, `test_monthly_alert_no_cancel` | RUN-06 D-06/D-07/D-08 |
| `test_scheduler.py` | `test_is_due_fires_when_due`, `test_is_due_skips_not_due`, `test_next_run_cursor_advances` | RUN-03 Pitfall 6 |

Conftest additions:
- `convex_runs_store` fixture — in-memory dict store for `runs:create/byRunId/latest/requestCancel/isCancelRequested/updateStatus`; monkeypatches `convex_mutation`, `convex_mutation_safe`, `convex_query`; exposes `seed(row)`, `mutation_calls(path)`, `all_calls()`
- `convex_config_store` fixture — in-memory dict store for `pipelineConfig:getAll/upsert`; exposes `seed(key, value)`, `mutation_calls(path)`

## Deviations from Plan

None — plan executed exactly as written.

## Existing Tripwires

`cd packages/pipeline && uv run pytest tests/test_cost_double_count.py -q` — 3 passed, 0 failed (no regression).

## Self-Check: PASSED

Files created/modified:
- [x] `docs/API_CONTRACTS.md` — contains `## 3B`, `/pipeline/tick`, `cancelRequested`, `schedule_next_run_at`
- [x] `convex/schema.ts` — contains `cancelRequested: v.optional(v.boolean())`
- [x] `packages/pipeline/src/eisenbalm_pipeline/lib/errors.py` — contains `class RunCancelled`
- [x] `packages/pipeline/scripts/seed_phase25_config.py` — exists, contains 5 keys, no `schedule_enabled`
- [x] 5 RED test files exist and fail RED
- [x] `conftest.py` contains `def convex_runs_store` and `pipelineConfig:getAll`

Commits:
- [x] `ea8bc17` — feat(25-01): amend API_CONTRACTS.md contract-first for Phase 25 run control
- [x] `8334541` — feat(25-01): add runs.cancelRequested schema field, RunCancelled error, and Phase 25 config seed
- [x] `6ad901f` — test(25-01): add 5 Wave 0 RED pytest scaffolds + runs/pipeline_config conftest fixtures
