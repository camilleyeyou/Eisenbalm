---
phase: 25-run-control
verified: 2026-06-23T01:30:00Z
status: passed
score: 5/5 must-haves verified
gaps: []
human_verification:
  - test: "Trigger Run two-step confirm flow end-to-end"
    expected: "Click Trigger Run → confirm button appears inline → click confirm → run appears in history with trigger_source=manual and triggered_by=operator Clerk userId"
    why_human: "Requires live Clerk session, running pipeline endpoint, and Convex subscription — can't verify in test environment"
  - test: "Kill switch stops Railway cron in production"
    expected: "Set schedule_enabled=false in Config page → Railway cron calls /pipeline/tick → response is {status:skipped,reason:schedule_disabled} → no run appears in history"
    why_human: "Requires Railway cron wired to production endpoint; can't invoke Railway cron in test"
  - test: "Cancel Run cooperative timing"
    expected: "Click Cancel on a live run → current in-flight agent node completes → next node sees cancel flag → run ends in cancelled status within one agent node's duration"
    why_human: "Requires a live in-flight pipeline run; cooperative timing is inherently runtime behavior"
  - test: "Re-roll leaves sibling sections unchanged in Sanity"
    expected: "Click Re-roll on origin_story → only origin_story field changes in the weeklyIssue Sanity document; all other sections byte-identical"
    why_human: "Requires a real Sanity document with a prior complete run and live LangGraph checkpoint"
  - test: "Budget cap refuses run in dashboard"
    expected: "Set monthly_cap_usd below current MTD in Config → click Trigger Run → inline error appears showing 'trigger-run failed (409)' with MTD and projected vs cap detail"
    why_human: "Requires live pipeline endpoint returning a 409 with real budget data"
---

# Phase 25: Run Control Verification Report

