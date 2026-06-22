# Phase 25: Run Control - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the operator **runtime control over when and whether the pipeline runs** —
the second write/control surface on `apps/dispatch-control` (Phase 24 added prompt
editing). Deliver the six RUN-* capabilities:

- **RUN-01 — On-demand trigger.** A dashboard "Trigger Run" button starts a new
  pipeline run; the run appears in history with `trigger_source = "manual"` and
  `triggered_by` = the operator's identity.
- **RUN-02 — Kill switch.** A master `schedule_enabled` flag (a `pipeline_config`
  key) that the scheduler tick checks FIRST; when off, automated runs no-op.
  Automation is controlled by data, not by enabling/disabling the cron service.
- **RUN-03 — Scheduler tick + cadence editor.** A Railway cron POSTs to a new
  `/pipeline/tick` endpoint on a cadence; the operator edits cadence / pause /
  resume and sees the next scheduled run with timezone shown explicitly.
- **RUN-04 — Cooperative cancel.** `POST /runs/{id}/cancel` ends an in-flight run
  in a consistent `cancelled` state within the span of one agent node completing.
- **RUN-05 — Single-agent re-roll.** Regenerate one section writer within an
  existing run via the LangGraph checkpoint, without rerunning the whole pipeline
  (absorbs former V2-05).
- **RUN-06 — Budget caps + alerts.** Per-run and monthly budget caps with alert
  thresholds; refuse to start a run projected to exceed the monthly cap; alert
  when a threshold is crossed.

**Enabling facts found in the codebase (shape the decisions below):**
- The graph runs as a strong-ref'd background `asyncio` task (`api/runs.py` →
  `app.state.graph.ainvoke`); `wrap_agent_node` (`lib/agent_wrapper.py`) wraps
  **every** node — the natural cooperative-cancel checkpoint.
- `lib/cost.py` already raises `CostCapExceeded` at the per-run cap and fires a
  70% soft-warn Convex `deliberationEvents` event — budget infra is **partially
  built**.
- `pipeline_config` is a generic `{key, value(JSON)}` store and `runs.status` is a
  free `v.string()` — so `schedule_enabled`, caps, cadence, and a `cancelled`
  status add **no schema migration**.
- The cron CLI (`cli.py::trigger_weekly`, `0 14 * * 4`) exists but the Railway
  cron service is **not provisioned**; Railway cron expressions are **not**
  reconfigurable via API (known infra constraint → tick-decides-timing model).

**Explicitly NOT in scope (later phases):**
- Review gate (`awaiting_review` queue, approve/schedule/reject, rendered preview,
  factual-claims checklist) + charity registry / Scout dedup — **Phase 26**.
- Slack/email **notification transport**, Stripe reconciliation, `model_pricing`
  staleness — **Phase 27**. (Phase 25 emits the budget-alert event; Phase 27 hooks
  transport onto it — see D-09.)
- Per-agent enable/disable toggle UI (DB-driven replacement for
  `DESIGNAGENT_SUPPRESSED`) — not required here; Claude's discretion only if
  trivially co-located.
- Re-rolling upstream nodes (scout/researcher/chronicler) or QA/editor_final —
  section writers only this phase (D-04).
- Editable graph topology ("graph-as-data") — Phase 28 / productization.

</domain>

<decisions>
## Implementation Decisions

### Cancel behavior (RUN-04)
- **D-01: Mark `cancelled`, leave partials.** On cancel, set `runs` /
  `pipelineRuns` status to `cancelled`, stop cleanly, and leave whatever partial
  Sanity draft + Convex events already exist untouched (no destructive cleanup —
  the draft is never reader-visible; publish is gated). Operator re-triggers a
  fresh run. (`runs.status` is a free string, so `cancelled` is a new value, not a
  schema change.)
