# Architecture Research

**Domain:** Multi-agent LangGraph pipeline with human-in-the-loop gates, three-datastore content/observability/state split, webhook-triggered finalization, monorepo across TypeScript and Python
**Researched:** 2026-05-09 (v1) · updated 2026-06-21 (v2.0 Mission Control integration)
**Confidence:** HIGH (LangGraph patterns verified against official docs; Sanity webhook patterns verified against Sanity official docs; monorepo patterns from Turborepo official docs)

---

## v2.0 Mission Control Integration Architecture

> This section was added for milestone v2.0. It covers how the new `dispatch-control` dashboard integrates with the existing system without breaking any v1 contracts. The v1 architecture sections below remain authoritative for the existing pipeline; only additive changes are described here.

---

### Integration Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     BROWSER / READER (public)                            │
│  apps/web (Next.js / Vercel) ── Sanity GROQ reads (CDN) ──────────────┐ │
│  React components ─────────── Convex useQuery subscriptions (live) ─┐ │ │
└─────────────────────────────────────────────────────────────────────┼─┼─┘
                                                                      │ │
┌─────────────────────────────────────────────────────────────────────┼─┼─┐
│              BROWSER / OPERATOR (private — Andrew only)              │ │ │
│  apps/dispatch-control (Next.js / Vercel — auth-gated)               │ │ │
│  ┌─────────────────────────────────────────────────────────────────┐ │ │ │
│  │  Pipeline graph view · Run history · Live run view              │ │ │ │
│  │  Prompt editor · Cost roll-ups · Kill switch · Review gate      │ │ │ │
│  └──────────────────┬──────────────────────────────────────────────┘ │ │ │
│                     │ Convex mutations (config writes)                │ │ │
│                     │ Convex queries (run state, live events)         │ │ │
│                     │ FastAPI REST (trigger, cancel, test-run) ───────┼─┼─┼──►
└─────────────────────┼──────────────────────────────────────────────┼─┼─┘  │
                      │                                               │ │    │
┌─────────────────────┼───────────────────────────────────────────────┼─┼──-┼─┐
│                     CONVEX (cloud — modest-magpie-797)               │ │   │ │
│  ── EXISTING (v1, unchanged) ─────────────────────────────────────── │ │   │ │
│  pipelineRuns · deliberationEvents · agentVotes                      │ │   │ │
│  qaCorrections · pitchLog                         ◄──────────────────┘ │   │ │
│  ── NEW (v2, additive) ──────────────────────────────────────────────── │   │ │
│  agents · prompt_versions · pipeline_config (kill switch lives here)   │   │ │
│  runs (mirrors pipelineRuns + adds config_snapshot)                    │   │ │
│  agent_runs · charities (registry) · model_pricing                     │   │ │
│  review_actions · audit_log · workspaces (single row) · users          │   │ │
│  ◄────────────────────────────────────────────────────────────────── ──┘   │ │
└─────────────────────────────────────────────────────────────────────────────┼─┘
                                                                              │
┌─────────────────────────────────────────────────────────────────────────────┼─┐
│         FASTAPI + LANGGRAPH (Railway)                                        │ │
│                                                                              │ │
│  ── EXISTING (v1) ────────────────────────────────────────────────────────── │ │
│  POST /run/weekly ──► LangGraph (checkpointed on Railway Postgres)           │ │
│  POST /webhook/sanity-publish ◄── Sanity webhook (HMAC)                     │ │
│                                                                              │ │
│  ── NEW (v2) ─────────────────────────────────────────────────────────────── │ │
│  POST /pipeline/run    ← dashboard "run now" button ◄────────────────────────┘ │
│  POST /pipeline/tick   ← Railway cron (kill-switch-checked)                    │
│  POST /runs/{id}/cancel                                                        │
│  POST /agents/{key}/test-run                                                   │
│  POST /issues/{id}/agents/{key}/rerun                                          │
│  POST /issues/{id}/publish  ·  /schedule                                       │
│                                                                                │
│  lib/prompts.py::load_prompt()  ── MODIFIED: DB-backed + file fallback         │
│  graph/builder.py  ── reads config_snapshot from Convex at RUN START           │
│  LangGraph callback handler  ── new, emits agent_runs progress to Convex       │
└────────────────────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼───────────────────────────────────────────────────┐
│         RAILWAY POSTGRES (LangGraph checkpointer — unchanged)                  │
│  checkpoints · checkpoint_blobs · checkpoint_writes                            │
│  (also: idempotency_keys for webhook dedup)                                    │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## §2 Keystone — Config Externalization + Run Snapshot

This is the foundational change everything else depends on. Get this right before anything else.

### Where Config Lives: Convex

Config belongs in **Convex**, not Railway Postgres. Rationale:
- The dashboard (Next.js) writes config via Convex mutations — no separate API layer needed between the dashboard and the config store.
- The pipeline reads config via the existing `convex_client.py` HTTP API at run start — the same pattern already used for pipeline events.
- Convex's real-time subscriptions let the dashboard see config changes immediately.
- Railway Postgres is the LangGraph checkpointer — adding application data there mixes concerns and risks schema conflicts with LangGraph's `checkpoints`/`checkpoint_blobs` tables.

The `pipeline_config` Convex table holds the single live config row (one row per workspace). The `prompt_versions` table holds all prompt versions with `active: boolean` to mark which is live. At run start, the pipeline reads the live prompt for each agent and writes the entire config (prompts + model choices + temperatures) as a snapshot onto the run record.

### Config Snapshot Pattern

```python
# packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py  (NEW FILE)

async def load_run_config(workspace_id: str) -> RunConfig:
    """
    Called ONCE at run start. Reads active config from Convex.
    Returns a RunConfig with all prompt texts, model choices, temperatures.
    Falls back to file prompts if Convex is unreachable (fail-open on prompts,
    fail-closed on pipeline_config kill switch / require_review).
    """
    try:
        config_row = await convex_query("pipeline_config:getActive", {
            "workspace_id": workspace_id
        })
        agents_config = await convex_query("agents:listForWorkspace", {
            "workspace_id": workspace_id
        })
        # For each agent, fetch the active prompt version
        prompts = {}
        for agent in agents_config:
            version = await convex_query("prompt_versions:getActive", {
                "agent_key": agent["key"],
                "workspace_id": workspace_id
            })
            if version:
                prompts[agent["key"]] = version["content"]
            else:
                # File fallback: load_prompt() from importlib.resources
                prompts[agent["key"]] = load_prompt(agent["key"])

        return RunConfig(
            workspace_id=workspace_id,
            prompts=prompts,
            model_overrides={a["key"]: a["model"] for a in agents_config if a.get("model")},
            temperatures={a["key"]: a["temperature"] for a in agents_config if a.get("temperature")},
            require_review=config_row["require_review"],
            auto_publish=config_row["auto_publish"],
        )
    except ConvexUnreachableError:
        # Prompts: fall back to files (safe)
        # Kill switch + require_review: MUST NOT fall back — fail the run instead
        raise RuntimeError("Cannot load pipeline_config from Convex — aborting run")


async def snapshot_config(run_id: str, config: RunConfig) -> None:
    """
    Write the full RunConfig to Convex runs table as config_snapshot.
    Called immediately after load_run_config(), before graph.ainvoke().
    JSON-serializes the entire config so the run is reproducible.
    """
    await convex_mutation("runs:setConfigSnapshot", {
        "run_id": run_id,
        "config_snapshot": json.dumps(dataclasses.asdict(config)),
    })
```