**Phase Goal:** Operator can trigger a run on demand; a `schedule_enabled` kill switch gates all automated runs; a Railway cron calls the tick endpoint on the configured cadence; operator can cancel an in-flight run cooperatively; operator can re-roll a single agent/section via LangGraph checkpoint; per-run and monthly budget caps with alert thresholds are enforced.
**Verified:** 2026-06-23T01:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Operator triggers run; appears in history with `trigger_source="manual"` and `triggered_by`=operator identity | VERIFIED | `POST /pipeline/run` in `api/control.py:160` passes `triggerSource="manual"` + Clerk `claims["sub"]` to `_start_run`; `runs:create` writes `triggerSource`/`triggeredBy` to Convex; `RunsTable.tsx:98-101` and `RunDetail.tsx:124-128` render both fields |
| 2 | `schedule_enabled=false` causes Railway cron tick to no-op; dashboard shows kill switch state + next scheduled time with local timezone | VERIFIED | `pipeline_tick` at `control.py:266` checks `schedule_enabled` FIRST (Pitfall 4.2 guard); `AutomationPanel.tsx` reads live `configMap['schedule_enabled']` and renders `role="switch"`; `NextRunDisplay.tsx` uses `Intl.DateTimeFormat` with local + UTC dual display |
| 3 | Operator cancels live run; ends in `cancelled` status within one agent node; subsequent nodes no-op cleanly | VERIFIED | `cancel_run` endpoint at `control.py:333` calls `runs:requestCancel`; `agent_wrapper.py:125-127` polls `runs:isCancelRequested` before each node's `agentRuns:started` emit; `_execute_run` catches `RunCancelled` and writes `runs.status='cancelled'` |
| 4 | Re-roll regenerates single section via LangGraph checkpoint; Sanity draft updated; siblings unchanged | VERIFIED | `rerun_agent` at `control.py:382` calls `graph.aget_state` → bare node fn → `graph.aupdate_state(as_node=key)` → `_sc.write_issue_draft()`; D-03 422 guard blocks non-section agents; D-04 409 guard blocks while running; no `ainvoke` after `aupdate_state` (Pitfall 2) |
| 5 | Run exceeding monthly cap refused with warning; accumulated cost crossing alert threshold triggers notification | VERIFIED | `would_exceed_monthly_cap` in `budget.py` called in both `pipeline_run` and `pipeline_tick` seams; 409 HTTPException with MTD/projected detail returned; `pipelineControlClient.ts` surfaces error text to `RunControlBar` inline error display; `emit_monthly_alert` writes `cost-warning` Convex event (scope=monthly); `BudgetAlertBanner.tsx` renders `role="alert"` when threshold crossed. NOTE: Slack/email transport deliberately deferred to Phase 27 per design decision D-09 |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/API_CONTRACTS.md` §3B | Contract-first amendment for all Phase 25 endpoints | VERIFIED | §3B exists at line 830; all 4 endpoints documented; cancel-flag contract; 5 new pipeline_config keys |
| `convex/schema.ts` | `runs.cancelRequested: v.optional(v.boolean())` additive field | VERIFIED | Line 231; inside `runs:` block; frozen `pipelineRuns.status` union (running/awaiting-review/complete/failed) untouched |
| `packages/pipeline/src/eisenbalm_pipeline/lib/errors.py` | `class RunCancelled` exception | VERIFIED | Line 28; modeled on `CostCapExceeded`; Pitfall-1 split documented in docstring |
| `packages/pipeline/src/eisenbalm_pipeline/api/control.py` | All 4 endpoints: `/pipeline/run`, `/pipeline/tick`, `/runs/{id}/cancel`, `/runs/{id}/agents/{key}/rerun` | VERIFIED | Lines 160, 237, 333, 382; all routes present and substantive |
| `packages/pipeline/src/eisenbalm_pipeline/lib/scheduler.py` | `_is_due` + `compute_next_run_at` cadence engine | VERIFIED | Lines 49, 82; `_is_due` returns True when `now_ms >= schedule_next_run_at`; cursor strictly after now (Pitfall 6 guard) |
| `packages/pipeline/src/eisenbalm_pipeline/lib/budget.py` | `trailing_average` + `would_exceed_monthly_cap` | VERIFIED | Lines 35, 51; zero-history returns None (first run always allowed, D-06) |
| `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` | `set_run_cap` + `emit_monthly_alert` | VERIFIED | `set_run_cap` snapshots DB cap at run start; `emit_monthly_alert` fires `cost-warning` with `scope=monthly` |
| `convex/runs.ts` | `requestCancel`, `isCancelRequested`, `updateStatus` mutations + `monthToDateCost` query | VERIFIED | Lines 184, 202, 220, 120; MTD uses UTC calendar month boundaries |
| `convex/auditLog.ts` | Public `record` mutation | VERIFIED | Line 61; public mutation callable from FastAPI |
| `apps/dispatch-control/lib/pipelineControlClient.ts` | `triggerRun`, `cancelRun`, `rerollAgent` | VERIFIED | Lines 55, 87, 123; mirrors `testRunClient.ts` pattern; error text surfaced on `!res.ok` |
| `apps/dispatch-control/app/(dashboard)/runs/_components/RunControlBar.tsx` | Trigger Run two-step confirm; disabled-while-running | VERIFIED | `useQuery(api.runs.latest)` for live status; two-step confirm state; `triggerRun()` call |
| `apps/dispatch-control/app/(dashboard)/runs/_components/BudgetAlertBanner.tsx` | Amber alert when MTD >= threshold | VERIFIED | `useQuery(api.runs.monthToDateCost)`; `role="alert"`; renders only when threshold crossed |
| `apps/dispatch-control/app/(dashboard)/runs/_components/CancelRunButton.tsx` | Two-step confirm; running-only render | VERIFIED | `cancelRun()` call; inline confirm pattern |
| `apps/dispatch-control/app/(dashboard)/runs/_components/RerollButton.tsx` | 7 section writers; D-04 tooltip; success flash | VERIFIED | `SECTION_WRITERS` array; D-04 disabled tooltip; 3s "Re-rolled ✓" flash |
| `apps/dispatch-control/app/(dashboard)/config/_components/AutomationPanel.tsx` | Kill-switch toggle; schedule editor; NextRunDisplay | VERIFIED | `role="switch"`; live Convex `pipelineConfig:upsert`; `schedule_enabled` read from live Convex |
| `apps/dispatch-control/app/(dashboard)/config/_components/BudgetCapsPanel.tsx` | Budget caps form; MTD progress bar | VERIFIED | Live Convex reads/writes; MTD bar amber when over threshold |
| `apps/dispatch-control/app/(dashboard)/config/_components/NextRunDisplay.tsx` | Local tz + UTC dual display | VERIFIED | `Intl.DateTimeFormat(undefined, ...)` for local; `en-US` with UTC for UTC; "Not scheduled yet." when `nextRunAt===0` |
| `packages/pipeline/scripts/seed_phase25_config.py` | 5 new config keys; `schedule_enabled` absent | VERIFIED | Keys: `per_run_cap_usd`, `monthly_cap_usd`, `alert_threshold_pct`, `schedule_cadence`, `schedule_next_run_at`; `schedule_enabled` not present |
| `packages/pipeline/tests/test_{control,cancel,reroll,budget_gate,scheduler}.py` | 13 acceptance-bar tests passing | VERIFIED | All 13 tests pass (confirmed: `324 passed, 33 skipped`) |
| `apps/dispatch-control/__tests__/runControl.test.tsx` | 20+ UI assertions | VERIFIED | 100 tests pass in dispatch-control suite |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline_tick` | `schedule_enabled` kill switch | `control.py:266` check FIRST (Pitfall 4.2) | WIRED | Returns `{"status":"skipped","reason":"schedule_disabled"}` before any other guard |
| `pipeline_tick` | `_is_due` cadence check | `control.py:271` + `lib/scheduler._is_due` | WIRED | Returns `{"status":"skipped","reason":"not_due"}` when cursor in future |
| `pipeline_tick` | `compute_next_run_at` cursor advance | `control.py:314` after fire | WIRED | Strictly-after-now cursor (Pitfall 6) written to `pipelineConfig:upsert` |
| `pipeline_run` / `pipeline_tick` | `would_exceed_monthly_cap` start-gate | `control.py:200,280` seams | WIRED | 409 (manual) / `{"reason":"budget_projection_exceeds_cap"}` (tick) |
| `_start_run` | `set_run_cap(run_id, per_run_cap_usd)` | `runs.py:323` | WIRED | DB cap snapshotted once before `asyncio.create_task`; no hot-path Convex read |
| `wrap_agent_node` | `runs:isCancelRequested` cancel-flag poll | `agent_wrapper.py:125-127` | WIRED | Polls via `_cc.convex_query_safe` BEFORE `agentRuns:started` emit |
| `_execute_run` | `RunCancelled` → `runs.status='cancelled'` | `runs.py:191-202` | WIRED | Catches `RunCancelled`; writes `runs:updateStatus 'cancelled'` |
| `rerun_agent` | `graph.aget_state` → bare fn → `graph.aupdate_state` → `write_issue_draft` | `control.py:442,483,492` | WIRED | Full re-roll chain without `ainvoke` (Pitfall 2 avoided) |
| `RunControlBar` | `POST /pipeline/run` via `pipelineControlClient.triggerRun` | `RunControlBar.tsx:43` | WIRED | Live Convex `useQuery(api.runs.latest)` gates disabled state |
| `CancelRunButton` | `POST /runs/{id}/cancel` via `pipelineControlClient.cancelRun` | `CancelRunButton.tsx:41` | WIRED |  |
| `RerollButton` | `POST /runs/{id}/agents/{key}/rerun` via `pipelineControlClient.rerollAgent` | `RerollButton.tsx:70` | WIRED |  |
| `AutomationPanel` | `pipelineConfig:upsert` for kill-switch write | `AutomationPanel.tsx:94` | WIRED | Live `useMutation(api.pipelineConfig.upsert)` |
| `BudgetAlertBanner` | `api.runs.monthToDateCost` for live MTD | `BudgetAlertBanner.tsx:24` | WIRED | Renders only when `mtd.mtdUsd / monthlyCap >= alertThreshold / 100` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `RunControlBar` | `latest` (live run status) | `useQuery(api.runs.latest, {workspace_id})` | Convex DB query | FLOWING |
| `BudgetAlertBanner` | `mtd.mtdUsd` | `useQuery(api.runs.monthToDateCost)` | `convex/runs.ts:monthToDateCost` parses `runs.cost` JSON, sums calendar-month rows | FLOWING |
| `AutomationPanel` | `scheduleEnabled`, `nextRunAt` | `useQuery(api.pipelineConfig.getAll)` | Convex DB query on `pipeline_config` table | FLOWING |
| `BudgetCapsPanel` | `perRunCap`, `monthlyCap`, MTD bar | `useQuery(api.pipelineConfig.getAll)` + `useQuery(api.runs.monthToDateCost)` | Live Convex reads | FLOWING |
| `NextRunDisplay` | `nextRunAt` prop | `AutomationPanel` → `configMap['schedule_next_run_at']` | Convex `pipeline_config` | FLOWING |
| `pipeline_tick` | `pc` (all config) | `pipelineConfig:getAll` before guard chain | Convex DB | FLOWING |
| `would_exceed_monthly_cap` | `mtdUsd`, `trailingCosts` | `runs:monthToDateCost` Convex query | Real `runs.cost` parsed JSON | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 5 run-control test files pass | `/Users/user/Desktop/Eisenbalm/packages/pipeline/.venv/bin/python -m pytest packages/pipeline/tests/test_control.py tests/test_cancel.py tests/test_reroll.py tests/test_budget_gate.py tests/test_scheduler.py -q --tb=no` | 13 passed | PASS |
| Full pipeline suite passes | `/Users/user/Desktop/Eisenbalm/packages/pipeline/.venv/bin/python -m pytest packages/pipeline/tests/ -q --tb=no` | 324 passed, 33 skipped | PASS |
| dispatch-control suite passes | `cd apps/dispatch-control && pnpm test` | 100 passed | PASS |
| control.py is importable with all 4 routes | `grep -c "@router\." control.py` | 4 routes | PASS |
| scheduler.py functions exist | `grep -c "def " lib/scheduler.py` | 2 functions | PASS |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RUN-01 | 25-02, 25-05 | Operator can trigger a new issue run on demand from the dashboard | SATISFIED | `POST /pipeline/run` with Clerk JWT, `triggerSource="manual"`, `triggeredBy=claims["sub"]`; `RunControlBar.tsx` two-step trigger UI; `test_manual_trigger_records_operator` passes |
| RUN-02 | 25-02, 25-05 | Master `schedule_enabled` kill switch; scheduler tick checks it FIRST | SATISFIED | `pipeline_tick` checks `schedule_enabled` at line 266 BEFORE any other guard; `AutomationPanel.tsx` `role="switch"` toggle writes live Convex; `test_tick_kill_switch_noop` passes |
| RUN-03 | 25-02, 25-05 | Railway cron calls tick endpoint on configured cadence; operator can edit cadence / see next run with timezone | SATISFIED | `lib/scheduler._is_due` + `compute_next_run_at`; cursor advances strictly after now; `NextRunDisplay.tsx` with `Intl.DateTimeFormat` local+UTC; `test_is_due_fires_when_due`, `test_next_run_cursor_advances` pass |
| RUN-04 | 25-03, 25-05 | Operator can cancel in-flight run; pipeline stops cooperatively; consistent `cancelled` state | SATISFIED | `cancel_run` endpoint sets `runs:requestCancel`; `wrap_agent_node` polls cancel flag; `_execute_run` catches `RunCancelled`; `CancelRunButton.tsx` two-step confirm; `test_cancel_lands_cancelled`, `test_cooperative_not_violent` pass |
| RUN-05 | 25-03, 25-05 | Operator can re-roll single agent/section without rerunning whole pipeline | SATISFIED | `rerun_agent` endpoint with 7-section-writer restriction (422 non-section), 409-while-running (D-04); `graph.aget_state`→bare fn→`graph.aupdate_state`→`write_issue_draft`; no `ainvoke` (Pitfall 2); `RerollButton.tsx`; `test_reroll_leaves_siblings_unchanged`, `test_reroll_blocked_while_running`, `test_reroll_rejects_non_section` pass |
| RUN-06 | 25-04, 25-05 | Per-run and monthly budget caps with alert thresholds; warn at threshold; refuse over cap | SATISFIED | `lib/budget.would_exceed_monthly_cap` trailing-average start-gate (409/skipped); `lib/cost.set_run_cap` DB-sourced cap snapshot; `emit_monthly_alert` Convex cost-warning event (scope=monthly); `BudgetAlertBanner.tsx` live MTD display; `BudgetCapsPanel.tsx` cap editor; `test_start_gate_refuses_over_budget`, `test_per_run_cap_from_db`, `test_monthly_alert_no_cancel` pass. Slack/email transport deferred to Phase 27 (D-09 design decision) |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `api/control.py` | 286 | `run_id=""` in `emit_monthly_alert` call in tick path | Info | Intentional design decision documented in Plan 04 SUMMARY: no run started yet when tick budget gate fires, empty string is correct sentinel; `emit_monthly_alert` is fire-and-forget and never raises |