- **D-02: Cooperative, between-nodes — let in-flight nodes finish, block the
  rest.** Nodes already executing complete normally (do NOT hard-kill the asyncio
  task or tear LLM calls mid-request); a cancel flag stops the graph from
  advancing past the current step / fan-out join and prevents new nodes from
  starting. The `wrap_agent_node` wrapper checks the flag before running its node
  and no-ops cleanly if set. This satisfies "within the span of one agent node
  completing" and is safe for the concurrent 7-section fan-out.

### Re-roll blast radius (RUN-05)
- **D-03: Section writers only.** Re-rollable set = the 7 content nodes
  (`origin_story`, `problem`, `founder_bio`, `case_study`, `game`, `bonus`,
  `design`). Smallest blast radius; matches V2-05's "regenerate a section" intent.
- **D-04: Only on a finished / `awaiting-review` run.** Re-roll operates on a
  completed run's LangGraph checkpoint; no re-roll while a run is actively
  executing (mirrors Phase 24 D-02 block-with-explanation; avoids checkpoint
  races against the live background task).
- **D-05: Isolated regeneration.** Re-run only the target node from the
  checkpoint, write its new output to Sanity, leave all sibling sections
  unchanged (the success criterion explicitly requires this). Section writers are
  siblings with no inter-dependency, so isolated re-run is safe. Re-running QA /
  editor_final is NOT automatic (would be a separate explicit action; out of
  scope this phase).