### Prompt Loader Swap

The `load_prompt()` file loader in `lib/prompts.py` is called at eight agent call sites (see `CURRENT_STATE.md` Q1 table). The swap strategy is:

1. `load_run_config()` runs once at pipeline start and caches all prompts in `RunConfig`.
2. `RunConfig` is threaded through `DispatchState` as `config: Optional[RunConfig]` (new field, optional to preserve existing tests).
3. Each agent call site changes from `load_prompt("scout").replace(...)` to `state["config"].prompts["scout"].replace(...)`.
4. The standalone `load_prompt()` function stays in `lib/prompts.py` as the file fallback — referenced only by `config_loader.py::load_run_config()` when Convex is unreachable.

**Files modified at call sites (8 total):**
- `agents/scout.py:34, :192`
- `agents/calibrator.py:28, :109`
- `agents/editor.py:48, :194, :440`
- `agents/advocate.py:36, :67`
- `agents/researcher.py:30, :85`
- `agents/bonus.py:39, :130, :144, :159`
- `agents/game.py:21, :61`
- `agents/design/__init__.py:45, :99`

Also `agents/qa/rubric.md` — loaded via same mechanism; add `"qa-rubric"` as an agent key with its own prompt version row.

**Migration of 12 prompt files:** Seed script reads each `.md` file via `load_prompt()`, creates an `agents` row and a `prompt_versions` row (version 1, `active: true`) in Convex. This runs once during Phase 1 setup. The `.md` files stay in the repo as the canonical fallback.

---

## §5 Data Model — New vs Existing, Convex vs Postgres Placement

### Existing Convex Tables (DO NOT MODIFY SCHEMA OR FUNCTION SIGNATURES)

| Table | Functions | What it holds |
|-------|-----------|---------------|
| `pipelineRuns` | `create`, `updateStatus`, `byRunId` | One row per run — `runId`, `issueNumber`, `startedAt`, `status`, `cost` (JSON string), `durationMs` |
| `deliberationEvents` | `insert`, `byRunId`, `byRunIdAndType` | Real-time agent event stream — `scout-finding`, `advocate-argument`, etc. |
| `agentVotes` | `insert`, `byRunId`, `byRunIdAndCharity` | Per-charity per-agent votes |
| `qaCorrections` | `insert`, `byRunId` | QA correction records |
| `pitchLog` | `insert`, `markSelected`, `byRunId` | Scout charity candidates (live feed) |

**Contract invariant:** `deliberationEvents.eventType` union (`scout-finding` | `advocate-argument` | `editor-decision` | `section-draft` | `qa-correction` | `editor-final` | `publisher-deploy`) is consumed by the public site deliberation layer (Phase 9/13) and MUST NOT be extended. Add a new `agent_runs` table for dashboard-specific agent progress instead.

### New Convex Tables (v2, additive)

| Table | Key fields | Role | Why Convex (not Postgres) |
|-------|-----------|------|--------------------------|
| `workspaces` | `workspace_id`, `name` | Single-tenant anchor; workspace_id threads through every row | Dashboard writes it; pipeline reads it |
| `users` | `workspace_id`, `email`, `role` | Andrew's user record (and future operators) | Dashboard auth layer writes/reads |
| `agents` | `workspace_id`, `key` (e.g. "scout"), `display_name`, `model`, `temperature`, `max_tokens`, `enabled`, `description` | Per-agent config; dashboard edits | Dashboard reads/writes live |
| `prompt_versions` | `workspace_id`, `agent_key`, `version_num`, `content`, `active`, `authored_by`, `note`, `created_at` | Prompt history + active flag | Dashboard writes; pipeline reads at run start |
| `pipeline_config` | `workspace_id`, `schedule_enabled` (kill switch), `require_review`, `auto_publish`, `schedule_cron`, `schedule_tz`, `budget_monthly_cap`, `budget_run_cap` | Global pipeline settings | Dashboard writes; pipeline reads at run start AND on `/pipeline/tick` |
| `runs` | `workspace_id`, `run_id`, `trigger_source`, `triggered_by`, `config_snapshot` (JSON), `status`, `started_at`, `completed_at`, `cost`, `duration_ms` | Dashboard-facing run record; superset of `pipelineRuns` | Mirrors + extends `pipelineRuns`; dashboard subscribes to this |
| `agent_runs` | `workspace_id`, `run_id`, `agent_key`, `status` (queued/running/done/failed), `started_at`, `completed_at`, `tokens_in`, `tokens_out`, `cost_usd`, `input_snapshot` (JSON), `output_snapshot` (JSON), `error` | Per-agent execution record within a run | LangGraph callback handler writes this live |
| `model_pricing` | `workspace_id`, `model_id`, `input_per_1m`, `output_per_1m`, `effective_from` | Model price table for cost roll-ups; editable from dashboard | Dashboard edits |
| `charities` (registry) | `workspace_id`, `name`, `slug`, `status` (candidate/featured/blocklisted), `times_featured`, `last_featured_at`, `sanity_id`, `dedup_key` | Charity dedup + Scout blocklist | Pipeline reads at Scout time; dashboard manages |
| `review_actions` | `workspace_id`, `run_id`, `action` (approve/schedule/reject/reroll), `actor`, `note`, `created_at` | Review audit trail | Dashboard writes on approval/rejection |
| `audit_log` | `workspace_id`, `entity_type`, `entity_id`, `action`, `actor`, `before` (JSON), `after` (JSON), `created_at` | Every config change, approval, kill-switch flip | Dashboard writes on all mutations |

### What Stays in Railway Postgres

Railway Postgres (`SUPABASE_POSTGRES_URL`, despite the name) holds ONLY LangGraph checkpointer tables:
- `checkpoints`, `checkpoint_blobs`, `checkpoint_writes` — managed entirely by `AsyncPostgresSaver`, never written manually.
- `idempotency_keys` — already used by webhook dedup (`lib/idempotency.py`). This is acceptable to keep here since it is already implemented and is a low-stakes operational table, not application data.

**Do not add application tables to Railway Postgres.** The Convex placement gives the dashboard real-time subscriptions without a separate API layer.

### Runs Table: Augmenting vs Duplicating pipelineRuns