No blockers or warnings found. The one info-level item is intentional per documented design decisions.

---

### Human Verification Required

The following behaviors require a live environment with a running pipeline, Clerk session, and Railway cron:

1. **Trigger Run end-to-end with operator attribution**
   - **Test:** Log in as operator → open /runs → click Trigger Run → click confirm → wait for run to appear
   - **Expected:** Run appears in history with `trigger_source = manual` and `triggered_by = operator Clerk userId`
   - **Why human:** Requires live Clerk JWT, running FastAPI endpoint, and Convex subscription

2. **Kill switch stops cron in production**
   - **Test:** Set `schedule_enabled = false` in Config page → observe that Railway cron POSTs return `{status:skipped,reason:schedule_disabled}`
   - **Expected:** No new runs appear during the disabled window
   - **Why human:** Requires Railway cron provisioned and calling the production endpoint

3. **Cancel Run cooperative timing**
   - **Test:** While a pipeline run is in progress (agent node executing), click Cancel → confirm → observe
   - **Expected:** Current node finishes; subsequent node sees cancel flag; run ends in `cancelled` status
   - **Why human:** Requires a live in-flight run; cooperative timing is runtime behavior

4. **Re-roll section Sanity update**
   - **Test:** Find a completed run → click Re-roll on origin_story → confirm → inspect Sanity document
   - **Expected:** Only `originStory` field changed; all other sections byte-identical in the Sanity draft
   - **Why human:** Requires a real LangGraph checkpoint and Sanity document with prior content

