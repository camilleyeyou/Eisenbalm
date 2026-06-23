---
phase: 25-run-control
plan: "04"
subsystem: pipeline-api
tags: [run-control, budget, cost-cap, tdd-green, RUN-06]
dependency_graph:
  requires:
    - 25-02 (control.py with budget seam placeholders, _start_run helper)
    - 25-01 (conftest fixtures, pipeline_config keys, RunConfig dataclass)
  provides:
    - RunConfig.per_run_cap_usd / monthly_cap_usd / alert_threshold_pct (3 new fields)
    - lib/cost.set_run_cap (in-memory per-run cap registry — no hot-path Convex read)
    - lib/cost.emit_monthly_alert (fire-and-forget cost-warning scope=monthly)
    - lib/budget.trailing_average + would_exceed_monthly_cap (start-gate helpers)
    - convex/runs:monthToDateCost (MTD + trailingCosts query)
    - budget start-gate wired into pipeline_run (409) and pipeline_tick (skipped)
  affects:
    - api/control.py (both budget seam placeholders replaced)
    - api/runs.py (_start_run: set_run_cap called after load_run_config)
    - lib/config_loader.py (RunConfig dataclass + both builders updated)
    - lib/cost.py (check_cap reads in-memory cap; new set_run_cap + emit_monthly_alert)
    - tests/conftest.py (runs:monthToDateCost handler added to _ConvexRunsStore)
tech_stack:
  added: []
  patterns:
    - In-memory cap registry (set_run_cap/check_cap) — avoids Convex read in hot acomplete path
    - Trailing-average projection — allow zero-history first run (D-06 edge)
    - cost-warning eventType reuse with scope=monthly payload discriminator (frozen union preserved)
    - Single-cost-writer rule preserved (no record_cost in budget.py or new callers)
key_files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/lib/budget.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/cost.py
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py
    - convex/runs.ts
    - packages/pipeline/tests/conftest.py
decisions:
  - "In-memory per-run cap registry (_run_caps dict keyed by run_id) avoids any Convex call in the hot acomplete path — RESEARCH Pattern 4 satisfied; cap snapshotted once at run start via set_run_cap(run_id, run_config.per_run_cap_usd)"
  - "Trailing-average projection uses last-4 completed runs from runs:monthToDateCost — zero-history returns None → first run always allowed (D-06)"
  - "Monthly alert reuses cost-warning eventType with scope='monthly' payload field — frozen deliberationEvents.eventType union untouched"
  - "conftest _ConvexRunsStore stub sums ALL seeded runs for MTD (no timestamp filter in unit tests — tests verify gate logic not date math)"
  - "pipeline_tick seam: emit_monthly_alert called with run_id='' (no run started yet) — alert fires before run creation so run_id is not yet known"
metrics:
  duration: "~7 min"
  completed: "2026-06-23"
  tasks_completed: 2
  files_modified: 6
---

# Phase 25 Plan 04: Budget Caps (RUN-06) Summary

DB-sourced per-run cap snapshotted at run start + trailing-average monthly start-gate + monthly-scope cost-warning alert. Makes the "100% of proceeds donated" promise auditable by capping spend on accurate, non-double-counted cost data.

## What Was Built

### Task 1 — DB-sourced per-run cap + monthly alert

**RunConfig additions (config_loader.py):**

Three new fields added to the `RunConfig` dataclass after `schedule_enabled`:
- `per_run_cap_usd: float = 10.0` — per-run hard cap (overrides env var)
- `monthly_cap_usd: float = 0.0` — monthly cap (0 = disabled)
- `alert_threshold_pct: float = 80.0` — soft-warn threshold percentage

Both `load_run_config()` (Convex path) and `_build_fallback_config()` populate all three from `pc.get(key, default)`.

**cost.py additions:**

- `_run_caps: dict[str, float]` — module-level per-run cap registry (no lock needed — immutable float per run_id)
- `set_run_cap(run_id, cap_usd)` — called once at run start to snapshot the DB cap; `check_cap` reads from this instead of always going to env var
- `emit_monthly_alert(run_id, mtd_usd, monthly_cap, threshold_pct)` — fire-and-forget `deliberationEvents:insert` with `eventType="cost-warning"` and payload `{"scope":"monthly",...}`; reuses frozen eventType; MUST NOT raise; MUST NOT call record_cost

