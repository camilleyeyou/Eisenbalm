# Phase 25: Run Control - Research

**Researched:** 2026-06-22
**Domain:** LangGraph runtime control (single-node re-roll, cooperative cancel), DB-driven scheduler tick, budget start-gate — on an existing FastAPI + LangGraph 1.1.10 pipeline with Convex config store
**Confidence:** HIGH (every genuine-unknown verified against installed code + current LangGraph time-travel docs; locked decisions D-01..D-12 accepted as constraints)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Cancel (RUN-04)**
- **D-01:** On cancel, set `runs`/`pipelineRuns` status to `cancelled`, stop cleanly, leave partial Sanity draft + Convex events untouched (no destructive cleanup; draft never reader-visible). Operator re-triggers a fresh run. `cancelled` is a new free-string value, no schema change.
- **D-02:** Cooperative, between-nodes. In-flight nodes finish normally (do NOT hard-kill the asyncio task or tear LLM calls mid-request). A cancel flag stops the graph advancing past the current step / fan-out join and prevents new nodes starting. `wrap_agent_node` checks the flag before running its node and no-ops cleanly if set. Safe for the concurrent 7-section fan-out.

**Re-roll (RUN-05)**
- **D-03:** Section writers only. Re-rollable set = 7 content nodes (`origin_story`, `problem`, `founder_bio`, `case_study`, `game`, `bonus`, `design`). `design` honors `DESIGNAGENT_SUPPRESSED` (it's conditional in `SECTION_WRITERS`).
- **D-04:** Only on a finished / `awaiting-review` run. No re-roll while a run is actively executing (avoids checkpoint races; mirrors Phase 24 D-02 block-with-explanation).
- **D-05:** Isolated regeneration. Re-run only the target node from the checkpoint, write its new output to Sanity, leave all sibling sections unchanged. QA/editor_final NOT auto-re-run.

**Budget (RUN-06)**
- **D-06:** Start gate = trailing-average projection. Estimate a run's cost as trailing average of recent real run costs; if month-to-date + projection > monthly cap, refuse to start with a clear dashboard warning. Real captured data, no manual constant.
- **D-07:** Mid-run breach — per-run cap hard-stops (preserve existing `CostCapExceeded` → run ends via cooperative-cancel path); monthly cap alerts only (don't kill a nearly-complete weekly issue). 70% soft-warn stays.
- **D-08:** Caps + thresholds live in `pipeline_config` (`per_run_cap_usd`, `monthly_cap_usd`, alert-threshold keys as JSON). Wire the existing per-run-cap path to read the DB value rather than only env.
- **D-09:** Alert boundary vs Phase 27 — emit event + dashboard surface, defer transport. Phase 25 writes the budget-threshold alert as a Convex event (extend existing `cost-warning`) and surfaces it in the dashboard. Phase 27 hooks Slack/email transport onto the same event.

**Scheduler (RUN-02/RUN-03)**
- **D-10:** DB cadence drives timing; Railway ticks frequently (e.g. hourly) POSTing `/pipeline/tick`. The tick checks `schedule_enabled` FIRST (no-op when off), then compares `now` against DB cadence/next-run and only fires when due. Operator controls cadence/pause/resume from dashboard with NO Railway redeploy.
- **D-11:** Next-run display = operator local timezone, with UTC alongside. Store cadence canonically (UTC) in `pipeline_config`.
- **D-12:** One run at a time — reject if a run is active. Both `POST /pipeline/run` (manual) and a due tick no-op / return 409 when a run is `running`. Block-with-explanation in UI.

### Claude's Discretion
- Exact endpoint shapes/names (`/pipeline/run` vs reusing `/run/weekly`; `/pipeline/tick`; `/runs/{id}/cancel`; re-roll route e.g. `POST /issues/{id}/agents/{key}/rerun` or `/runs/{id}/agents/{key}/rerun`) — **amend `docs/API_CONTRACTS.md` BEFORE coding (CLAUDE.md hard rule).**
- Cancel-flag mechanism (Convex flag the wrapper polls vs in-process event) and where it's read inside `wrap_agent_node`.
- LangGraph checkpoint re-roll mechanics (targeted start node via `thread_id = run_id`; how new output merges without disturbing siblings).
- Operator-identity (`triggered_by`) plumbing Clerk → trigger endpoint (reuse Phase 21–24 dashboard-auth + existing `X-Pipeline-Trigger-Secret`).
- Which run-control actions emit `audit_log` rows (reuse Phase 23 infra) — recommend trigger / cancel / re-roll / kill-switch-flip / cadence-change / cap-change at minimum.
- Trailing-average window size and cost-projection storage.
- Cadence representation in config (cron string vs structured day/time fields).
- All dashboard UI.

### Deferred Ideas (OUT OF SCOPE)
- Slack/email notification **transport** — Phase 27 (Phase 25 emits the Convex alert event + dashboard surface; D-09).
- Review gate (`awaiting_review` queue, rendered preview, approve/schedule/reject, factual-claims checklist) + charity registry / Scout dedup — Phase 26.
- Stripe reconciliation, `model_pricing` staleness — Phase 27.
- Re-rolling upstream nodes (scout/researcher/chronicler) or auto re-running QA/editor_final after a section re-roll.
- DB-driven per-agent enable/disable toggle (replacing `DESIGNAGENT_SUPPRESSED`).
- Editable graph topology — Phase 28.
- A pending-trigger/activation queue — rejected in favor of block-with-explanation (D-12).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUN-01 | Operator triggers a new issue run on demand from the dashboard | §Trigger — reuse `run_weekly` flow + Clerk auth + `triggerSource="manual"` + `triggeredBy`. Already 90% built in `api/runs.py::run_weekly`. |
| RUN-02 | Master `schedule_enabled` kill switch; scheduler tick checks it FIRST, no-ops when off | §Scheduler — new `pipeline_config.schedule_enabled` key already in `RunConfig`/`load_run_config` defaults; tick reads via `pipelineConfig:getAll`. |
| RUN-03 | Railway cron calls the tick on cadence; operator edits cadence/pause/resume + sees next run with timezone explicit | §Scheduler — `/pipeline/tick` handler, cadence in `pipeline_config`, next-run computation, store-UTC/show-local. |
| RUN-04 | Cancel an in-flight run; pipeline stops cooperatively; run ends `cancelled` | §Cooperative Cancel — flag read in `wrap_agent_node` before each node; reconciles with `CostCapExceeded` path. |
| RUN-05 | Re-roll a single agent/section within an existing issue without rerunning the whole pipeline | §Single-Node Re-roll — `aupdate_state(as_node=)` fork off `thread_id=run_id`, re-call `write_issue_draft` (createOrReplace from merged state). |
| RUN-06 | Per-run + monthly budget caps with alert thresholds; warn at threshold; refuse to start a run that would exceed cap | §Budget — start-gate projection in trigger path; per-run cap reads `pipeline_config`; monthly alert event extends `cost-warning`. |
</phase_requirements>

## Summary

Phase 25 is **extension, not greenfield**. Every substrate already exists: the strong-ref'd background-task trigger (`api/runs.py::run_weekly`), the universal node wrapper (`lib/agent_wrapper.py::wrap_agent_node`), the per-run cost hard-stop + 70% soft-warn (`lib/cost.py`), the generic `pipeline_config` key/value store (with `schedule_enabled`/`require_review`/`auto_publish` already plumbed into `RunConfig`), and an `AsyncPostgresSaver` checkpointer keyed by `thread_id = run_id`. The four genuine unknowns resolve to concrete mechanisms in the installed versions (**LangGraph 1.1.10**, `langgraph-checkpoint 4.1.0`, `langgraph-checkpoint-postgres 3.1.0`).

**The single most important finding (RUN-05):** `lib/sanity_client.py::write_issue_draft` writes the *entire* issue doc via `createOrReplace` on a deterministic `_id = f"issue-{issue_number}"`, composed from `DispatchState` fields. This makes isolated re-roll **clean and safe by construction**: fork the checkpoint with the regenerated node output using `await graph.aupdate_state(config, new_output, as_node="<key>")`, read the merged state via `aget_state`, and re-call `write_issue_draft(state)` — sibling sections are byte-unchanged because their state fields were untouched, and `createOrReplace` rewrites the whole doc from the merged state in one mutation. No per-section Sanity patch surgery is needed.

**Primary recommendation:** Add one new router (`api/control.py`) for `/pipeline/run`, `/pipeline/tick`, `/runs/{id}/cancel`, and the re-roll route; add a cooperative cancel flag as a **Convex `runs` field the wrapper polls** (survives the strong-ref'd background task, visible to the cancel endpoint and dashboard); read budget caps from `pipeline_config` in `lib/cost.py`; and amend `docs/API_CONTRACTS.md` with the new endpoint + flag + re-roll contracts **before** writing endpoint code (CLAUDE.md hard rule).

## Project Constraints (from CLAUDE.md)

- **Amend `docs/API_CONTRACTS.md` BEFORE writing endpoint code.** Hard rule. The new endpoints (`/pipeline/run`, `/pipeline/tick`, `/runs/{id}/cancel`, re-roll), the cancel-flag contract, the re-roll contract, and any `pipeline_config`/`DispatchState` additions must be documented first.
- **Do NOT modify frozen field shapes.** `pipelineRuns` (schema.ts lines 6–24, status union is `running|awaiting-review|complete|failed`) and `deliberationEvents.eventType` (closed union, public-site-consumed) MUST NOT change. *Caveat below: `cancelled` cannot be added to `pipelineRuns.status` — see Pitfall 1.*
- **Locked tech stack, no substitutions:** Next.js 14+ / Sanity v3 / FastAPI + LangGraph on Railway / Convex / Stripe / OpenRouter. Railway-cron scheduler is the locked decision (MISSION_CONTROL_BRIEF §8.4).
- **GSD workflow enforcement:** all edits through a GSD command.
- **`workspace_id: "eisenbalm"`** threaded through every new Convex row; control plane stays brand-agnostic.
- **Single cost writer (Phase 23):** `acomplete → record_cost` is the sole cost writer. All budget reads in this phase are READ-ONLY; never add a second `record_cost` call (Pitfall 3.1).
- **Snapshot-before-invoke (Phase 22 CFG-04):** `load_run_config` → `snapshot_config` are awaited BEFORE `asyncio.create_task`. Any new trigger entry point must preserve this ordering.

---

## Standard Stack

No new libraries. Everything is in the installed pipeline + Convex.

### Versions verified (from `packages/pipeline/uv.lock` + `pyproject.toml`)
| Package | Installed Version | Relevance |
|---------|-------------------|-----------|
| `langgraph` | **1.1.10** | `aupdate_state(as_node=)`, `aget_state`, `aget_state_history`, `ainvoke(None, config)` time-travel APIs are stable in 1.x |
| `langgraph-checkpoint` | 4.1.0 | Checkpoint base — `get_state_history` semantics |
| `langgraph-checkpoint-postgres` | 3.1.0 | `AsyncPostgresSaver` — re-roll reads/writes checkpoints by `thread_id` |
| `psycopg[binary]` | >=3.2,<4 | pool backing the checkpointer |
| `fastapi`, `httpx`, `pydantic 2.13.4` | (existing) | endpoints, Convex client, request models |

> **No `npm view`/`pip install` needed** — the versions are pinned in the lockfile and the phase adds no dependency. If the planner wants to confirm the LangGraph APIs are present at runtime: `cd packages/pipeline && uv run python -c "from langgraph.graph import StateGraph; import inspect; print([m for m in dir(StateGraph(dict).compile.__doc__ or '') ])"` is not reliable; prefer asserting against the compiled graph in a test (the graph instance exposes `aget_state`, `aupdate_state`, `aget_state_history`, `ainvoke`).

---

## Architecture Patterns

### Recommended file layout (additive)
```
packages/pipeline/src/eisenbalm_pipeline/
├── api/
│   ├── runs.py          # MODIFY: add triggered_by to run_weekly OR keep, add new router
│   └── control.py       # NEW: /pipeline/run, /pipeline/tick, /runs/{id}/cancel, re-roll
├── lib/
│   ├── agent_wrapper.py # MODIFY: cooperative cancel-flag check before fn()
│   ├── cost.py          # MODIFY: read per_run_cap_usd from pipeline_config; monthly alert
│   └── scheduler.py     # NEW (optional): cadence parse + next-run + is-due computation
convex/
├── runs.ts              # MODIFY: cancelRequested flag + cancelled transition + updateStatus
├── pipelineConfig.ts    # (reuse upsert/getAll) caps/cadence/kill-switch
└── auditLog.ts          # (reuse internalMutation write) run-control audit rows
apps/dispatch-control/app/(dashboard)/
├── runs/                # MODIFY: trigger button, cancel, re-roll UI
├── config/ or settings/ # MODIFY: kill-switch, schedule editor, budget caps
docs/API_CONTRACTS.md    # AMEND FIRST (CLAUDE.md hard rule)
```

### Pattern 1 — Single-Node Re-roll via Checkpoint Fork (RUN-05, the keystone unknown)

**Mechanism (LangGraph 1.1.10 time-travel, verified against current docs):**
`graph.aupdate_state(config, values, as_node="<node>")` applies `values` using `<node>`'s writers/reducers and records the checkpoint as if `<node>` produced them. Execution would resume from `<node>`'s **successors** if you then `ainvoke(None, fork_config)`. For an **isolated** re-roll we do NOT want to resume successors (that would re-run validate_sections → QA → editor_final → publisher). Instead we run the node ourselves and use `aupdate_state` only to persist the new output into the checkpoint, then re-write Sanity directly.

**Why this works without disturbing siblings:** the 7 section writers each write a *distinct* `DispatchState` field (`origin_story`, `problem_statement`, `founder_bio`, `case_study`, `game`, `bonus`, `theme`). `builder.py` comment line 73-78 confirms last-writer-wins-per-field with no `operator.add` reducer. Re-running one writer mutates only its own field. And `write_issue_draft` (`lib/sanity_client.py:162`) does `createOrReplace` on `issue-{n}` from the **whole** state — so re-writing after a single-field update preserves every sibling section verbatim.

**Recommended re-roll handler (concrete):**
```python
# api/control.py  (route name is Claude's discretion — recommend
# POST /runs/{run_id}/agents/{agent_key}/rerun for run-keyed symmetry)
from eisenbalm_pipeline.graph.builder import SECTION_WRITERS
from eisenbalm_pipeline.lib.sanity_client import write_issue_draft, get_client as sanity_client_get

RE_ROLLABLE = set(SECTION_WRITERS)  # honors DESIGNAGENT_SUPPRESSED automatically (D-03)

# Map agent_key -> unwrapped node fn. Import the bare fns (NOT the wrapped ones).
from eisenbalm_pipeline.agents.origin_story import origin_story
from eisenbalm_pipeline.agents.problem import problem
# ... import the other 5 bare fns ...
_BARE_NODE = {
    "origin_story": origin_story, "problem": problem, "founder_bio": founder_bio,
    "case_study": case_study, "game": game, "bonus": bonus, "design": design,
}

@router.post("/runs/{run_id}/agents/{agent_key}/rerun")
async def rerun_agent(request: Request, run_id: str, agent_key: str,
                      _: dict = Depends(require_clerk_jwt)):
    if agent_key not in RE_ROLLABLE:
        raise HTTPException(422, f"{agent_key} is not re-rollable (section writers only, D-03)")
    graph = _require_graph(request)

    # D-04 guard: refuse if the run is still actively executing.
    run_row = await convex_query(request.app.state.convex_http, "runs:byRunId", {"runId": run_id})
    if run_row is None:
        raise HTTPException(404, f"Run not found: {run_id}")
    if run_row.get("status") == "running":
        raise HTTPException(409, "Run is still executing — re-roll only on a finished/awaiting-review run (D-04)")

    config = {"configurable": {"thread_id": run_id}}
    snapshot = await graph.aget_state(config)
    if not snapshot or not snapshot.values:
        raise HTTPException(409, f"No checkpoint state for run {run_id}")
    current_state = dict(snapshot.values)

    # Re-run ONLY the target node against the checkpoint state. Call the BARE fn
    # (no wrapper) so we don't emit a spurious agent_runs lifecycle for a re-roll,
    # OR call the wrapped fn if you WANT agent_runs to reflect the re-roll — design choice.
    new_output = await _BARE_NODE[agent_key](current_state)   # returns {field: value}

    # Persist into the checkpoint, attributed to the node (D-05 isolation).
    await graph.aupdate_state(config, new_output, as_node=agent_key)

    # Merge + rewrite Sanity. write_issue_draft createOrReplace's the whole doc
    # from merged state — siblings untouched because their fields are unchanged.
    merged = {**current_state, **new_output}
    await write_issue_draft(sanity_client_get(), merged)
    return {"runId": run_id, "agentKey": agent_key, "rerolled": True}
```

**Failure modes:**
- *No checkpoint for run_id* → 409. Happens if the run failed before reaching the node, or the checkpoint was never written (degraded boot). Guard with the `snapshot.values` check.
- *`design` re-roll when suppressed* → `RE_ROLLABLE` derives from `SECTION_WRITERS` which already drops `design` under `DESIGNAGENT_SUPPRESSED`, so it 422s correctly.
- *Cost double-count* → the bare node calls `acomplete` which calls `record_cost(run_id, ...)`, ADDING to the run's accumulated cost. The run's in-memory cost store may have been cleared at pipeline end (`end_run` pops `_store[run_id]`). Re-roll cost is therefore a *fresh* accumulation under the same run_id — acceptable, but document that re-roll cost is tracked separately and surfaced to the dashboard, and DO NOT re-`begin_run` in a way that double-counts. (Recommend: call `begin_run(run_id)` is unnecessary; `record_cost` setdefaults the store.)

### Pattern 2 — Cooperative Cancel Flag (RUN-04, unknown #2)

**Decision: a Convex `runs` field the wrapper polls** (not an in-process `asyncio.Event`). Rationale:
- The cancel endpoint and the running graph are in the **same** process today, so an in-process Event would work — BUT a Convex flag also (a) survives a Railway restart cleanly (the dashboard can re-issue cancel after restart), (b) is visible to the dashboard for "cancellation requested" UI, (c) matches the existing `convex_mutation_safe`/`convex_query` plumbing already in `wrap_agent_node`, and (d) is the pattern `.planning/research/ARCHITECTURE.md` §4 already prescribes.
- Cost: one extra Convex `query` per node boundary (~14 nodes/run). Negligible.

**Where it's read — `wrap_agent_node`, BEFORE `fn(state)`:**
```python
# lib/agent_wrapper.py — inside wrapped(), after emitting "started" or before it.
# Recommend BEFORE emitting started, so a cancelled node never even shows "running".
async def wrapped(state: dict) -> dict:
    run_id = state["run_id"]
    ws = _resolve_workspace(state)

    # D-02 cooperative cancel: check the flag before doing any work.
    cancel = await convex_query_safe("runs:isCancelRequested", {"runId": run_id})
    if cancel:
        # No-op cleanly: do NOT emit started/completed, do NOT run fn.
        # Raise a dedicated exception the graph treats as a stop signal.
        raise RunCancelled(run_id)
    # ... existing started emit, fn(state), completed emit ...
```

**Landing the run in `cancelled` cleanly (reconcile with `CostCapExceeded`, D-07):**
- Define `RunCancelled(Exception)` in `lib/errors.py` (alongside `CostCapExceeded`).
- The graph propagates `RunCancelled` out of `wrap_agent_node` exactly like any node exception. The **existing** wrapper already emits `agentRuns:failed` and re-raises. That's fine for `agent_runs`, but the **run-level** terminal status must be `cancelled`, not `failed`. Two options:
  1. **Catch in `_execute_run`** (`api/runs.py:157`): wrap the `ainvoke` in `try/except RunCancelled`/`except CostCapExceeded` and write the run terminal status (`cancelled`) there — this is the cleanest single place. Today `_execute_run` swallows exceptions because the wrapper writes `failed`; change it to distinguish `RunCancelled`/`CostCapExceeded` and write `cancelled`.
  2. Have the cancel endpoint optimistically set `runs.status = cancelled` immediately (so the UI updates instantly), and `_execute_run` only confirms.
- **Concurrent 7-section fan-out:** with cooperative cancel, the nodes already running in the superstep **finish** (D-02 — do not tear them). The flag check prevents the *next* superstep (validate_sections, then QA…) from starting, and prevents any not-yet-started sibling in the current superstep from starting. LangGraph's superstep semantics: if any node in a superstep raises, the superstep fails atomically (ARCHITECTURE.md line 688). So a `RunCancelled` raised by one fan-out node aborts the whole superstep — which is the desired "stop advancing" behavior. The already-completed sibling outputs are left in the partial Sanity draft (D-01, never reader-visible).

**`CostCapExceeded` reconciliation (D-07):** the per-run cap already raises `CostCapExceeded` from `cost.py::check_cap` (called inside `acomplete`). That propagates out of the node identically to `RunCancelled`. In `_execute_run`, treat BOTH as terminal-cancel: write `runs.status = cancelled` (or keep `failed` for cost — the planner should pick; CONTEXT D-07 says the per-run cap "lands in `cancelled`/`failed`"). Recommend `cancelled` with an `errorMessage`/cancel-reason of `budget_cap_exceeded` for clarity.

### Pattern 3 — DB-Cadence Scheduler Tick (RUN-02/RUN-03, unknown #3)

**Railway cron expressions ARE NOT API-reconfigurable** — confirmed by the infra constraint in CONTEXT (lines 42-43) and `cli.py` docstring (the cron service runs a fixed schedule). Railway cron is configured in `railway.toml`/service settings at deploy time; changing it requires a redeploy. **This is why the locked design (D-10) is "tick frequently, decide timing in the DB."**

**`/pipeline/tick` handler shape:**
```python
@router.post("/pipeline/tick")
async def pipeline_tick(request: Request):
    _require_trigger_secret(request)          # Railway cron sets X-Pipeline-Trigger-Secret

    # 1) Kill switch FIRST (Pitfall 4.2 — must be the first real check).
    pc_rows = await convex_query(request.app.state.convex_http, "pipelineConfig:getAll",
                                 {"workspace_id": "eisenbalm"})
    pc = {r["key"]: json.loads(r["value"]) for r in pc_rows}
    if not pc.get("schedule_enabled", False):
        return {"status": "skipped", "reason": "schedule_disabled"}

    # 2) Due? compare now vs cadence/next-run (stored UTC).
    if not _is_due(pc, now=datetime.now(timezone.utc)):
        return {"status": "skipped", "reason": "not_due"}

    # 3) One-at-a-time (D-12): 409/no-op if a run is active.
    latest = await convex_query(request.app.state.convex_http, "runs:latest",
                                {"workspace_id": "eisenbalm"})
    if latest and latest.get("status") == "running":
        return {"status": "skipped", "reason": "run_in_progress"}

    # 4) Budget start-gate (RUN-06 / D-06) — refuse if projected over monthly cap.
    if _would_exceed_monthly_cap(pc, recent_run_costs):
        # emit budget alert event (D-09) + skip.
        return {"status": "skipped", "reason": "budget_projection_exceeds_cap"}

    # 5) Fire — reuse the SAME run-trigger logic as /pipeline/run with
    #    triggerSource="cron", then advance next-run cursor.
    run_id = await _start_run(request.app, trigger_source="cron")
    return {"status": "triggered", "runId": run_id}
```

**Cadence representation in `pipeline_config` (Claude's discretion → recommendation):**
Store **structured fields**, not a raw cron string, because the operator needs day+time editing and timezone display, and the tick needs simple "is it due" math:
```json
// pipeline_config key "schedule_cadence" value (JSON)
{ "dayOfWeek": 4, "hourUtc": 14, "minuteUtc": 0 }   // Thu 14:00 UTC (matches cli.py 0 14 * * 4)
// plus a separate key "schedule_next_run_at" value: 1750000000000  (Unix ms, UTC)
```
- **`_is_due`:** the simplest robust rule is "fire when `now >= schedule_next_run_at` AND no run started in the last cadence window." After firing, compute the next occurrence of `(dayOfWeek, hourUtc, minuteUtc)` strictly after `now` and write it back to `schedule_next_run_at`. This makes the tick idempotent against an hourly cron without firing twice (the cursor advances on fire).
- **Pause/resume** = `schedule_enabled` flag (D-10). Pausing does NOT clear `schedule_next_run_at`; resuming continues from the cursor (recompute if it's in the past).
- **Timezone (D-11):** store everything UTC. The dashboard renders `schedule_next_run_at` in the operator's local tz with UTC alongside: `"Next run: Thu Jun 26, 2:00 PM PDT (21:00 UTC)"`. Use the browser `Intl.DateTimeFormat` for local; the pipeline never needs local tz.

**Avoid the `cli.py::trigger_weekly` double-fire trap:** today `trigger_weekly` POSTs `/run/weekly` unconditionally. If a Railway cron is provisioned to run `trigger_weekly`, it would bypass the kill switch and cadence. **The new Railway cron must POST `/pipeline/tick`, NOT run `trigger_weekly`.** Recommend deprecating `trigger_weekly` (or repointing it at `/pipeline/tick`) so there's exactly one automated entry point that honors the kill switch (Pitfall 4.1/4.2).

### Pattern 4 — Budget Start-Gate Projection (RUN-06, unknown #4)

**Where MTD spend is summed from:** the authoritative per-run cost is `runs.cost` (JSON string, sourced from `pipelineRuns.cost` which is written by the single cost writer at pipeline end). Sum month-to-date by reading `runs:listForWorkspace` (already exists, sorted desc) and summing `JSON.parse(cost).total` for runs whose `startedAt` falls in the current calendar month. **Do this in a Convex query** (`runs:monthToDateCost` — new) so the start-gate is one round-trip and the math lives next to the data.

**Trailing-average projection (D-06):** take the last N completed runs (recommend **N=4**, ~last month of weekly issues; small enough to react to model/price changes, large enough to smooth a single anomalous run), average their `cost.total`. Projected next-run cost = that average. If `MTD + projection > monthly_cap_usd` → refuse.
- **First-run edge case:** if there are 0 completed runs, there's no trailing average. Recommend: allow the run (no projection data → don't block) but surface "no cost history yet" in the dashboard. Alternatively gate on `per_run_cap_usd` only.
- **Storage:** no new table needed. Compute on demand in the Convex query from existing `runs.cost`. (Avoids the `model_pricing`-drift pitfall 3.3 — we use *actual* captured costs, never `model_pricing × tokens`.)

**Per-run cap from `pipeline_config` (D-08):** `cost.py::check_cap` currently reads `os.environ["PIPELINE_COST_CAP_USD"]`. Change it to prefer the `pipeline_config` `per_run_cap_usd` value, falling back to env then the `10.0` default. **Critical:** `check_cap` runs inside `acomplete` (hot path) and is sync-ish; reading Convex on every LLM call is too chatty. **Solution:** thread the cap through `RunConfig`/`DispatchState` at run start (it's already loaded once via `load_run_config`). Add `per_run_cap_usd` / `monthly_cap_usd` to the `RunConfig` dataclass (like `schedule_enabled` already is), snapshot it, and have `check_cap` read from the in-memory run config / a module-level per-run cap set at `begin_run`. This respects the Phase 22 "read config once at run start" rule and the snapshot-before-invoke contract.

**Monthly cap = alert only (D-07):** the monthly cap never raises `CostCapExceeded`. Instead, when MTD crosses an alert threshold (e.g. 80% / 100% of `monthly_cap_usd`), emit a `deliberationEvents` `cost-warning` event (extend the existing one — already a valid eventType, schema.ts line 39) with a payload distinguishing `scope: "monthly"` from the existing per-run 70% warn. The dashboard surfaces it (D-09); Phase 27 adds Slack/email transport onto the same event.

### Anti-Patterns to Avoid
- **Adding `cancelled` to `pipelineRuns.status`** — that union is FROZEN (`running|awaiting-review|complete|failed`) and public-site-consumed. See Pitfall 1 for the correct split.
- **Extending `deliberationEvents.eventType`** for a new alert — reuse `cost-warning` with a discriminating payload (D-09). The union is a closed public contract.
- **`task.cancel()` for cancel** — D-02 forbids hard-killing the asyncio task / tearing LLM calls. Cooperative flag only.
- **Running `trigger_weekly` from the new Railway cron** — bypasses kill switch + cadence. Point the cron at `/pipeline/tick`.
- **Reading budget caps from Convex inside `acomplete`/`check_cap`** — chatty hot-path. Snapshot caps into `RunConfig` at run start.
- **Re-deriving historical cost from `model_pricing`** — use actual `runs.cost`. `model_pricing` is Phase 27, projection-only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Re-execute one node from saved state | Custom checkpoint deserializer / manual blob reads | `graph.aget_state(config)` + `graph.aupdate_state(config, out, as_node=key)` | LangGraph 1.1.10 native; handles reducers + checkpoint forking correctly |
| Rewrite one Sanity section, preserve siblings | Per-field Sanity `patch` mutation surgery | Re-call `write_issue_draft(merged_state)` (`createOrReplace`) | The whole doc is composed from state; unchanged fields stay byte-identical; one mutation |
| Cancel an in-flight asyncio graph | `task.cancel()` + `CancelledError` handling | Cooperative Convex flag polled in `wrap_agent_node` | D-02; clean, restart-safe, dashboard-visible; no torn LLM calls |
| Run-at-a-time enforcement | A queue/lock table | Read `runs:latest`; 409 if `running` | D-12; brief's single-issue-at-a-time design; no queuing anti-feature |
| Schedule cron reconfiguration | Railway API cron edits | Frequent tick + DB cadence cursor | Railway cron is not API-reconfigurable; D-10 |
| Per-run / monthly cost rollup | New cost recorder | Sum existing `runs.cost` in a Convex query | Single-cost-writer rule (Phase 23); no double-count |
| Operator identity on trigger | New auth | Reuse `require_clerk_jwt` (`api/auth.py`) → `claims["sub"]` → `triggeredBy` | Phase 21–24 pattern; `runs.triggeredBy` field already exists |
| Audit rows | New audit infra | `auditLog.ts::write` internalMutation (Phase 23) | Already built; just call it from the new mutations |

**Key insight:** The phase is wiring, not invention. The riskiest-looking requirement (RUN-05 isolated re-roll) is actually the *safest* because `write_issue_draft` is already a whole-doc createOrReplace from state.

---

## Runtime State Inventory

> Phase 25 is code/config (new endpoints, flag reads, config keys). It does NOT rename or migrate stored data. But it DOES introduce new runtime state and a NEW external registration. Categories answered explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New `pipeline_config` keys (`schedule_enabled` already defaulted in `RunConfig`; ADD `per_run_cap_usd`, `monthly_cap_usd`, alert thresholds, `schedule_cadence`, `schedule_next_run_at`). New `runs` field for the cancel flag (`cancelRequested: bool`) + a `cancelled` status value. **No field renames; all additive.** LangGraph checkpoint rows (`checkpoints`/`checkpoint_blobs`/`checkpoint_writes` in Railway Postgres) gain a new fork when re-roll calls `aupdate_state` — expected and managed by the checkpointer. | Convex `upsert` seeds for the new config keys (idempotent, like Phase 22 seeds); schema additions to `runs` (status free-string + new `cancelRequested` field — additive). |
| Live service config | **NEW Railway cron service** must be provisioned to POST `/pipeline/tick` hourly with `X-Pipeline-Trigger-Secret` — this lives in Railway service settings (NOT in git), and the cron expression is fixed at provision time (Andrew infra step, like Phase 4 Railway / Phase 22 deploy-key checkpoints). The existing `cli.py::trigger_weekly` cron (if ever provisioned) must NOT be the entry point — repoint or deprecate. | Andrew provisions the Railway cron → `/pipeline/tick`. Document in the plan as a human infra checkpoint. |
| OS-registered state | None — no Task Scheduler / launchd / systemd / pm2. Scheduling is the Railway cron service above. | None. |
| Secrets/env vars | `PIPELINE_TRIGGER_SECRET` (existing) reused by `/pipeline/tick`. `PIPELINE_COST_CAP_USD` / `PIPELINE_COST_WARN_PCT` (existing env) remain as fallback; the DB `pipeline_config` cap takes precedence (D-08). Clerk env (`CLERK_JWT_ISSUER_DOMAIN`) already wired (Phase 21–24). **No new secret values; no key renames.** | None beyond ensuring the Railway cron service has `PIPELINE_TRIGGER_SECRET` set. |
| Build artifacts / installed packages | None — no new dependency, no package rename, no egg-info churn. | None. |

**Canonical question — after every file is updated, what runtime systems still have old state?** Only the Railway cron service is a genuinely NEW external registration. Nothing existing is renamed or invalidated.

---

## Common Pitfalls

### Pitfall 1: `cancelled` cannot be added to `pipelineRuns.status` (frozen union)
**What goes wrong:** D-01 says "set `runs`/`pipelineRuns` status to `cancelled`." But `pipelineRuns.status` is a **closed `v.union` of `running|awaiting-review|complete|failed`** (schema.ts:9-14) AND CLAUDE.md forbids changing frozen `pipelineRuns` shapes (public-site-consumed). Adding a 5th literal IS a schema change to a frozen table.
**Resolution (recommend):** `runs.status` is a **free `v.string()`** (schema.ts:226) → add `cancelled` there freely. For `pipelineRuns`, set status to `failed` with an `errorMessage` like `"cancelled by operator"` (preserves the frozen union) OR — if the planner wants `cancelled` semantics in `pipelineRuns` too — that requires a CLAUDE.md-sanctioned exception to extend the union, which contradicts the freeze. **Cleanest:** `runs.status = "cancelled"` (the dashboard-facing record, D-01's primary target), `pipelineRuns.status = "failed"` + `errorMessage`. Document this split in the plan and API_CONTRACTS amendment. The public site only reads `pipelineRuns`; it never needs to know "cancelled" vs "failed."
**Warning sign:** a plan task that edits the `pipelineRuns.status` union literal list.

### Pitfall 2: Re-roll resumes successors and re-runs the whole tail
**What goes wrong:** `aupdate_state(..., as_node=key)` sets up the checkpoint so `ainvoke(None, config)` would resume from the node's **successors** (validate_sections → QA → editor_final → publisher). If the handler calls `ainvoke(None, config)` after the update, it re-runs the entire downstream tail — violating D-05 isolation (and re-running QA, which D-05 explicitly forbids automatically).
**How to avoid:** do NOT `ainvoke` after the re-roll. Run the bare node fn yourself, `aupdate_state` only to persist, then re-write Sanity directly (Pattern 1). The `aupdate_state` here is for checkpoint consistency (so a future inspection/re-roll sees the new value), not to drive execution.

### Pitfall 3: Cost double-counting (carried forward from Phase 23, Pitfall 3.1)
**What goes wrong:** any new budget instrumentation that calls `record_cost` a second time doubles every figure; budget caps fire at half threshold; the "100% to charity" transparency erodes.
**How to avoid:** all Phase 25 budget code is READ-ONLY (`get_cost_payload`, sum `runs.cost`). The sole writer stays `acomplete → record_cost`. Re-roll's bare node calls `acomplete` normally (correct — that LLM call genuinely costs money), but the start-gate/MTD math never writes cost.
**Warning sign:** a new `record_cost(` call site outside `openrouter_client.acomplete`.

### Pitfall 4: Tick fires before checking the kill switch (Pitfall 4.2)
**What goes wrong:** if `/pipeline/tick` starts work before reading `schedule_enabled`, flipping the switch off doesn't stop a run; or if tick just wraps `/run/weekly` (which only checks the trigger secret), the kill switch has no effect on cron runs.
**How to avoid:** `schedule_enabled` read is the FIRST real operation; return `{"status":"skipped"}` in <100ms when false. `/pipeline/tick` must NOT delegate to `/run/weekly` — it calls the internal `_start_run` logic only after all gates pass. Test asserts no run is created when the flag is off.

### Pitfall 5: Cancel flag check placed after `fn(state)` (no-op effect)
**What goes wrong:** if the flag check is after the node runs, the node still executes (and pays for its LLM call) before the graph notices cancellation — defeating "stop advancing."
**How to avoid:** check the flag at the TOP of `wrapped()`, before emitting `started` and before `fn(state)`. In-flight nodes (already past the check) finish (D-02); not-yet-started nodes no-op.

### Pitfall 6: Hourly tick double-fires on a due window
**What goes wrong:** with an hourly cron and a "fire when now >= next_run" rule, every subsequent hourly tick in the same day also sees `now >= next_run` and fires again — 409'd by the one-at-a-time gate during the run, but firing again after the run completes (same day) is wrong.
**How to avoid:** advance `schedule_next_run_at` to the NEXT cadence occurrence (strictly future) atomically when the tick fires. Subsequent ticks see `now < next_run` → `not_due`.

### Pitfall 7: Re-roll race against a live run (D-04 violation)
**What goes wrong:** re-roll reads/forks the checkpoint while the background graph task is still writing checkpoints for the same `thread_id` → corrupted/ambiguous state.
**How to avoid:** the D-04 guard (`if run_row.status == "running": 409`) blocks re-roll on an active run. Re-roll only on `awaiting-review` / `complete` / `cancelled` runs.

---

## Code Examples

### Cancel endpoint (sets the flag, returns immediately)
```python
# api/control.py
@router.post("/runs/{run_id}/cancel")
async def cancel_run(request: Request, run_id: str, _: dict = Depends(require_clerk_jwt)):
    run_row = await convex_query(request.app.state.convex_http, "runs:byRunId", {"runId": run_id})
    if run_row is None:
        raise HTTPException(404, f"Run not found: {run_id}")
    if run_row.get("status") != "running":
        # Idempotent: cancelling a finished run is a no-op (Pitfall 3.x idempotency).
        return {"runId": run_id, "status": run_row.get("status"), "alreadyTerminal": True}
    # Set the cooperative flag the wrapper polls (D-02). Optionally optimistic-set status.
    await convex_mutation(request.app.state.convex_http, "runs:requestCancel", {"runId": run_id})
    # audit (Claude's discretion — recommended)
    return {"runId": run_id, "cancelRequested": True}
```

### Convex: cancel flag + cancelled transition (additive to `runs.ts`)
```ts
// convex/runs.ts — add (runs.status is a free string; cancelRequested is a new optional field)
export const requestCancel = mutation({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.query('runs').withIndex('by_runId', q => q.eq('runId', runId)).first()
    if (!run) throw new Error(`Run not found: ${runId}`)
    await ctx.db.patch(run._id, { cancelRequested: true })
  },
})
export const isCancelRequested = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.query('runs').withIndex('by_runId', q => q.eq('runId', runId)).first()
    return Boolean(run?.cancelRequested)
  },
})
// runs:updateStatus (new or extend) to write 'cancelled' on the runs row from _execute_run.
```
> Requires adding `cancelRequested: v.optional(v.boolean())` to the `runs` table in `schema.ts` (additive, no migration of existing rows).

### Trigger with operator identity (RUN-01)
```python
# api/control.py — reuse run_weekly's body of work; add triggeredBy from Clerk.
@router.post("/pipeline/run")
async def pipeline_run(request: Request, body: RunWeeklyBody, claims: dict = Depends(require_clerk_jwt)):
    # one-at-a-time gate (D-12)
    latest = await convex_query(request.app.state.convex_http, "runs:latest", {"workspace_id": "eisenbalm"})
    if latest and latest.get("status") == "running":
        raise HTTPException(409, "A run is already in progress")
    # budget start-gate (D-06)
    if await _would_exceed_monthly_cap(request.app.state.convex_http):
        raise HTTPException(409, "Projected cost would exceed the monthly cap")
    return await _start_run(request.app, body, trigger_source="manual", triggered_by=claims.get("sub"))
```
> `_start_run` factors out the existing `run_weekly` body (resolve issue number → `new_run_id` → `begin_run` → `pipelineRuns:create` → `runs:create` with `triggerSource`/`triggeredBy` → `agentRuns:queueForRun` → `load_run_config` → `snapshot_config` → `asyncio.create_task`). Preserve the snapshot-before-create_task ordering (CFG-04).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LangGraph `update_state` rollback assumption | `aupdate_state` **forks** (creates a new checkpoint branch; original history intact) and resumes from successors | LangGraph 1.x | Re-roll must NOT `ainvoke(None)` if it wants isolation; persist-only |
| `as_node` always inferred | Explicit `as_node=` needed for **parallel branches** (our fan-out) and "skip nodes" | current docs | Re-roll MUST pass `as_node=agent_key` because the 7 writers are a parallel superstep (ambiguous last-updater) |
| Cron-driven exact timing | DB-cadence + frequent tick (Railway cron not API-reconfigurable) | this phase (D-10) | Operator controls schedule from data, no redeploy |

**Deprecated/outdated for this phase:**
- `cli.py::trigger_weekly` as an automation entry point — superseded by `/pipeline/tick` (kill-switch-gated). Keep the CLI for manual one-shot triggers if useful, but it must not be the cron target.

---

## Open Questions

1. **`cancelled` in `pipelineRuns.status`?**
   - What we know: `pipelineRuns.status` is a frozen public-contract union; `runs.status` is free.
   - What's unclear: whether the planner wants the public-site-facing `pipelineRuns` to also reflect `cancelled` (it currently can't without breaking the freeze).
   - Recommendation: `runs.status = "cancelled"`, `pipelineRuns.status = "failed"` + `errorMessage = "cancelled by operator"`. Document in API_CONTRACTS. Re-confirm with the user if `pipelineRuns` truly must show `cancelled`.

2. **Re-roll cost attribution.**
   - What we know: a re-roll calls `acomplete` under the same `run_id`; `end_run` may have cleared the in-memory store at original pipeline end.
   - What's unclear: whether re-roll cost should append to the run's recorded cost or be tracked as a separate "re-roll cost" line.
   - Recommendation: surface re-roll cost in the dashboard as an additive line on the run; do not silently overwrite the original `runs.cost`. Decide storage during planning (a `runs.rerollCost` field, or a `deliberationEvents`/`agent_runs` row).

3. **Trailing-average window N and zero-history behavior.**
   - Recommendation: N=4 completed runs; if 0 history, allow the run (gate on per-run cap only) and label "no cost history." Confirm during planning.

4. **Re-roll route name + whether it emits `agent_runs`.**
   - Recommendation: `POST /runs/{run_id}/agents/{agent_key}/rerun` (run-keyed, symmetric with cancel). Call the BARE node fn so a re-roll doesn't clutter the original run's `agent_runs` lifecycle — OR emit a dedicated re-roll marker. Amend API_CONTRACTS with the chosen shape before coding.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `langgraph` time-travel APIs (`aget_state`, `aupdate_state`, `aget_state_history`) | RUN-05 re-roll | ✓ | 1.1.10 | — |
| `AsyncPostgresSaver` checkpointer | RUN-05 (reads checkpoint by `thread_id`) | ✓ | langgraph-checkpoint-postgres 3.1.0 | — (degraded boot → `app.state.graph = None` → 503; re-roll surfaces 503) |
| Railway Postgres (checkpoint store) | RUN-05 | ✓ (provisioned; `SUPABASE_POSTGRES_URL` misnomer → Railway) | — | — |
| Convex (`pipeline_config`, `runs`, `auditLog`) | RUN-01/02/03/04/06 | ✓ (deployed: modest-magpie-797) | — | `load_run_config` two-tier disk fallback for prompts; budget/kill-switch reads have no fallback by design (fail-closed) |
| Clerk JWT verify (`require_clerk_jwt`) | RUN-01 operator identity | ✓ | (Phase 21–24) | dev-mode sentinel `{"sub":"local-dev-operator"}` when `CLERK_JWT_ISSUER_DOMAIN` unset |
| Railway cron service → `/pipeline/tick` | RUN-02/03 automation | ✗ **NOT provisioned** | — | Manual `/pipeline/run` trigger works without it; automation requires Andrew to provision (infra checkpoint) |

**Missing dependencies with no fallback:**
- Railway cron service (→ `/pipeline/tick`) is not provisioned. **Automation (RUN-02/03) cannot run until Andrew provisions it.** Manual trigger (RUN-01), cancel (RUN-04), re-roll (RUN-05), and budget gates (RUN-06) all work without the cron. Treat cron provisioning as an explicit human infra step in the plan (like Phase 4/22 deploy-key checkpoints), not a code task.

**Missing dependencies with fallback:**
- Convex degraded → kill switch / budget reads are intentionally fail-closed (a tick that can't read `schedule_enabled` should no-op, not fire). Document this as desired behavior.

---

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json` → section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework (pipeline) | pytest, `uv run pytest` (async via the existing `conftest.py`; `EISENBALM_STUB_MODE` short-circuits LLM/network) |
| Framework (dashboard) | Vitest (`pnpm --filter dispatch-control test:unit`) |
| Framework (convex) | function tests via the existing Convex test harness / dashboard integration |
| Config files | `packages/pipeline/tests/conftest.py` (exists), no pytest.ini change needed |
| Quick run command | `cd packages/pipeline && uv run pytest tests/test_control.py -x -q` |
| Full suite command | `cd packages/pipeline && uv run pytest -x -q` (≥200 baseline per MEL-05) + `pnpm --filter dispatch-control test:unit` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| RUN-01 | manual trigger creates `runs` row with `triggerSource="manual"` + `triggeredBy` | integration (stub) | `uv run pytest tests/test_control.py::test_manual_trigger_records_operator -x` | ❌ Wave 0 |
| RUN-02 | tick with `schedule_enabled=false` creates NO run, returns `skipped` | integration (stub) | `uv run pytest tests/test_control.py::test_tick_kill_switch_noop -x` | ❌ Wave 0 |
| RUN-03 | tick fires only when due; advances `schedule_next_run_at`; not-due → skipped | unit + integration | `uv run pytest tests/test_scheduler.py -x` | ❌ Wave 0 |
| RUN-03 | next-run shown in local tz + UTC | dashboard unit | `pnpm --filter dispatch-control test:unit` (date-format test) | ❌ Wave 0 |
| RUN-04 | cancel sets flag; `wrap_agent_node` no-ops next node; run lands `cancelled` (runs) | integration (stub) | `uv run pytest tests/test_cancel.py::test_cancel_lands_cancelled -x` | ❌ Wave 0 |
| RUN-04 | in-flight node finishes; siblings in superstep not torn (cooperative) | unit | `uv run pytest tests/test_cancel.py::test_cooperative_not_violent -x` | ❌ Wave 0 |
| RUN-05 | re-roll one writer; sibling section fields byte-unchanged in the re-written doc | integration (stub) | `uv run pytest tests/test_reroll.py::test_reroll_leaves_siblings_unchanged -x` | ❌ Wave 0 |
| RUN-05 | re-roll on a `running` run → 409 (D-04) | integration | `uv run pytest tests/test_reroll.py::test_reroll_blocked_while_running -x` | ❌ Wave 0 |
| RUN-05 | non-section-writer key → 422 | unit | `uv run pytest tests/test_reroll.py::test_reroll_rejects_non_section -x` | ❌ Wave 0 |
| RUN-06 | start-gate refuses run when MTD + trailing-avg > monthly cap | integration | `uv run pytest tests/test_budget_gate.py::test_start_gate_refuses_over_budget -x` | ❌ Wave 0 |
| RUN-06 | per-run cap read from `pipeline_config` (DB) overrides env | unit | `uv run pytest tests/test_budget_gate.py::test_per_run_cap_from_db -x` | ❌ Wave 0 |
| RUN-06 | monthly threshold crossing emits `cost-warning` event (scope=monthly), does NOT cancel | integration | `uv run pytest tests/test_budget_gate.py::test_monthly_alert_no_cancel -x` | ❌ Wave 0 |
| (regression) | no second `record_cost` writer (Pitfall 3) | unit | `uv run pytest tests/test_cost_double_count.py -x` (EXISTS — must stay green) | ✅ |

**Key acceptance assertions (the explicit bars from CONTEXT):**
- *Cancel lands in `cancelled`:* after `runs:requestCancel`, drive the graph one node and assert the next node never emits `agentRuns:started`, and `_execute_run` writes `runs.status == "cancelled"`.
- *Re-roll leaves siblings unchanged:* capture the Sanity `createOrReplace` doc before and after re-rolling `origin_story`; assert every key except `originStory` is byte-identical, and `originStory` differs.
- *Kill switch no-ops the tick:* set `schedule_enabled=false`, POST `/pipeline/tick`, assert zero `runs:create`/`pipelineRuns:create` calls and `{"status":"skipped","reason":"schedule_disabled"}`.
- *Start-gate refuses over-budget:* seed `runs.cost` history + a low `monthly_cap_usd`, assert `/pipeline/run` returns 409 and no run is created.

### Sampling Rate
- **Per task commit:** `cd packages/pipeline && uv run pytest tests/test_control.py tests/test_cancel.py tests/test_reroll.py tests/test_budget_gate.py tests/test_scheduler.py -x -q`
- **Per wave merge:** full pipeline suite `uv run pytest -x -q` + `pnpm --filter dispatch-control test:unit`
- **Phase gate:** both suites green + the existing tripwires (`test_cost_double_count.py`, `test_agent_wrapper.py`, `test_builder_wiring.py`) stay green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/test_control.py` — covers RUN-01 trigger + RUN-02 tick kill-switch + RUN-03 due-logic integration
- [ ] `tests/test_cancel.py` — covers RUN-04 cooperative cancel + cancelled landing
- [ ] `tests/test_reroll.py` — covers RUN-05 isolation + D-04 guard + non-section 422
- [ ] `tests/test_budget_gate.py` — covers RUN-06 start-gate + DB cap + monthly alert
- [ ] `tests/test_scheduler.py` — covers `_is_due` / next-run cursor advance (Pitfall 6)
- [ ] `apps/dispatch-control/__tests__/` — next-run tz display + kill-switch toggle + re-roll/cancel button states
- [ ] Shared fixtures: extend `conftest.py` with a `runs`/`pipeline_config` Convex stub fixture (mirror existing `agentRuns`/`convex_mutation_safe` patches in `test_test_run.py`/`test_agent_wrapper.py`)

---

## Sources

### Primary (HIGH confidence)
- **Installed code** (read directly): `api/runs.py`, `lib/agent_wrapper.py`, `lib/cost.py`, `lib/config_loader.py`, `graph/builder.py`, `graph/checkpointer.py`, `cli.py`, `api/agents.py` (test-run analog), `api/main.py`, `lib/sanity_client.py::write_issue_draft`, `convex/schema.ts`, `convex/runs.ts`, `convex/pipelineConfig.ts`, `convex/auditLog.ts` — ground truth for every integration seam.
- **`packages/pipeline/uv.lock` + `pyproject.toml`** — verified `langgraph==1.1.10`, `langgraph-checkpoint==4.1.0`, `langgraph-checkpoint-postgres==3.1.0`.
- **LangGraph time-travel docs** — `aupdate_state(as_node=)` / `aget_state_history` / `ainvoke(None, config)` semantics, fork-not-rollback, `as_node` required for parallel branches: https://docs.langchain.com/oss/python/langgraph/use-time-travel
- `25-CONTEXT.md` (D-01..D-12 locked decisions), `REQUIREMENTS.md` (RUN-01..06), `docs/MISSION_CONTROL_BRIEF.md` §3B/§3C/§5/§8.4.
- `.planning/research/ARCHITECTURE.md` (§3 wrapper cancel pattern, §4 endpoint map, config-once-at-run-start), `.planning/research/PITFALLS.md` (Cat 3 cost, Cat 4 kill-switch/cancel).

### Secondary (MEDIUM confidence)
- LangGraph time-travel community write-ups (corroborate `as_node` + fork semantics): https://dev.to/sreeni5018/debugging-non-deterministic-llm-agents-implementing-checkpoint-based-state-replay-with-langgraph-5171 ; https://fast.io/resources/langgraph-persistence/
- Railway cron model (separate cron service, fixed expression): https://docs.railway.app/guides/cron-jobs

---

## Metadata

**Confidence breakdown:**
- Re-roll mechanics (RUN-05): HIGH — verified API against installed LangGraph 1.1.10 + confirmed `write_issue_draft` createOrReplace-from-state makes isolation structural.
- Cooperative cancel (RUN-04): HIGH — wrapper insertion point + Convex flag pattern both grounded in existing code (`convex_mutation_safe` already used in `agent_wrapper.py`); reconciliation with `CostCapExceeded` traced through `cost.py`.
- Scheduler tick (RUN-02/03): HIGH on design (D-10 locked, kill-switch-first is the existing-research consensus); MEDIUM on cadence-storage choice (Claude's discretion — recommended structured fields).
- Budget start-gate (RUN-06): HIGH — uses existing actual-cost path; single-cost-writer rule honored; `cost.py::check_cap` is the documented extension point.
- The `cancelled`-vs-frozen-`pipelineRuns` split (Pitfall 1): HIGH — schema.ts confirms the union is closed; flagged as an Open Question for the planner.

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (stable — pinned LangGraph version, no fast-moving deps; re-verify only if `langgraph` is bumped)