The new `runs` table in Convex is a dashboard-facing superset of `pipelineRuns`. It adds `config_snapshot`, `trigger_source`, `triggered_by`, and richer status. The `pipelineRuns` table stays unchanged (the public site's deliberation layer queries it by `runId`).

The pipeline writes to **both** at run start: `pipelineRuns:create` (existing, unchanged) and `runs:create` (new). Both use the same `run_id` as the join key. This creates one redundant write — acceptable since both are Convex mutations on the same connection.

**If pipelineRuns.status changes, runs.status must match.** The `pipelineRuns:updateStatus` mutation must also update `runs:updateStatus` atomically. Best achieved by having `pipelineRuns:updateStatus` call `runs:updateStatus` internally (Convex function calling another Convex function), or by updating both at each call site.

---

## §3 LangGraph Callback Handler — Live Cost + Progress Emission

### What Exists

`lib/openrouter_client.py::acomplete()` already calls `record_cost(run_id, agent_id, ...)` at lines `:221-224` (structured output path) and `:235-238` (plain string path). `lib/cost.py::record_cost` accumulates in-memory per `(run_id, agent_id)`. The final `cost_payload` is only persisted to Convex at pipeline end (`publisher/__init__.py:59-77`).

**Gap:** There is no per-agent live progress emission. The dashboard cannot show "Scout is running" or per-agent token accrual mid-run; it only sees the batch cost at the end.

### Injection Point: Node-Level Wrappers on graph/builder.py

The clean injection point is in `graph/builder.py` where nodes are added. Wrap each agent node function with a `@agent_node` decorator (or explicit pre/post calls) that:

1. Before the node runs: `convex_mutation("agent_runs:updateStatus", {run_id, agent_key, status: "running", started_at})`
2. After the node completes: `convex_mutation("agent_runs:updateStatus", {run_id, agent_key, status: "done", completed_at, tokens_in, tokens_out, cost_usd})`
3. On exception: `convex_mutation("agent_runs:updateStatus", {run_id, agent_key, status: "failed", error})`

```python
# packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py  (NEW FILE)

def wrap_agent_node(agent_key: str, fn: AgentNodeFn) -> AgentNodeFn:
    """
    Wraps a LangGraph node function to emit agent_runs progress to Convex.
    Costs are read from lib/cost.py::get_agent_cost(run_id, agent_key)
    immediately after fn() returns (acomplete already accumulated them).
    """
    async def wrapped(state: DispatchState) -> dict:
        run_id = state["run_id"]
        await convex_mutation_safe("agent_runs:started", {
            "run_id": run_id,
            "agent_key": agent_key,
            "started_at": int(time.time() * 1000),
        })
        try:
            result = await fn(state)
            agent_cost = get_agent_cost(run_id, agent_key)  # reads from cost.py in-memory
            await convex_mutation_safe("agent_runs:completed", {
                "run_id": run_id,
                "agent_key": agent_key,
                "completed_at": int(time.time() * 1000),
                "tokens_in": agent_cost.tokens_in,
                "tokens_out": agent_cost.tokens_out,
                "cost_usd": agent_cost.usd,
            })
            return result
        except Exception as e:
            await convex_mutation_safe("agent_runs:failed", {
                "run_id": run_id,
                "agent_key": agent_key,
                "error": str(e),
            })
            raise
    return wrapped
```

In `graph/builder.py`, replace:
```python
builder.add_node("scout", scout_node)
```
with:
```python
builder.add_node("scout", wrap_agent_node("scout", scout_node))
```

**Why not a LangGraph callback handler?** LangGraph's built-in callback system (BaseCallbackHandler) is designed for LangChain chains, not LangGraph nodes. Node-level wrappers are simpler, more explicit, and don't depend on LangGraph's internal callback dispatch. The wrapper pattern matches the existing `@agent_node` decorator convention already used in the codebase (`agents/chronicler.py`).

**Cost granularity:** `cost.py::get_agent_cost(run_id, agent_key)` returns the accumulated cost for that agent so far. After the node completes, this reflects all `acomplete()` calls made within that node. No change to `cost.py` — read the in-memory state after the node returns.

---

## §4 New FastAPI Endpoints

### Endpoint Map

| Endpoint | Auth | What it does | LangGraph interaction |
|----------|------|-------------|----------------------|
| `POST /pipeline/run` | Dashboard secret | Starts a weekly run (dashboard-triggered) | Same as `/run/weekly` but writes `trigger_source: "manual"` to `runs` table |
| `POST /pipeline/tick` | Railway cron secret | Checks `pipeline_config.schedule_enabled`; if true, triggers a run; if false, no-ops | Reads Convex `pipeline_config:getActive` first; only calls graph if enabled |
| `POST /runs/{id}/cancel` | Dashboard secret | Cancels an in-flight run | Sets a `cancellation_requested` flag in Convex `runs`; the running graph checks this flag at each node boundary and raises `CancellationError` |
| `POST /agents/{key}/test-run` | Dashboard secret | Runs a single agent against provided sample input | Calls the agent function directly (not via full graph); returns output + cost; no Sanity/Convex side effects |
| `POST /issues/{id}/agents/{key}/rerun` | Dashboard secret | Re-rolls a single agent within an existing issue | Loads state from LangGraph checkpoint; runs that agent node only; patches Sanity draft with new output |
| `POST /issues/{id}/publish` | Dashboard secret | Manually triggers the Publisher (bypasses Sanity webhook) | Calls `_run_publisher()` directly with issue_id from the URL |
| `POST /issues/{id}/schedule` | Dashboard secret | Sets `publish_at` on the Convex `runs` record; a separate scheduler checks this | No LangGraph interaction; pure Convex write |

### Cancel In-Flight: Cooperative Cancellation

LangGraph does not support external cancellation of a running node. The correct pattern is **cooperative cancellation** via a shared flag:

```python
# In every node wrapper (agent_wrapper.py):
async def wrapped(state: DispatchState) -> dict:
    run_id = state["run_id"]
    # Check cancellation flag before starting
    if await is_cancelled(run_id):
        raise CancellationError(f"Run {run_id} was cancelled")
    # ... rest of node ...
```

`is_cancelled(run_id)` queries Convex `runs:isCancelled` — a lightweight query that returns true if `status == "cancelled"`. `POST /runs/{id}/cancel` sets `runs.status = "cancelled"` in Convex. The next node boundary check sees it and raises. LangGraph propagates the exception, the run ends with `status: "failed"` (or a new `"cancelled"` status literal added to both `pipelineRuns` and `runs`).

**Limitation:** Cancellation takes effect at the next node boundary — it cannot interrupt a node that is mid-LLM-call. This is acceptable for the use case (killing a stuck run).

### Single-Agent Test-Run

```python
# packages/pipeline/src/eisenbalm_pipeline/api/control.py  (NEW FILE)

@router.post("/agents/{key}/test-run")
async def agent_test_run(key: str, body: AgentTestRunRequest, _=Depends(require_dashboard_secret)):
    """
    Runs a single agent against sample input. No Sanity/Convex side effects.
    Returns: {output: dict, cost: {tokens_in, tokens_out, usd}, latency_ms: int}
    """
    agent_fn = AGENT_REGISTRY[key]  # dict mapping key -> agent node function
    config = await load_run_config(body.workspace_id)

    # Build a minimal DispatchState from the provided sample_input
    test_state = DispatchState(**body.sample_input, run_id="test-run", config=config)

    start = time.time()
    result = await agent_fn(test_state)
    latency_ms = int((time.time() - start) * 1000)

    agent_cost = get_agent_cost("test-run", key)
    clear_run_costs("test-run")  # clean up in-memory test cost

    return {"output": result, "cost": dataclasses.asdict(agent_cost), "latency_ms": latency_ms}
```

**AGENT_REGISTRY:** A dict in `graph/builder.py` or a new `lib/registry.py` mapping agent key → unwrapped function. The test-run skips the `wrap_agent_node` wrapper (no Convex side effects), but does use the config-injected prompt.

### Single-Agent Re-Roll

Re-rolling an agent within an existing issue requires:
1. Load the existing LangGraph checkpoint for `run_id` (from Railway Postgres via checkpointer).
2. Extract the checkpoint state (which has all prior agent outputs).
3. Run only the target agent node against the checkpoint state.
4. Patch the Sanity draft with the new output (via `lib/sanity_client.py`).
5. Write the new output to Convex `agent_runs` and emit a `section-draft` deliberation event.

```python
@router.post("/issues/{issue_id}/agents/{key}/rerun")
async def agent_rerun(issue_id: str, key: str, body: AgentRerunRequest):
    run_id = body.run_id  # from the issue's pipelineMetadata.runId
    config = {"configurable": {"thread_id": run_id}}

    # Load checkpoint state
    state = await graph.aget_state(config)
    current_state = state.values

    # Run the agent
    agent_fn = AGENT_REGISTRY[key]
    new_output = await agent_fn(current_state)

    # Patch Sanity draft (section-specific patch, not full rewrite)
    await patch_issue_section(issue_id, key, new_output)

    # Update checkpoint with new output
    await graph.aupdate_state(config, new_output)

    return {"ok": True, "output": new_output}
```

---

## §5 Auth Boundary

### dispatch-control Auth: Greenfield from Zero

`docs/CURRENT_STATE.md Q5` confirms: no auth exists anywhere. The `dispatch-control` Next.js app is a clean greenfield for auth.

**Recommended approach:** Clerk (hosted auth, minimal integration surface). Alternatives: Auth.js v5 (more setup, self-managed sessions), Supabase Auth (adds Supabase as a dependency for auth only — not clean). Clerk is the best fit because:
- Single operator (Andrew) — no complex RBAC needed
- Hosted magic-link or passkey flows work without a password database
- Clerk middleware protects all routes with two lines of config
- JWT can be verified in the FastAPI API endpoints for dashboard-to-pipeline calls

**Pattern:**
```
dispatch-control Next.js → Clerk JWT in Authorization header → FastAPI /pipeline/* endpoints
```

FastAPI dashboard endpoints use a `Depends(require_clerk_jwt)` dependency that verifies the Clerk JWT against Clerk's JWKS endpoint. This replaces the `X-Pipeline-Trigger-Secret` header check for dashboard-originated calls. The Railway cron still uses `X-Pipeline-Trigger-Secret` (unchanged).

**Convex auth:** Convex's built-in auth integrates with Clerk via `ConvexProviderWithClerk`. Dashboard mutations are Convex-auth-gated; public site queries (on `apps/web`) remain unauthenticated as today. The shared `convex/` directory stays at the monorepo root — both apps import from it, but the function-level auth is conditional (`ctx.auth` is present for dashboard calls, absent for public calls).

**New environment variables for dispatch-control:**
- `CLERK_PUBLISHABLE_KEY` (public)
- `CLERK_SECRET_KEY` (server-only)
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `PIPELINE_API_URL` (points to Railway FastAPI)

---

## New File Locations

### Python Pipeline (packages/pipeline/src/eisenbalm_pipeline/)

| File | New or Modified | Purpose |
|------|-----------------|---------|
| `lib/config_loader.py` | NEW | `load_run_config()` + `snapshot_config()` — DB-backed config at run start |
| `lib/agent_wrapper.py` | NEW | `wrap_agent_node()` — Convex progress emission around each node |
| `lib/registry.py` | NEW | `AGENT_REGISTRY` dict (agent key → unwrapped node function) |
| `api/control.py` | NEW | Dashboard FastAPI endpoints: `/pipeline/run`, `/pipeline/tick`, `/runs/{id}/cancel`, `/agents/{key}/test-run`, rerun, publish, schedule |
| `lib/prompts.py` | MODIFIED | `load_prompt()` stays; no longer called from agents — called only from `config_loader.py` as file fallback |
| `graph/builder.py` | MODIFIED | Wraps each `builder.add_node()` call with `wrap_agent_node()`; reads `config` from state |
| `graph/state.py` | MODIFIED | Adds `config: Optional[RunConfig]` field to `DispatchState` |
| `api/runs.py` | MODIFIED | `/run/weekly` writes to new `runs` Convex table in addition to `pipelineRuns` |
| `agents/*.py` (8 files) | MODIFIED | Call sites: `load_prompt(name)` → `state["config"].prompts[name]` |

### Convex (convex/)

| File | New or Modified | Purpose |
|------|-----------------|---------|
| `schema.ts` | MODIFIED | New tables: `workspaces`, `users`, `agents`, `prompt_versions`, `pipeline_config`, `runs`, `agent_runs`, `charities`, `model_pricing`, `review_actions`, `audit_log` |
| `agents.ts` | NEW | CRUD for agent config rows |
| `promptVersions.ts` | NEW | Versioned prompt CRUD + `getActive` |
| `pipelineConfig.ts` | NEW | `getActive`, `update` (for kill switch, require_review, etc.) |
| `runs.ts` | NEW | Dashboard-facing run table (mirrors + extends pipelineRuns) |
| `agentRuns.ts` | NEW | Per-agent execution records (live progress) |
| `charities.ts` | NEW | Charity registry CRUD (not the existing `pitchLog`) |
| `modelPricing.ts` | NEW | Model price table CRUD |
| `reviewActions.ts` | NEW | Review action log |
| `auditLog.ts` | NEW | Audit trail mutations |
| `workspaces.ts` | NEW | Workspace + users CRUD |
| `pipelineRuns.ts` | MODIFIED | `updateStatus` also updates `runs` table (or call site change in pipeline) |

### dispatch-control App (apps/dispatch-control/)

New Next.js app. Internal structure mirrors `apps/web` conventions.

```
apps/dispatch-control/
├── app/
│   ├── layout.tsx                    # ClerkProvider + ConvexProviderWithClerk
│   ├── sign-in/[[...sign-in]]/page.tsx
│   ├── (dashboard)/
│   │   ├── page.tsx                  # Overview: run history, live run, cost
│   │   ├── agents/
│   │   │   ├── page.tsx              # Pipeline graph view + agent cards
│   │   │   └── [key]/
│   │   │       ├── page.tsx          # Per-agent edit: prompt, model, temp
│   │   │       └── test-run/page.tsx # Single-agent test-run UI
│   │   ├── runs/
│   │   │   ├── page.tsx              # Run history
│   │   │   └── [id]/page.tsx         # Live run view + per-agent progress
│   │   ├── review/
│   │   │   └── [id]/page.tsx         # Review gate: preview + approve/reject
│   │   ├── charities/page.tsx        # Charity registry
│   │   ├── settings/page.tsx         # Schedule, kill switch, budget caps
│   │   └── cost/page.tsx             # Cost roll-ups, model pricing editor
├── middleware.ts                     # Clerk auth: protect all /(dashboard)/* routes
├── lib/
│   ├── pipeline-api.ts              # Typed wrappers for FastAPI calls
│   └── convex/
│       └── queries.ts               # Dashboard-specific Convex query imports
└── package.json                     # name: "@eisenbalm/dispatch-control"
```

---

## Build Order (Dependency-Honoring)

The §2 keystone (config externalization + snapshot) is the foundation. Everything else reads from it.

| Step | What | Depends On | Key Artifacts |
|------|------|-----------|---------------|
| 1 | Convex schema extension (new tables) | Nothing — additive | New tables in `convex/schema.ts`; generated types |
| 2 | `pipeline_config` + `agents` + `prompt_versions` Convex functions | Step 1 | `convex/pipelineConfig.ts`, `agents.ts`, `promptVersions.ts` |
| 3 | Prompt migration seed: 12 `.md` files → Convex `prompt_versions` rows | Step 2 | Migration script; each agent has active v1 prompt in Convex |
| 4 | `lib/config_loader.py` (DB-backed loader + file fallback) | Step 2, existing `lib/prompts.py` | `load_run_config()` function; `RunConfig` dataclass |
| 5 | `graph/state.py` adds `config: Optional[RunConfig]` | Step 4 | `DispatchState` updated; `API_CONTRACTS.md §7` updated |
| 6 | Agent call sites swapped (8 files) | Steps 4, 5 | Agents read `state["config"].prompts[key]` |
| 7 | `lib/agent_wrapper.py` + `convex/agentRuns.ts` | Steps 1, existing `lib/cost.py` | Live per-agent progress in Convex |
| 8 | `graph/builder.py` wraps nodes with `wrap_agent_node()` | Steps 6, 7 | All nodes emit progress; `runs` table written at run start |
| 9 | `convex/runs.ts` + pipeline writes to `runs` table | Steps 1, 8 | Dashboard-facing run record with `config_snapshot` |
| 10 | `apps/dispatch-control` scaffold + Clerk auth | Nothing pipeline | New Next.js app; Clerk wired; all routes protected |
| 11 | Dashboard read-only views (graph, run history, live run, cost) | Steps 7, 9, 10 | Dashboard can observe but not yet control |
| 12 | `api/control.py` — `/pipeline/run`, `/pipeline/tick`, `/runs/{id}/cancel` | Step 8 | Dashboard can trigger + kill |
| 13 | Prompt editor UI (edit, save-as-version, diff, rollback) | Steps 2, 10 | Step 2 Convex functions consumed by dashboard UI |
| 14 | Single-agent test-run (`/agents/{key}/test-run` + `lib/registry.py`) | Steps 6, 12 | Test-run endpoint + dashboard UI |
| 15 | Review gate (`require_review` flow, `review_actions`, `audit_log`) | Steps 9, 10, 12 | Review queue in dashboard; approve/reject flow |
| 16 | Charity registry + Scout dedup integration | Step 1 | `convex/charities.ts`; Scout reads registry at run time |
| 17 | Budget caps + model pricing + cost roll-up dashboard | Steps 1, 9 | `model_pricing` table; dashboard cost views |
| 18 | Single-agent re-roll (`/issues/{id}/agents/{key}/rerun`) | Steps 12, 14 | Depends on checkpoint access patterns being stable |
| 19 | Notifications (run complete / failed / awaiting-review / budget) | Steps 9, 15 | Slack/email webhooks from Convex scheduled functions |
| 20 | Productization prep (workspace audit, per-workspace secrets, graph-as-data) | All above | `workspace_id` already threaded; secrets store TBD |

**Critical path:** Steps 1 → 2 → 4 → 5 → 6 → 8 → 9 must be done in order. Steps 10, 13, 14, 15 can parallelise with pipeline steps once Step 1 is done.

---

## Integration Constraints (Do Not Break)

| Existing Contract | What Must Not Change | Where Defined |
|---|---|---|
| `pipelineRuns.status` literals | `running` / `awaiting-review` / `complete` / `failed` — public site reads this | `convex/schema.ts`, `API_CONTRACTS.md §4.1` |
| `deliberationEvents.eventType` literals | 7 values; public site deliberation layer renders them | `convex/schema.ts`, `API_CONTRACTS.md §4.3` |
| `pipelineRuns:create` mutation args | `{runId, issueNumber, startedAt}` — pipeline calls this at run start | `API_CONTRACTS.md §3.1` |
| `pipelineRuns:updateStatus` mutation args | `{runId, status, completedAt?, errorMessage?, durationMs?, cost?}` | `API_CONTRACTS.md §3.2` |
| `POST /run/weekly` endpoint | Still exists; Railway cron calls it today; dashboard uses new `/pipeline/run` | `api/runs.py:177-241` |
| `POST /webhook/sanity-publish` endpoint | Unchanged; Sanity webhook still fires here | `api/webhooks.py` |
| `load_prompt()` function signature | Stays in `lib/prompts.py`; agents no longer call it directly but it is the fallback | `lib/prompts.py:49-70` |
| `DispatchState` existing fields | All existing TypedDict fields stay; only `config: Optional[RunConfig]` is added | `API_CONTRACTS.md §7` |
| `lib/cost.py::record_cost()` | Called by `openrouter_client.py`; must remain callable; `get_agent_cost()` added as a reader | `lib/cost.py:83-109` |
| `convex/_generated/api.ts` | Do not change existing function paths used by `apps/web` | `apps/web/` imports |
| `SUPABASE_POSTGRES_URL` env var name | Misnomer but stable; rename is a separate future task; do not rename mid-v2 | `graph/checkpointer.py:36` |

---

## Anti-Patterns for v2

### Anti-Pattern 1: Putting Config in Railway Postgres

**What might seem right:** Railway Postgres already exists for checkpointing; add a `pipeline_config` table there.

**Why it's wrong:** The dashboard (Next.js) has no direct Postgres access. Adding a REST API layer between dashboard and Postgres to read/write config adds a full extra service hop with auth concerns, when Convex already provides exactly this (HTTP mutations + real-time subscriptions). Mixing application config tables with LangGraph checkpoint tables risks schema naming conflicts and complicates backup/restore.

**Do this instead:** All application config (agents, prompt_versions, pipeline_config) lives in Convex. Railway Postgres holds only LangGraph checkpoint tables.

### Anti-Pattern 2: Reading Convex Config Inside Agent Nodes

**What might seem right:** Each agent calls Convex to fetch its own prompt at execution time, for maximum freshness.

**Why it's wrong:** A 7-way parallel superstep with 7 concurrent Convex fetches creates 7 network round-trips mid-graph. If Convex is momentarily unreachable mid-run, the run fails at a random section writer. Mid-run config changes corrupt the run (different agents run with different prompt versions for the same issue).

**Do this instead:** `load_run_config()` runs ONCE at run start, before `graph.ainvoke()`. The full config is snapshotted and threaded through `DispatchState.config`. Agents read from state, not from Convex. This guarantees every agent in a run uses the same config version.

### Anti-Pattern 3: Extending deliberationEvents for Dashboard Progress

**What might seem right:** Add new `eventType` values (`agent-started`, `agent-completed`) to `deliberationEvents` for dashboard live progress.

**Why it's wrong:** `deliberationEvents.eventType` is an explicit closed union defined in `convex/schema.ts` and `API_CONTRACTS.md §4.3`. The public site deliberation layer renders these event types. Adding dashboard-only event types leaks internal execution state into the public deliberation view and breaks the schema's type safety.

**Do this instead:** Dashboard live progress lives in the new `agent_runs` table. Separate Convex function, separate subscription, separate table. The public site never touches `agent_runs`.

### Anti-Pattern 4: Overwriting Prompts in Place

**What might seem right:** When Andrew saves a prompt edit, update the existing `prompt_versions` row in place.

**Why it's wrong:** Breaks reproducibility. If a run is in-flight (or was completed last week), the config_snapshot references version N. Overwriting version N makes it impossible to replay or understand what produced a past issue.

**Do this instead:** Every save creates a new `prompt_versions` row with an incremented `version_num`. "Activate" sets `active: true` on the new row and `active: false` on the previous one. The old row is never deleted — it is the audit trail.

### Anti-Pattern 5: Single Convex Table for Both pipelineRuns and runs

**What might seem right:** Extend `pipelineRuns` with `config_snapshot`, `trigger_source`, `triggered_by` instead of creating a new `runs` table.

**Why it's wrong:** `pipelineRuns` function signatures are defined in `API_CONTRACTS.md §4.1` and called by name from `apps/web` (the public deliberation layer). Changing the schema or adding mutation args risks breaking the public site. The dashboard's needs (config_snapshot, richer status, trigger provenance) are additive and not needed by the public site.

**Do this instead:** `runs` is a new Convex table that the dashboard owns. `pipelineRuns` is the existing table the public site owns. Both are written to at run start (same `run_id` as the join key). `pipelineRuns:updateStatus` continues to work exactly as before.

---

## System Overview (v1 — unchanged)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BROWSER / READER                                │
│  Next.js (Vercel) ─── Sanity GROQ reads (CDN) ──────────────────┐  │
│  React components ─── Convex useQuery subscriptions (live) ──┐  │  │
└──────────────────────────────────────────────────────────────┼──┼──┘
                                                               │  │
┌──────────────────────────────────────────────────────────────┼──┼──┐
│                     SANITY CMS (cloud)                        │  │  │
│  weeklyIssue (draft/published) ──────────────────────────────┘  │  │
│  charity ─ agentProfile                                          │  │
│  On status→published: fires webhook ──────────────────────────┐ │  │
└───────────────────────────────────────────────────────────────┼─┼──┘
                                                                │ │
┌───────────────────────────────────────────────────────────────┼─┼──┐
│                     CONVEX (cloud)                             │ │  │
│  pipelineRuns ─ deliberationEvents ─ agentVotes ──────────────┘ │  │
│  qaCorrections ─ pitchLog                          ◄────────────┘  │
│  Written by: pipeline (HTTP API) / Read by: frontend (useQuery)     │
└───────────────────────────────────────────────────────────────────┘
                             ▲ HTTP mutations
┌────────────────────────────┼────────────────────────────────────────┐
│         FASTAPI + LANGGRAPH (Railway)                               │
│                            │                                        │
│  POST /run ──► LangGraph graph (compiled with AsyncPostgresSaver)   │
│                            │                                        │
│  Phase 1 — Sequential:     │                                        │
│  Calibrator → Scout → Advocate → Editor[interrupt?] ───────────┐   │
│                            │                                    │   │
│  Phase 2 — Parallel (Send API fan-out):                         │   │
│  Researcher → [OriginStory │ Problem │ FounderBio │ CaseStudy   │   │
│               │ Game │ Bonus │ Design] → QA → EditorFinal       │   │
│                            │                                    │   │
│  Sanity write (draft) ─────┘                                    │   │
│  Convex pipelineRuns: awaiting-review                           │   │
│                                                                 │   │
│  POST /webhook/sanity-publish ◄─── Sanity webhook (HMAC) ──────┘   │
│           │                                                         │
│           └──► Publisher (background) → PDF → Sanity → Vercel      │
└─────────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────┐
│         RAILWAY POSTGRES (LangGraph checkpointer)                   │
│  AsyncPostgresSaver checkpoint tables (LangGraph built-in schema)   │
│  Stores: thread checkpoints, channel blobs, pending sends           │
│  Purpose: pause/resume after interrupt, crash recovery              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Architectural Seam 1 — LangGraph State, Checkpointing, and Interrupts

### State Schema Pattern

The `DispatchState` TypedDict (defined in `packages/pipeline/types.py`, documented in `docs/API_CONTRACTS.md §7`) is the single state object threaded through the entire graph. Every agent node reads from it and returns a dict of updates — LangGraph merges writes back into the shared state automatically.

**Key design rule:** Fields for Phase 2 outputs (`origin_story`, `problem_statement`, etc.) are all `Optional`. The state schema must declare a reducer for any field that multiple parallel nodes can write. For the seven section writers, each writes to a *distinct* key, so no reducer is needed — the default overwrite behaviour is correct. Do not use `Annotated[list, operator.add]` unless you genuinely need accumulation.

```python
# packages/pipeline/graph.py — canonical structure
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

builder = StateGraph(DispatchState)

# Phase 1 — sequential
builder.add_node("calibrator", calibrator_node)
builder.add_node("scout", scout_node)
builder.add_node("advocate", advocate_node)
builder.add_node("editor_gate1", editor_gate1_node)

# Phase 2 — parallel fan-out via conditional edges
builder.add_node("researcher", researcher_node)
builder.add_node("origin_story", origin_story_node)
# ... other section writer nodes ...
builder.add_node("qa", qa_node)
builder.add_node("editor_final", editor_final_node)
builder.add_node("sanity_write", sanity_write_node)

# Sequential edges for phase 1
builder.add_edge("calibrator", "scout")
builder.add_edge("scout", "advocate")
builder.add_edge("advocate", "editor_gate1")

# Fan-out from researcher (runs after editor_gate1 completes)
# All 7 section writers start simultaneously
builder.add_edge("editor_gate1", "researcher")
builder.add_conditional_edges(
    "researcher",
    lambda state: ["origin_story", "problem_statement",
                   "founder_bio", "case_study", "game", "bonus", "design"],
    ["origin_story", "problem_statement",
     "founder_bio", "case_study", "game", "bonus", "design"],
)
# Fan-in — all writers must finish before QA
for writer in ["origin_story", "problem_statement",
                "founder_bio", "case_study", "game", "bonus", "design"]:
    builder.add_edge(writer, "qa")

builder.add_edge("qa", "editor_final")
builder.add_edge("editor_final", "sanity_write")
builder.add_edge("sanity_write", END)

# Compile with Postgres checkpointer
async with AsyncPostgresSaver.from_conn_string(SUPABASE_URL) as checkpointer:
    await checkpointer.setup()   # run once (CI/CD migration, not every startup)
    graph = builder.compile(checkpointer=checkpointer)
```

**Fan-out execution rule:** When multiple edges leave a single node pointing to different destination nodes, LangGraph groups those destinations into a *superstep* and executes them concurrently. If **any** node in a superstep raises an exception, the entire superstep fails atomically — no partial state is saved. This means the seven section writers must each have internal retry logic or safe fallback returns.

### Human-in-the-Loop: Editor Gate 1 Interrupt

The `interrupt()` function (LangGraph ≥ 0.2) is the correct pattern. It is not a breakpoint — it pauses mid-node execution, serialises the payload into the checkpoint, and marks the thread as `interrupted`. The node re-executes from the beginning on resume, so all logic before the `interrupt()` call must be idempotent.

```python
# packages/pipeline/agents/editor_gate1.py
from langgraph.types import interrupt, Command

async def editor_gate1_node(state: DispatchState) -> dict:
    # Deterministic: pick the winner from candidate array
    result = await llm_call(editor_prompt(state["candidates"]))

    if result["confidence"] < CONFIDENCE_THRESHOLD:
        # Pause — surfaces to Andrew via Convex pipelineRuns status
        await convex_mutation("pipelineRuns:updateStatus", {
            "runId": state["run_id"],
            "status": "awaiting-editor-decision",
        })
        # interrupt() serialises `result` into the checkpoint
        # Execution halts here; thread is marked interrupted
        human_input = interrupt({
            "reason": "no_clear_winner",
            "candidates": state["candidates"],
            "partial_analysis": result,
        })
        # Resumes here when Command(resume=...) is invoked
        # human_input contains whatever Andrew sent
        chosen_id = human_input["chosen_id"]
    else:
        chosen_id = result["winner_id"]

    winning_charity = next(
        c for c in state["candidates"] if c["name"] == chosen_id
    )
    return {
        "winning_charity": winning_charity,
        "editor_decision": result["rationale"],
        "runner_up_notes": result["runner_up_notes"],
        "deliberation_transcript": result["transcript"],
    }
```

**Resume from interrupt:** The FastAPI app exposes a `POST /run/{run_id}/resume` endpoint. Andrew (or a Convex-triggered webhook) calls it with the chosen charity. The endpoint invokes the graph with `Command(resume={"chosen_id": "..."})` on the same `thread_id`:

```python
# packages/pipeline/api/main.py
@app.post("/run/{run_id}/resume")
async def resume_run(run_id: str, body: ResumeBody):
    config = {"configurable": {"thread_id": run_id}}
    await graph.ainvoke(Command(resume=body.dict()), config=config)
    return {"ok": True}
```

### Checkpointer: Railway Postgres Backend

`AsyncPostgresSaver` from `langgraph-checkpoint-postgres` connects directly via the `SUPABASE_POSTGRES_URL` env var (which points at Railway Postgres despite the name — see `CURRENT_STATE.md Q3`).

`checkpointer.setup()` creates three tables: `checkpoints` (state snapshots keyed by `thread_id` + monotonically increasing `checkpoint_id`), `checkpoint_blobs` (overflow for large payloads), and `checkpoint_writes` (pending writes within a superstep). Call `setup()` exactly once during Railway deploy, not on every app startup.

**Thread ID convention:** Use `run_id` (UUID generated at pipeline start) as the `thread_id`. This means every weekly run has a unique, stable checkpoint namespace that can be resumed, forked, or inspected for debugging.

### Common Failure Modes — LangGraph Seam

| Failure | Mechanism | Prevention |
|---|---|---|
| Section writer raises exception | Entire parallel superstep rolls back — no partial writes | Add `try/except` inside each writer node; return a sentinel value on failure rather than raising |
| Interrupt node re-executes on resume | Logic before `interrupt()` runs twice | All pre-interrupt logic must be idempotent (safe to re-run) |
| `checkpointer.setup()` called on every startup | Migration runs repeatedly, fails on concurrent starts | Run only in CI/CD deploy step, not in `on_startup` |
| State key collision in parallel writers | Two nodes overwrite the same key | Each section writer writes only its own key; verify state schema before wiring |
| `thread_id` reuse across runs | Checkpoint from last week's run interferes | Always generate a fresh UUID `run_id` per weekly pipeline trigger |

---

## Architectural Seam 2 — Three-Datastore Boundaries

### Ownership Rules (Explicit)

| Data Entity | Source of Truth | Transient Mirror | Ownership Rule |
|---|---|---|---|
| `charity` document | **Sanity** | Convex `pitchLog` (name/location only); Convex `charities` registry (status/dedup) | Sanity is canonical content; Convex `charities` is the operational registry (dedup, blocklist) |
| `weeklyIssue` document | **Sanity** | Convex `pipelineRuns` (status only); Convex `runs` (status + config_snapshot) | Sanity owns content; Convex owns execution state |
| `agentProfile` document | **Sanity** | None — cached in React state | Seeded once, read-only. No pipeline writes. |
| Agent config (prompt, model, temp) | **Convex `agents` + `prompt_versions`** | None | Dashboard writes; pipeline reads at run start only |
| Pipeline run events | **Convex** | None | `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog`, `agent_runs` live only in Convex |
| LangGraph graph checkpoint | **Railway Postgres** | None | LangGraph internal state for pause/resume. Not queryable by the frontend or dashboard |

### What Lives Where — Decision Rules

**Write to Sanity when:** The data is content that Andrew will read, edit, or publish. Sanity is the record of what shipped.

**Write to Convex when:** The data is a pipeline event the frontend needs in real-time, OR dashboard config that the pipeline reads at run start, OR audit/review records the dashboard writes.

**Write to Railway Postgres (via checkpointer) when:** LangGraph needs to persist state for fault recovery or interrupt/resume. This is fully managed by the checkpointer — do not write to Railway Postgres manually.

### Common Failure Modes — Datastore Seam

| Failure | Mechanism | Prevention |
|---|---|---|
| Convex `pipelineRuns` missing for an issue | Convex write failed or not called | Always write `pipelineRuns:create` before graph starts |
| `runId` on Sanity issue doesn't match Convex | Sanity write used a different `run_id` | `run_id` set once at pipeline start, passed through all of `DispatchState`, never regenerated |
| `runs` table has stale config_snapshot | `snapshot_config()` not called before `graph.ainvoke()` | Step ordering in `api/runs.py`: load_config → snapshot → ainvoke |
| `agent_runs` progress missing from dashboard | `wrap_agent_node` not applied to a node | Verify all `builder.add_node()` calls use `wrap_agent_node()` |
| Charity registry in Convex contradicts Sanity | Scout wrote to Sanity but not Convex `charities` | Scout must write to both; dedup key is the Sanity `charity-{slug}` id |

---

## Architectural Seam 3 — Webhook Reliability (Sanity → Publisher)

(Unchanged from v1 — see existing content below.)

### Sanity Webhook Behaviour

Sanity delivers webhooks with at-least-once semantics. It retries **twice** after the initial attempt, with a 30-second interval between retries. It expects a response within 30 seconds or it considers the delivery failed and will retry. Key headers:

| Header | Value | Use |
|---|---|---|
| `sanity-webhook-signature` | `t={ts_ms},v1={base64url}` | HMAC-SHA256 signature (see `lib/sanity_webhook.py` for canonical algorithm) |
| `sanity-transaction-time` | ISO 8601 datetime | Monitoring convenience; age check uses `t=` from signature |
| `idempotency-key` | Stable UUID per delivery attempt group | Deduplication key across retries |

The canonical Python implementation is in `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py` (Phase 6). See `API_CONTRACTS.md §5.3` for the full algorithm.

---

## Architectural Seam 4 — Monorepo Type Sharing (with dispatch-control addition)

### Repository Structure (v2)

```
eisenbalm/
├── apps/
│   ├── web/                         # Next.js — public reader site
│   │   └── (unchanged from v1)
│   ├── studio/                      # Sanity Studio
│   │   └── (unchanged from v1)
│   └── dispatch-control/            # NEW — dashboard (auth-gated)
│       ├── app/
│       │   ├── layout.tsx           # ClerkProvider + ConvexProviderWithClerk
│       │   ├── sign-in/
│       │   └── (dashboard)/         # All protected routes
│       ├── middleware.ts             # Clerk auth protection
│       ├── lib/
│       │   └── pipeline-api.ts      # FastAPI call wrappers with Clerk JWT
│       └── package.json             # name: "@eisenbalm/dispatch-control"
├── packages/
│   ├── pipeline/                    # FastAPI + LangGraph (Python)
│   │   ├── src/eisenbalm_pipeline/
│   │   │   ├── lib/
│   │   │   │   ├── config_loader.py # NEW
│   │   │   │   ├── agent_wrapper.py # NEW
│   │   │   │   ├── registry.py      # NEW
│   │   │   │   └── (existing files unchanged)
│   │   │   └── api/
│   │   │       ├── control.py       # NEW — dashboard endpoints
│   │   │       └── (existing files unchanged)
│   └── shared/                      # TypeScript shared types
│       └── src/
│           ├── control-types.ts     # NEW — dashboard-facing types
│           └── (existing files unchanged)
├── convex/                          # Convex schema + functions
│   ├── schema.ts                    # MODIFIED — new tables added
│   ├── (existing .ts files unchanged)
│   ├── agents.ts                    # NEW
│   ├── promptVersions.ts            # NEW
│   ├── pipelineConfig.ts            # NEW
│   ├── runs.ts                      # NEW
│   ├── agentRuns.ts                 # NEW
│   ├── charities.ts                 # NEW (registry, not pitchLog)
│   ├── modelPricing.ts              # NEW
│   ├── reviewActions.ts             # NEW
│   ├── auditLog.ts                  # NEW
│   └── workspaces.ts                # NEW
├── schemas/                         # Sanity schemas (unchanged)
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

### workspace_id Threading

Every new Convex table includes a `workspace_id` field. For single-tenant v2, this is always the same value (seeded once). The threading is done now so the extraction to multi-tenant later requires only data migration + auth routing changes, not schema changes.

`workspace_id` flows: Dashboard (reads from Clerk JWT claim or hardcoded env) → Convex mutations (as field on every write) → Pipeline (reads from `pipeline_config` row via `workspace_id`).

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---|---|---|
| Sanity CMS | Python: `sanity` SDK for writes; TypeScript: `@sanity/client` for reads | Unchanged from v1 |
| Convex | Pipeline: HTTP API (`httpx`); Public site: `convex/react` hooks; Dashboard: `convex/react` + Clerk auth | Dashboard mutations are Convex-auth-gated; public queries remain open |
| Railway Postgres | LangGraph `AsyncPostgresSaver` only | Unchanged; do not add application tables |
| OpenRouter | `lib/openrouter_client.py` — unchanged | `acomplete()` still calls `record_cost()` |
| Clerk | `apps/dispatch-control/middleware.ts` + `ConvexProviderWithClerk` + JWT verification in FastAPI `/pipeline/*` | New for v2 |
| Vercel | `POST VERCEL_DEPLOY_HOOK_URL` from Publisher — unchanged | |
| Stripe | `apps/web/app/api/` — unchanged for checkout/webhook | Dashboard reads Stripe for reconciliation (read-only Stripe API) |

### Internal Boundaries

| Boundary | Communication | Notes |
|---|---|---|
| `dispatch-control` ↔ Convex | `convex/react` mutations + queries (Clerk-authed) | Dashboard is the primary writer of config tables |
| `dispatch-control` ↔ FastAPI | HTTP REST with Clerk JWT in `Authorization: Bearer` | Trigger, cancel, test-run, rerun, publish |
| Pipeline ↔ Convex (config read) | `httpx` GET `convex_query()` at run start only | One-time read; result cached in `RunConfig` for the run |
| Pipeline ↔ Convex (progress write) | `httpx` POST `convex_mutation()` from `agent_wrapper.py` | Non-blocking; log errors, continue |
| `apps/web` ↔ Convex | `convex/react` `useQuery` (unauthenticated) | Unchanged; public deliberation layer |
| `apps/web` ↔ Sanity | `@sanity/client` GROQ (CDN read) | Unchanged |

---

## Sources

- [LangGraph Human-in-the-Loop — interrupt() pattern](https://www.langchain.com/blog/making-it-easier-to-build-human-in-the-loop-agents-with-interrupt)
- [Architecting Human-in-the-Loop Agents in LangGraph](https://medium.com/data-science-collective/architecting-human-in-the-loop-agents-interrupts-persistence-and-state-management-in-langgraph-fa36c9663d6f)
- [LangGraph Persistence Guide 2026](https://fast.io/resources/langgraph-persistence/)
- [LangGraph AsyncPostgresSaver — PyPI](https://pypi.org/project/langgraph-checkpoint-postgres/)
- [LangGraph Parallel Execution — Best Practices](https://forum.langchain.com/t/best-practices-for-parallel-nodes-fanouts/1900)
- [Sanity Webhook Best Practices](https://www.sanity.io/docs/content-lake/webhook-best-practices)
- [Turborepo TypeScript Guide](https://turbo.build/repo/docs/handbook/linting/typescript)
- [FastAPI + LangGraph Production Pattern](https://ranjankumar.in/building-production-ready-ai-agent-services-fastapi-langgraph-template-deep-dive)
- [docs/CURRENT_STATE.md](../CURRENT_STATE.md) — Phase 0 reconciliation (ground truth for integration points)
- [docs/MISSION_CONTROL_BRIEF.md](../MISSION_CONTROL_BRIEF.md) — v2.0 spec

---
*Architecture research for: The Eisenbalm Dispatch — v1 9-agent LangGraph pipeline + v2.0 Mission Control integration*
*Researched: 2026-05-09 (v1) · updated 2026-06-21 (v2.0 integration)*