`check_cap` updated: resolves cap as `_run_caps.get(run_id, float(os.environ.get("PIPELINE_COST_CAP_USD","10.0")))` — DB value wins when snapshotted, env var fallback preserved.

**runs.py wiring:**

After `run_config = await load_run_config(http)` and `await snapshot_config(...)`, added:
```python
set_run_cap(run_id, run_config.per_run_cap_usd)
```

### Task 2 — Trailing-average start-gate + monthToDateCost

**convex/runs.ts — `monthToDateCost` query:**

Single round-trip returning:
- `mtdUsd`: sum of `cost.total` for runs starting in the current calendar month (UTC)
- `completedCount`: count of complete/awaiting-review runs
- `trailingCosts`: array of `cost.total` for the last up-to-4 completed runs (newest-first)

Reads only actual `runs.cost` — no model_pricing derivation (single-cost-writer rule).

**lib/budget.py (new file):**

- `trailing_average(trailing_costs)` — returns `float | None`; `None` on empty list (zero-history allows first run, D-06)
- `would_exceed_monthly_cap(http, *, monthly_cap_usd)` — async predicate returning `(bool, info_dict)`:
  - `monthly_cap_usd <= 0` → `(False, {"reason":"cap_disabled",...})`
  - Zero history → `(False, {"reason":"no_history",...})`
  - `mtd + trailing_avg > cap` → `(True, {"mtdUsd","projected","cap"})`

**control.py seams wired:**

`pipeline_run` (manual trigger): reads `monthly_cap_usd` from `pipelineConfig:getAll`, calls `would_exceed_monthly_cap`; raises `HTTPException(409)` if over, with informative message showing MTD + projected vs cap.

`pipeline_tick` (cron): calls `would_exceed_monthly_cap` (reuses `pc` already fetched in step 1); if over, calls `emit_monthly_alert` then returns `{"status":"skipped","reason":"budget_projection_exceeds_cap"}`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] conftest _ConvexRunsStore missing runs:monthToDateCost handler**

- **Found during:** Task 2 test run — `test_start_gate_refuses_over_budget` needed `runs:monthToDateCost` to return a result from seeded runs; without a handler it fell through to the real Convex client (which has no HTTP in tests)
- **Fix:** Added `runs:monthToDateCost` handler to `_ConvexRunsStore._handle_query` that sums ALL seeded runs' cost as MTD (no timestamp filtering in unit tests — tests verify gate logic, not date math) and returns last-4 completed runs as `trailingCosts`
- **Files modified:** `tests/conftest.py`
- **Commit:** `266f90a`

## Self-Check: PASSED

Files created/modified:
- [x] `packages/pipeline/src/eisenbalm_pipeline/lib/budget.py` — exists, contains `trailing_average` and `would_exceed_monthly_cap`
- [x] `packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py` — RunConfig has per_run_cap_usd, monthly_cap_usd, alert_threshold_pct; both builders populate them
- [x] `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` — contains `set_run_cap` and `emit_monthly_alert`; check_cap reads from _run_caps
- [x] `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` — contains `set_run_cap(run_id, run_config.per_run_cap_usd)` after snapshot_config
- [x] `packages/pipeline/src/eisenbalm_pipeline/api/control.py` — both seam placeholders replaced; `would_exceed_monthly_cap` called ≥2 times; `emit_monthly_alert` in tick path
- [x] `convex/runs.ts` — contains `export const monthToDateCost = query` with total parsing
- [x] `tests/conftest.py` — `_ConvexRunsStore` handles `runs:monthToDateCost`

Commits:
- [x] `06887b8` — feat(25-04): DB-sourced per-run cap snapshot + monthly cost-warning alert
- [x] `266f90a` — feat(25-04): trailing-average start-gate wired into both control seams

Tests:
- [x] `test_per_run_cap_from_db` — PASSED
- [x] `test_monthly_alert_no_cancel` — PASSED
- [x] `test_start_gate_refuses_over_budget` — PASSED
- [x] `test_cost_double_count` (3 tests) — PASSED (regression)
