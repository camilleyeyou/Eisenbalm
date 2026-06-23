---
phase: 25
slug: run-control
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-22
updated: 2026-06-22
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Filled by the planner from 25-RESEARCH.md "## Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (pipeline)** | pytest — `cd packages/pipeline && uv run pytest` (async via existing conftest.py; EISENBALM_STUB_MODE short-circuits LLM/network) |
| **Framework (dashboard)** | Vitest — `pnpm --filter dispatch-control test:unit` |
| **Framework (convex)** | convex-test harness (`apps/dispatch-control/__tests__/setup.ts`) |
| **Config files** | packages/pipeline/pyproject.toml · apps/dispatch-control/vitest.config.ts |
| **Quick run command** | `cd packages/pipeline && uv run pytest tests/test_control.py tests/test_cancel.py tests/test_reroll.py tests/test_budget_gate.py tests/test_scheduler.py -x -q` |
| **Full suite command** | `cd packages/pipeline && uv run pytest -x -q` (≥200 baseline) + `pnpm --filter dispatch-control test:unit` |
| **Estimated runtime** | ~30–60 seconds per package |

---

## Sampling Rate

- **After every task commit:** Run the quick run command for the touched package.
- **After every plan wave:** Run the full suite command.
- **Before `/gsd:verify-work`:** Both full suites green + existing tripwires (test_cost_double_count.py, test_agent_wrapper.py, test_builder_wiring.py) green.
- **Max feedback latency:** < 60 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-T3 | 25-01 | 1 | RUN-01..06 | scaffold (RED) | `cd packages/pipeline && uv run pytest tests/test_control.py tests/test_cancel.py tests/test_reroll.py tests/test_budget_gate.py tests/test_scheduler.py --collect-only -q` | ❌→ Wave 0 | ⬜ pending |
| 02-T1 | 25-02 | 2 | RUN-03 | unit | `cd packages/pipeline && uv run pytest tests/test_scheduler.py -x -q` | ❌→ 01-T3 | ⬜ pending |
| 02-T2 | 25-02 | 2 | RUN-01, RUN-02 | integration (stub) | `cd packages/pipeline && uv run pytest tests/test_control.py -x -q` | ❌→ 01-T3 | ⬜ pending |
| 03-T1 | 25-03 | 3 | RUN-04 | integration (stub) | `cd packages/pipeline && uv run pytest tests/test_cancel.py -x -q` | ❌→ 01-T3 | ⬜ pending |
| 03-T2 | 25-03 | 3 | RUN-05 | integration (stub) | `cd packages/pipeline && uv run pytest tests/test_reroll.py -x -q` | ❌→ 01-T3 | ⬜ pending |
| 04-T1 | 25-04 | 4 | RUN-06 | unit + integration | `cd packages/pipeline && uv run pytest tests/test_budget_gate.py::test_per_run_cap_from_db tests/test_budget_gate.py::test_monthly_alert_no_cancel -x -q` | ❌→ 01-T3 | ⬜ pending |
| 04-T2 | 25-04 | 4 | RUN-06 | integration (stub) | `cd packages/pipeline && uv run pytest tests/test_budget_gate.py -x -q` | ❌→ 01-T3 | ⬜ pending |
| 05-T1 | 25-05 | 5 | RUN-01, RUN-02, RUN-06 | component | `cd apps/dispatch-control && pnpm test:unit -- runControl` | ❌→ Wave 0 | ⬜ pending |
| 05-T2 | 25-05 | 5 | RUN-04, RUN-05 | component | `cd apps/dispatch-control && pnpm test:unit -- runControl` | ❌→ Wave 0 | ⬜ pending |
| 05-T3 | 25-05 | 5 | RUN-03, RUN-06 | component | `cd apps/dispatch-control && pnpm test:unit -- nextRunDisplay` | ❌→ Wave 0 | ⬜ pending |
| regression | all | all | — | tripwire | `cd packages/pipeline && uv run pytest tests/test_cost_double_count.py tests/test_agent_wrapper.py -q` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Authored in Plan 25-01 Task 3 (pipeline) and Plan 25-05 Tasks 1/3 (dashboard):

- [ ] `packages/pipeline/tests/test_control.py` — RUN-01 trigger records operator + RUN-02 tick kill-switch no-op
- [ ] `packages/pipeline/tests/test_cancel.py` — RUN-04 cooperative cancel + cancelled landing
- [ ] `packages/pipeline/tests/test_reroll.py` — RUN-05 isolation + D-04 guard + non-section 422
- [ ] `packages/pipeline/tests/test_budget_gate.py` — RUN-06 start-gate + DB cap + monthly alert
- [ ] `packages/pipeline/tests/test_scheduler.py` — `_is_due` / next-run cursor advance (Pitfall 6)
- [ ] `packages/pipeline/tests/conftest.py` — runs/pipeline_config Convex stub fixture (`convex_runs_store` / `convex_config_store`)
- [ ] `apps/dispatch-control/__tests__/runControl.test.tsx` — trigger disabled-while-running + cancelled badge + cancel/re-roll button states
- [ ] `apps/dispatch-control/__tests__/nextRunDisplay.test.tsx` — next-run local-tz + UTC display + kill-switch toggle a11y

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Railway cron → `/pipeline/tick` provisioning | RUN-03 | Human infra step (Andrew provisions the Railway cron service; cron expression fixed at provision time; cannot be automated) | Provision a Railway cron POSTing `/pipeline/tick` hourly with `X-Pipeline-Trigger-Secret`; confirm tick no-ops when `schedule_enabled=false` and fires when due |
| Operator-local timezone display | RUN-03 | Browser-rendered, locale-dependent | Verify next-run shows operator local TZ + UTC alongside (e.g. "Thu Jun 26, 2:00 PM PDT (21:00 UTC)") |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (5 pipeline test files + 2 dashboard test files + conftest fixture)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved 2026-06-22