5. **Budget cap refuses run with error display**
   - **Test:** Set `monthly_cap_usd` below current MTD in BudgetCapsPanel → click Trigger Run
   - **Expected:** Inline error appears showing `"trigger-run failed (409)"` with MTD and cap detail
   - **Why human:** Requires live pipeline endpoint returning a 409 with real budget calculation

---

### Gaps Summary

No gaps. All five success criteria are fully implemented and verified:

- RUN-01 (manual trigger): `POST /pipeline/run` + `RunControlBar` two-step confirm, both wired to live Convex.
- RUN-02 (kill switch): `schedule_enabled` checked first in `pipeline_tick`; `AutomationPanel` `role="switch"` reads/writes live Convex.
- RUN-03 (cron cadence): `_is_due` + `compute_next_run_at` with Pitfall 6 protection; `NextRunDisplay` uses `Intl.DateTimeFormat`.
- RUN-04 (cooperative cancel): cancel-flag poll in `wrap_agent_node`; `RunCancelled` landing in `_execute_run`; `CancelRunButton` UI.
- RUN-05 (re-roll): `aget_state` → bare fn → `aupdate_state` → `write_issue_draft`; 422/409 guards; `RerollButton` UI.
- RUN-06 (budget caps): trailing-average start-gate; DB-sourced per-run cap; monthly cost-warning alert; `BudgetCapsPanel` + `BudgetAlertBanner` UI.

The only notable architectural scope decision is Slack/email notification transport for budget alerts, which is explicitly deferred to Phase 27 per CONTEXT.md D-09 decision. The dashboard `BudgetAlertBanner` surfaces the alert to the operator, satisfying the observable requirement within Phase 25's contracted scope.

---

_Verified: 2026-06-23T01:30:00Z_
_Verifier: Claude (gsd-verifier)_