### Budget caps + alerts (RUN-06)
- **D-06: Start gate = trailing-average projection.** Estimate a run's cost as the
  trailing average of recent real run costs (the brief's "trailing average run
  cost"); if month-to-date + projection > monthly cap, **refuse to start** with a
  clear dashboard warning. Uses real captured data — no manual "expected cost"
  constant.
- **D-07: Mid-run breach — per-run cap hard-stops, monthly cap alerts only.**
  Preserve existing `cost.py` behavior: the per-run cap raises `CostCapExceeded`
  → the run ends via the cooperative-cancel path (lands in `cancelled` / `failed`).
  The monthly cap does NOT auto-cancel mid-run (don't kill a nearly-complete
  weekly issue over the month total) — it alerts. The 70% soft-warn stays.
- **D-08: Caps + thresholds live in `pipeline_config`.** Add `per_run_cap_usd`,
  `monthly_cap_usd`, and alert-threshold keys as JSON values (no schema change).
  Wire the existing per-run-cap path to read the DB value rather than only env.
- **D-09: Alert boundary vs Phase 27 — emit event + dashboard surface, defer
  transport.** Phase 25 writes the budget-threshold alert as a Convex event
  (extend the existing `cost-warning` event) and surfaces it prominently in the
  dashboard. Phase 27 hooks Slack/email **transport** onto that same event. Clean
  seam, no throwaway channel.

### Scheduler timing (RUN-02 / RUN-03)
- **D-10: DB cadence drives timing; Railway ticks frequently.** Provision the
  Railway cron to POST `/pipeline/tick` often (e.g. hourly). The tick checks
  `schedule_enabled` FIRST (no-op when off), then compares `now` against the DB
  cadence / next-run and only fires a run when due. The operator controls
  cadence / pause / resume entirely from the dashboard with **no Railway
  redeploy** (works around the non-reconfigurable Railway cron expression).
- **D-11: Next-run display = operator local timezone, with UTC alongside.** e.g.
  "Next run: Thu Jun 26, 2:00 PM PDT (21:00 UTC)". Satisfies criterion 2's
  "operator's local timezone shown explicitly". Store cadence canonically (UTC)
  in `pipeline_config`.
- **D-12: One run at a time — reject if a run is active.** Both `POST
  /pipeline/run` (manual) and a due tick no-op / return 409 when a run is already
  `running`. Matches the research anti-feature (no queuing) and the brief's
  single-issue-at-a-time design; surface as block-with-explanation in the UI.

### Claude's Discretion
- Exact endpoint shapes/names (`/pipeline/run` vs reusing `/run/weekly`;
  `/pipeline/tick`; `/runs/{id}/cancel`; the re-roll route, e.g.
  `POST /issues/{id}/agents/{key}/rerun` or `/runs/{id}/agents/{key}/rerun`) —
  amend `docs/API_CONTRACTS.md` BEFORE coding (CLAUDE.md hard rule).
- Cancel-flag mechanism (Convex flag the wrapper polls vs in-process event) and
  where it's read inside `wrap_agent_node`.
- LangGraph checkpoint re-roll mechanics (targeted start node via `thread_id =
  run_id`; how new output merges back without disturbing siblings).
- Operator-identity (`triggered_by`) plumbing from Clerk → the trigger endpoint
  (reuse the Phase 21–24 dashboard-auth pattern + existing
  `X-Pipeline-Trigger-Secret`).
- Which run-control actions emit `audit_log` rows (reuse Phase 23 audit infra) —
  recommend trigger / cancel / re-roll / kill-switch-flip / cadence-change /
  cap-change at minimum.
- Trailing-average window size and cost-projection storage.
- Cadence representation in config (cron string vs structured day/time fields).
- All dashboard UI: trigger button, kill-switch toggle (visually clear when off),
  schedule editor, cancel/cancel-confirm, re-roll UI, budget config + alert
  surface, empty/mobile states.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.0 spec & reconciliation (read first)
- `docs/MISSION_CONTROL_BRIEF.md` — §3C (Run control: manual trigger, `schedule_enabled`
  kill switch + `/pipeline/tick`, schedule editor, cancel, re-roll), §3B (budget
  controls: monthly/per-run caps, alert thresholds, projected spend from trailing
  average), §4.6 (notifications — Phase 27 boundary), §5 (API surface:
  `POST /pipeline/run` · `/pipeline/tick` · `/runs/{id}/cancel` ·
  `/issues/{id}/agents/{key}/rerun`; data model incl. `pipeline_config`,
  `runs.trigger_source`/`triggered_by`), §7 Phase 3 entry, §8.4 (Railway-cron
  scheduler decision).
- `docs/CURRENT_STATE.md` — Q2 (trigger = `POST /run/weekly` guarded by
  `X-Pipeline-Trigger-Secret`; weekly cron coded in `cli.py::trigger_weekly` but
  Railway service NOT provisioned), Q3 + "Postgres checkpointer" §
  (`graph/checkpointer.py:36`, `AsyncPostgresSaver`, `thread_id` = run state — the
  re-roll substrate), the "no Vercel/GitHub cron" note.

### Research (v2.0 milestone)
- `.planning/research/FEATURES.md` — **Feature Group 4** (Run Control: trigger,
  kill switch, `/pipeline/tick`, cancel, schedule editor, single-agent re-roll —
  complexity + dependency notes; anti-features: no killing Railway cron from UI,
  no auto-retry-on-cancel, no run queuing → 409 if running), **Feature Group 3**
  (budget cap enforcement; `cost.py:244-261` soft-warn already wired).
- `.planning/research/PITFALLS.md` — Category 3 (Cost/Budget: double-counting,
  hard-stop orphan state, pricing drift — budget caps depend on accurate cost
  numbers; the single-cost-writer rule from Phase 23 carries forward).
- `.planning/research/ARCHITECTURE.md` — config-in-Convex read path
  (`state["config"]`), snapshot-before-invoke (why mid-run state is stable).
- `.planning/research/SUMMARY.md` — milestone framing, config/versioning model.

### Prior phase context (the foundation this phase builds on)
- `.planning/phases/24-prompt-editor-versioning/24-CONTEXT.md` — D-02
  block-with-explanation (no queue) precedent reused for cancel/re-roll/trigger
  guards; in-progress-run detection reads `runs`/`pipelineRuns` status; audit-log
  emission pattern.
- `.planning/phases/23-node-wrappers-read-only-dashboard/23-CONTEXT.md` —
  `wrap_agent_node` lifecycle/live-progress (the cancel-flag checkpoint),
  `agent_runs`/`agent_run_payloads`, `audit_log` infra, single-cost-writer rule.
- `.planning/phases/22-config-externalization/22-CONTEXT.md` —
  `load_run_config()` Convex-first + disk/code fallback; `snapshot_config()`
  before invoke; `pipeline_config` key/value pattern; agentKey canonical mapping.
- `.planning/phases/21-auth-app-shell-convex-schema/21-CONTEXT.md` —
  dispatch-control shell, Clerk auth (operator identity for `triggered_by`),
  `runs`/`pipeline_config`/`audit_log` table origins, `workspace_id` discipline.

### Existing code / contracts (edit/extension targets)
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` — `POST /run/weekly`
  trigger + the strong-ref'd background-task pattern (`graph.ainvoke`); pre-run
  Convex writes (`pipelineRuns:create`, `runs:create` with `triggerSource`,
  `agentRuns:queueForRun`, `snapshot_config`). Model `/pipeline/tick`,
  `/runs/{id}/cancel`, re-roll, and `triggered_by` here (or a sibling router).
- `packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py` —
  `wrap_agent_node`; insert the cooperative cancel-flag check here (D-02).
- `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` — `CostCapExceeded`
  (per-run hard-stop, D-07), 70% soft-warn `deliberationEvents` emit (extend for
  D-09), `begin_run`/`get_cost_payload`. Read cap from `pipeline_config` (D-08).
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — compiled graph
  (`compile(checkpointer=...)`); re-roll invokes it with a targeted start node
  (D-03/D-05). `SECTION_WRITERS` = the re-rollable set.
- `packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py:28-43` —
  `AsyncPostgresSaver` factory; re-roll reads checkpoint state by `thread_id`.
- `packages/pipeline/src/eisenbalm_pipeline/cli.py::trigger_weekly` — existing
  cron CLI; the `/pipeline/tick` handler subsumes/complements it (D-10).
- `convex/schema.ts` — `pipeline_config` (generic key/value JSON — add
  `schedule_enabled`, caps, cadence keys; no migration), `runs` (free-string
  `status` — add `cancelled`; `trigger_source`/`triggered_by` already present),
  `pipelineRuns`, `agent_runs`. Read `convex/_generated/ai/guidelines.md` first;
  do NOT modify frozen `pipelineRuns`/`deliberationEvents` field shapes.
- `convex/pipelineConfig.ts` — config get/set; add cap/cadence/kill-switch
  read+write used by the tick, start-gate, and dashboard.
- `convex/runs.ts` — `runs:create`/`updateStatus`; add the `cancelled` transition
  + cancel-flag surface the wrapper reads.
- `convex/auditLog.ts` — shared audit-write helper for run-control actions.
- `apps/dispatch-control/app/(dashboard)/runs/` + `/config/` — existing routes;
  the trigger/cancel/re-roll/schedule/budget UI lands here.
- `docs/API_CONTRACTS.md` — amend BEFORE code (CLAUDE.md hard rule) for the new
  endpoints, the cancel-flag contract, the re-roll contract, and any
  `pipeline_config`/`DispatchState` additions. Frozen `pipelineRuns` (§4)
  unchanged.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `wrap_agent_node` (Phase 23) wraps every node — single insertion point for the
  cooperative cancel-flag check (D-02), no per-agent edits.
- `lib/cost.py`: `CostCapExceeded` per-run hard-stop + 70% soft-warn Convex event
  already exist — budget work is extension, not greenfield (D-06/D-07/D-09).
- `pipeline_config` generic key/value JSON + `convex/pipelineConfig.ts` — new
  flags/caps/cadence are new keys, **zero schema migration** (D-08/D-10).
- `runs.status` free string — `cancelled` is a new value, no enum migration (D-01).
- `AsyncPostgresSaver` checkpointer keyed by `thread_id = run_id` — the re-roll
  substrate already in place (D-03/D-05).
- `cli.py::trigger_weekly` + `X-Pipeline-Trigger-Secret` auth — trigger/tick reuse.
- Phase 23 `audit_log` helper + viewer — wire run-control actions in.
- Clerk operator identity (Phase 21) — source for `triggered_by`.

### Established Patterns
- Trigger flow writes `pipelineRuns:create` → `runs:create` (with
  `triggerSource`) → `agentRuns:queueForRun` → `snapshot_config`, all awaited
  BEFORE `asyncio.create_task` (config can't out-race its own snapshot).
- Background graph execution = strong-ref'd `asyncio` task surviving client
  disconnect; the wrapper writes terminal status on failure.
- Block-with-explanation over queue/deferred state (Phase 24 D-02) — applied to
  cancel/re-roll/trigger concurrency (D-04/D-12).
- Single cost writer (`acomplete → record_cost`); the wrapper/cost reads are
  READ-ONLY (Pitfall 1) — budget reads must not double-count (D-06/D-07).
- `workspace_id: "eisenbalm"` threaded through all new rows; control plane stays
  brand-agnostic (operates on whatever the data defines).

### Integration Points
- `lib/agent_wrapper.py` — cancel-flag read (cooperative stop).
- `api/runs.py` (or new `api/control.py`/`api/scheduler.py` router) — trigger
  (+`triggered_by`), `/pipeline/tick`, `/runs/{id}/cancel`, re-roll, start-gate.
- `lib/cost.py` ↔ `pipeline_config` caps; budget-alert Convex event.
- `graph/builder.py` + `graph/checkpointer.py` — targeted-node re-roll.
- `convex/{pipelineConfig,runs,auditLog}.ts` — config/caps/cadence, cancelled
  transition + cancel flag, audit rows.
- `apps/dispatch-control` `/runs` + `/config` routes — all run-control UI.
- Railway cron service (NEW provisioning) → `/pipeline/tick` (Andrew infra step,
  like the Phase 4 Railway/Phase 22 deploy-key checkpoints).

</code_context>

<specifics>
## Specific Ideas

- Cooperative cancel must be **clean, not violent** — finish in-flight nodes /
  LLM calls, just don't advance (D-02). The success criterion's "within the span
  of one agent node completing" is the acceptance bar.
- Re-roll's headline guarantee: **"the other sections are unchanged"** — isolated
  single-node regeneration off the checkpoint (D-05).
- The kill switch is **data, not infrastructure** — `schedule_enabled=false`
  makes the tick a no-op; never try to stop the Railway cron service from the UI
  (research anti-feature).
- Budget transparency underpins the "100% of proceeds donated" promise — caps and
  cost numbers must read from the single accurate cost path, never double-count.
- Keep the control plane brand-agnostic — no hardcoded "eisenbalm"/charity logic
  in the run-control surface.

</specifics>

<deferred>
## Deferred Ideas

- Slack / email **notification transport** for budget + run-lifecycle alerts —
  Phase 27 (Phase 25 emits the Convex alert event + dashboard surface; D-09).
- Review gate (`awaiting_review` queue, rendered preview, approve/schedule/reject,
  factual-claims checklist) + charity registry / Scout dedup — Phase 26.
- Stripe reconciliation, `model_pricing` staleness indicator — Phase 27.
- Re-rolling upstream nodes (scout/researcher/chronicler) or auto re-running
  QA/editor_final after a section re-roll — revisit if operators need wider
  re-roll (out of scope; D-03/D-05).
- DB-driven per-agent enable/disable toggle (replacing `DESIGNAGENT_SUPPRESSED`)
  — not required this phase.
- Editable graph topology ("graph-as-data") — Phase 28 / productization.
- A pending-trigger/activation queue — explicitly rejected in favor of
  block-with-explanation (D-12), consistent with Phase 24 D-02.

</deferred>

---

*Phase: 25-run-control*
*Context gathered: 2026-06-22*
