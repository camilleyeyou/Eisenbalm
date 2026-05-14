# Phase 4: Pipeline Skeleton — Research

**Researched:** 2026-05-13
**Domain:** FastAPI + LangGraph 1.1 + AsyncPostgresSaver (Supabase) on Railway, with three-datastore (Sanity + Convex + Supabase) write discipline — all in stub mode
**Confidence:** HIGH (every load-bearing pattern verified against official LangGraph 1.x docs, Supabase docs, Sanity HTTP API docs, Convex HTTP API docs, and current GitHub issues; sharp edges sourced from in-the-wild bug reports)

## Summary

Phase 4 wires the full 14-node LangGraph graph against a Postgres-backed checkpointer with a working `interrupt()` / `Command(resume=...)` cycle, but does so in stub mode (no LLM cost). The headline technical risk — **does the interrupt survive a Railway container restart?** — has a clean answer: yes, if `AsyncPostgresSaver` is used correctly and the connection string targets a Supabase mode that supports prepared statements (or psycopg is configured to disable them). The wrong combination produces silent `psycopg.OperationalError: InvalidSqlStatementName` on resume, which would look exactly like "the resume worked but the graph crashed."

The second-biggest landmine is Railway's IPv4-only egress versus Supabase's IPv6-only direct connection. Use the **session pooler** (port 5432, host `aws-0-<region>.pooler.supabase.com`) — it's IPv4-compatible *and* supports prepared statements (unlike the transaction pooler on 6543). For Phase 4, target the session pooler explicitly.

Sanity has no maintained Python SDK as of May 2026 (the PyPI `sanity` package is v0.2.5 and abandoned). The plan must use raw `httpx` against the Sanity Content API — `API_CONTRACTS.md §2` already encodes this assumption.

Convex's HTTP `/api/mutation` endpoint takes `{path: "module:export", args: {...}, format: "json"}`. The auth header is `Authorization: Convex {DEPLOY_KEY}` (NOT `Bearer`). Response envelope is `{status: "success"|"error", value|errorMessage, logLines}` — the wrapper decorator should branch on `status`, not on HTTP status.

`interrupt()` in LangGraph 1.x suspends via a special exception caught by the runtime; `await graph.ainvoke(...)` returns a state object containing `__interrupt__` (or `result.interrupts` in v2) — it does NOT block forever. The orchestrator's job is to detect the interrupt, write `awaiting-review` to Convex, return 200 to the client, and wait for `/run/{runId}/resume` to call `graph.ainvoke(Command(resume=value), config={'configurable': {'thread_id': runId}})`. Same thread_id → checkpoint loads → the node where `interrupt()` was raised re-runs from the top (so code before `interrupt()` MUST be idempotent), and `interrupt()` returns the resumed value this time.

FastAPI `BackgroundTasks` is **not safe** for long-running stub runs — they're tied to the request lifecycle and get cancelled if the client disconnects. The graph itself doesn't care (checkpoints are durable), but the in-flight Python coroutine running it does. Use `asyncio.create_task()` with a strong reference held in `app.state`, OR (cleaner) accept that `BackgroundTasks` may be cancelled and rely on the checkpoint for recovery — Andrew or a re-trigger restart it. CONTEXT.md D-06 picks `BackgroundTasks`; this is acceptable IF the plan documents the cancellation behavior and the orchestrator's response to a partially-completed run (Convex `status` is the truth; the LangGraph state is recoverable via the checkpoint).

**Primary recommendation:** Build the lifespan-managed `AsyncPostgresSaver` against Supabase's **session pooler (port 5432)** with `prepare_threshold=None` defensively set on the psycopg connection. Wire `interrupt()` in the Editor gate 1 node with `pipelineRuns:updateStatus` called BEFORE `interrupt()` (idempotent — safe to re-run on resume). Use `asyncio.create_task()` instead of `BackgroundTasks` and keep the task handle in `app.state` so it doesn't get GC'd. Use raw `httpx` for both Convex and Sanity — there is no Python SDK worth using.

## User Constraints (from CONTEXT.md)

### Locked Decisions

The 42 decisions D-01 through D-42 in `.planning/phases/04-pipeline-skeleton/04-CONTEXT.md` are LOCKED. Research below operates within them, not outside them. Highlights for the planner's verification convenience:

- **D-01 / D-02 / D-03 / D-04:** `uv`-managed Python 3.11 project at `packages/pipeline/src/eisenbalm_pipeline/`, with pins `fastapi==0.136.1`, `uvicorn[standard]==0.46.0`, `langgraph==1.1.10`, `pydantic==2.13.4`, `httpx==0.28.1`, `langchain-openai==1.2.1`, `supabase==2.30.0`, `python-slugify==8.0.4`, dev deps `pytest`, `pytest-asyncio`, `httpx[testing]`. Plus the two sub-deps verified in this research: `langgraph-checkpoint-postgres==3.1.0`, `psycopg[binary]>=3.2`.
- **D-05:** Modular FastAPI with `APIRouter` and the file layout shown. No flat `main.py`.
- **D-06:** `BackgroundTasks` for the `/run/weekly` async invocation. *(This research recommends `asyncio.create_task` with `app.state` strong-ref instead — see §3 sharp edges — but planner has discretion per CONTEXT §"Claude's Discretion".)*
- **D-09 / D-10:** runId is a `uuid4().hex` generated exactly once in `/run/weekly`. `thread_id == runId` in the LangGraph config.
- **D-11 / D-12:** `AsyncPostgresSaver` against Supabase Postgres. `checkpointer.setup()` is a one-time CLI step (`python -m eisenbalm_pipeline.cli setup-checkpointer`), not on every startup.
- **D-13:** Editor gate 1 uses LangGraph 1.x native `interrupt()` + `Command(resume=...)`. Resume payload shape is `{'editorSelection': charityName}`.
- **D-14:** Fan-out via parallel edges into `Researcher → 7 writers → validate_sections → QA → Editor[final] → Publisher`. `validate_sections` is a synthetic join node from PITFALLS.md §1.3.
- **D-15:** `@agent_node(name=..., emit_event=..., max_tool_calls=...)` wrapper decorator owns try/except + Convex event emission + cost recording + iteration limits.
- **D-16 / D-17:** Deterministic stub fixtures. `EISENBALM_STUB_MODE=true` default in Phase 4.
- **D-18:** Three-datastore write order: Convex `pipelineRuns:create` first; per-agent Convex events; Sanity `write_issue_draft` once at pipeline end (before Publisher); Publisher sets `status=awaiting-review` (NOT `complete` — that's Phase 6's webhook handler).
- **D-19 / D-20:** Idempotent deterministic `_id`s in Sanity (`issue-999` for stub). Sanity failure halts pipeline; Convex failure log-continues.
- **D-22 / D-23 / D-26 / D-27:** `cost` is a JSON string on `pipelineRuns` (mirror `modelVersions` pattern); `durationMs` is a new optional number field. `status='partial-failure'` is NOT added — validate_sections failures set `status='failed'` with `errorMessage = 'partial-failure: missing sections [origin_story, game]'`. `errorMessage` format: `f'{agentId}: {ExceptionClass}: {short_msg}'`.
- **D-28:** Custom Dockerfile, `python:3.11-slim-bookworm`, WeasyPrint system deps installed in Phase 4 even though Phase 6 owns the PDF.
- **D-29 / D-30:** Manual Railway + Supabase provisioning by Andrew. Plan documents commands, doesn't run them autonomously.
- **D-35 / D-36 / D-37:** Three pytest integration tests at `packages/pipeline/tests/test_pipeline_e2e.py`, `test_editor_gate_1_resume.py`, `test_agent_failure.py`. Local-only, no CI.
- **D-38:** No CI gates.
- **D-39:** Two additive Convex schema patches: add `durationMs: v.optional(v.number())` and `cost: v.optional(v.string())` to `pipelineRuns` table; extend `pipelineRuns:updateStatus` args to accept both.

### Claude's Discretion

- Dockerfile multi-stage layout (single vs builder/runtime split)
- `BackgroundTasks` vs `asyncio.create_task` (research below recommends the latter for technical reasons)
- Stub fixture exact text content (Jesse-voice-ish is fine; Lorem ipsum acceptable per CONTEXT.md)
- Where `_emit_event` payload construction lives (wrapper vs per-agent)
- Exact CLI shape for `setup-checkpointer`
- Pydantic `BaseModel` for FastAPI request bodies (recommended)
- Logging library choice (stdlib `logging` with JSON output recommended)
- Whether `validate_sections` lives inline in `graph/builder.py` or as `agents/validate.py`

### Deferred Ideas (OUT OF SCOPE)

- LangSmith tracing wiring (Phase 5)
- Per-developer Supabase databases (single production)
- Sanity Studio custom field renderer for `pipelineMetadata.cost`
- `partial-failure` enum value
- OpenRouter retry / backoff logic
- Per-section retry on writer failure
- Cron-triggered weekly `/run/weekly`
- FastAPI auth beyond shared-secret header
- Cost-runaway alerting
- OpenRouter model version pinning logic
- Researcher founder-name source verification (`httpx` fetch + string match)
- Calibrator bonus-type rotation
- DesignAgent hex/font validation
- GameWriter embedCode validator
- Real Suno / NotebookLM
- A `/dev/replay` endpoint

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIP-01 | Custom Dockerfile builds + deploys to Railway (WeasyPrint deps pre-installed) | §8 Dockerfile + §9 Railway specifics |
| PIP-02 | `POST /run/weekly` returns `{runId}` | §3 ainvoke/BackgroundTasks + §6 Convex HTTP shape |
| PIP-03 | LangGraph wires all 14 agents in exact sequence | §4 LangGraph fan-out + join pattern |
| PIP-04 | Each agent stub returns structurally valid DispatchState | API_CONTRACTS §7 verbatim — copy into `graph/state.py` |
| PIP-05 | runId generated once, threaded to every Convex + Sanity write | CONTEXT.md D-09 + §6 Convex shape + §5 Sanity client pattern |
| PIP-06 | Integration test asserts Sanity `pipelineMetadata.runId == every Convex row's runId` | §10 pytest pattern |
| PIP-07 | Pipeline writes complete `weeklyIssue` draft (status=draft, deterministic charity `_id`) | §5 Sanity HTTP API + API_CONTRACTS §2 |
| PIP-08 | Convex writes for every event type | §6 Convex HTTP API + API_CONTRACTS §3 |
| PIP-09 | `AsyncPostgresSaver` checkpoints to Supabase; `setup()` one-time | §1 (THE CORE PATTERN) |
| PIP-10 | Editor gate 1 `interrupt()` → Convex `awaiting-review` → resume via `Command` | §2 (interrupt semantics) |
| PIP-11 | Per-run cost logged to Convex `pipelineRuns.cost` | CONTEXT.md D-22 + §6 Convex extended mutation |
| PIP-12 | `pipelineRuns.durationMs` populated | CONTEXT.md D-23 + §6 |
| OPS-01 | Failed runs write `status=failed` with agentId + errorMessage | §4 wrapper decorator + CONTEXT.md D-26/D-27 |
| OPS-02 | `GET /run/{runId}/status` returns current state | §6 Convex byRunId query (mirror of mutation pattern) |
| OPS-03 | Per-run cost visible in Sanity Studio | CONTEXT.md D-22/D-24 (JSON string on `pipelineMetadata.cost`) |

## Standard Stack

### Core (verified versions current as of May 2026)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastapi` | `==0.136.1` | HTTP server | Locked in CONTEXT D-04; confirmed latest released 2026-04-23 |
| `uvicorn[standard]` | `==0.46.0` | ASGI runner | Locked D-04 |
| `langgraph` | `==1.1.10` | Graph orchestration | Locked D-04; 1.x is current GA line |
| `langgraph-checkpoint-postgres` | `==3.1.0` | Postgres checkpointer | **Sub-dep that D-04 implies but doesn't pin** — released 2026-05-12, requires Python ≥3.10, depends on `psycopg` |
| `psycopg[binary]` | `>=3.2,<4` | Postgres driver | langgraph-checkpoint-postgres depends on `psycopg`; `>=3.2` is required for the `prepare_threshold` API used to disable prepared statements (sharp edge §7) |
| `pydantic` | `==2.13.4` | API request/response models | Locked D-04 |
| `httpx` | `==0.28.1` | Async HTTP (Convex + Sanity) | Locked D-04 |
| `langchain-openai` | `==1.2.1` | OpenRouter client (Phase 5) | Locked D-04; installed in Phase 4 to keep `pyproject.toml` stable, never instantiated in stub mode |
| `supabase` | `==2.30.0` | Optional Supabase helper | Locked D-04; **Phase 4 doesn't actually need this** — `AsyncPostgresSaver` owns the connection. Keep it for Phase 5+ |
| `python-slugify` | `==8.0.4` | Charity slug derivation | Locked D-04; matches API_CONTRACTS §2.1 |

### Dev / Test

| Library | Version | Purpose |
|---------|---------|---------|
| `pytest` | `>=8.3,<9` | Test runner |
| `pytest-asyncio` | `>=0.24,<1` | Async test support |
| `httpx` (already in core) | — | `ASGITransport(app=app)` for in-process testing |

> Note: D-04 mentions `httpx[testing]` — the `[testing]` extra was historically used but in current `httpx` (0.28.x) the test helpers are part of base. Plan should install plain `httpx` (already a core dep) and add `pytest-asyncio` for the async test harness.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `BackgroundTasks` | `asyncio.create_task` + `app.state` strong-ref | BackgroundTasks tied to request lifecycle; cancelled on client disconnect. Create_task survives the request but needs `app.state.background_tasks: set[Task]` to prevent GC. **CONTEXT D-06 picks BackgroundTasks; research recommends create_task** |
| `python-sanity` SDK | Raw `httpx` against `/v2024-01-01/data/mutate/{dataset}` | **No maintained official SDK exists** (STACK.md §"Sharp Edges" #1 confirms). PyPI `sanity` is v0.2.5 abandoned. OmniPro-Group fork is community-only. Direct httpx is the only sane path. CONTEXT D-04 mentions "if no maintained SDK, fall back to direct HTTP" — fall back is the only option |
| Supabase **transaction pooler** (port 6543) | Supabase **session pooler** (port 5432, host `aws-0-<region>.pooler.supabase.com`) | Transaction pooler doesn't support prepared statements → `psycopg.errors.InvalidSqlStatementName` on AsyncPostgresSaver checkpoint reads. Session pooler supports prepared statements + IPv4 + persistent connections. **Use session pooler.** Direct connection (port 5432, `db.<ref>.supabase.co`) is IPv6-only and won't work from Railway without the $4/mo IPv4 add-on |
| `MemorySaver` | `AsyncPostgresSaver` | MemorySaver loses state on Railway restart. PIP-09 mandates Postgres. Non-negotiable |

**Installation (uv):**
```bash
uv add fastapi==0.136.1 'uvicorn[standard]==0.46.0'
uv add langgraph==1.1.10 langgraph-checkpoint-postgres==3.1.0 'psycopg[binary]>=3.2'
uv add pydantic==2.13.4 httpx==0.28.1
uv add langchain-openai==1.2.1 supabase==2.30.0 python-slugify==8.0.4
uv add --dev pytest 'pytest-asyncio>=0.24'
```

**Version verification (run before pinning in pyproject.toml):**
```bash
uv pip index versions fastapi
uv pip index versions langgraph
uv pip index versions langgraph-checkpoint-postgres   # 3.1.0 verified 2026-05-12
uv pip index versions psycopg
```

## Architecture Patterns

### Recommended Project Structure (from CONTEXT.md D-05; locked)

```
packages/pipeline/
├── Dockerfile
├── pyproject.toml
├── uv.lock
├── railway.toml
├── .env.example
├── README.md
├── src/eisenbalm_pipeline/
│   ├── __init__.py
│   ├── cli.py                  # python -m eisenbalm_pipeline.cli setup-checkpointer
│   ├── api/
│   │   ├── main.py             # FastAPI app + lifespan + router includes
│   │   ├── runs.py             # POST /run/weekly, GET /run/{runId}/status, POST /run/{runId}/resume, POST /run/{runId}/publish
│   │   ├── webhooks.py         # POST /webhook/sanity-publish (stub returning 200; full impl Phase 6)
│   │   └── health.py           # GET /healthz
│   ├── graph/
│   │   ├── state.py            # DispatchState TypedDict (API_CONTRACTS §7 verbatim)
│   │   ├── builder.py          # build_graph() → CompiledStateGraph
│   │   └── checkpointer.py     # AsyncPostgresSaver lifecycle factory
│   ├── agents/
│   │   ├── _wrapper.py         # @agent_node decorator
│   │   ├── calibrator.py, scout.py, advocate.py, editor.py, researcher.py
│   │   ├── origin_story.py, problem.py, founder_bio.py, case_study.py
│   │   ├── game.py, bonus.py, design.py, qa.py, publisher.py
│   │   └── validate.py         # validate_sections join node (D-14)
│   ├── lib/
│   │   ├── sanity_client.py    # write_charity, write_issue_draft, upload_pdf_to_issue (httpx)
│   │   ├── convex_client.py    # convex_mutation, convex_query (httpx)
│   │   ├── portable_text.py    # text_to_portable_text (API_CONTRACTS §2.4)
│   │   ├── cost.py             # CostRecorder context manager
│   │   └── ids.py              # new_run_id()
│   ├── stubs/
│   │   ├── fixtures.py         # deterministic per-agent output
│   │   └── fake_openrouter.py  # canned responses, 0 tokens
│   └── types.py                # public re-exports
└── tests/
    ├── conftest.py
    ├── test_pipeline_e2e.py        # PIP-06 — full stub run end-to-end
    ├── test_editor_gate_1_resume.py # PIP-10 — interrupt/resume cycle
    ├── test_agent_failure.py        # OPS-01 — forced exception path
    └── fixtures/                    # JSON snapshots if needed
```

### Pattern 1: Lifespan-managed graph compilation + checkpointer (CRITICAL)

**What:** The graph is compiled exactly once at FastAPI startup with a lifespan-owned `AsyncPostgresSaver`. The compiled graph is stored in `app.state` and reused for every request.

**Why:** `AsyncPostgresSaver.from_conn_string(...)` is an async context manager. Constructing/destructing it per request is enormously wasteful (connection setup) and may leak connections. Compiling the graph per request is also wasteful (LangGraph compilation is non-trivial). The lifespan owns both for the full process lifetime.

**Example:**
```python
# src/eisenbalm_pipeline/api/main.py
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from httpx import AsyncClient
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from eisenbalm_pipeline.graph.builder import build_graph
from eisenbalm_pipeline.api import runs, webhooks, health


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_url = os.environ['SUPABASE_POSTGRES_URL']

    # SHARP EDGE: psycopg connection options for Supabase compatibility.
    # See § Common Pitfalls #1. prepare_threshold=None is defensive — if anyone
    # ever points the env at the transaction pooler (6543), the app still works.
    pool = AsyncConnectionPool(
        conninfo=db_url,
        max_size=10,
        kwargs={
            'autocommit': True,
            'prepare_threshold': None,    # disable prepared statements
            'row_factory': dict_row,
        },
        open=False,
    )
    await pool.open()

    checkpointer = AsyncPostgresSaver(pool)
    # NOTE: do NOT call checkpointer.setup() here — that's the one-time
    # `python -m eisenbalm_pipeline.cli setup-checkpointer` step (D-12).
    # Fail-fast assertion that tables exist:
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT to_regclass('public.checkpoints')")
            row = await cur.fetchone()
            if not row or row['to_regclass'] is None:
                raise RuntimeError(
                    'AsyncPostgresSaver tables not found. '
                    'Run: python -m eisenbalm_pipeline.cli setup-checkpointer'
                )

    graph = build_graph(checkpointer=checkpointer)

    # Shared httpx clients (one per process)
    convex_http = AsyncClient(
        base_url=os.environ['NEXT_PUBLIC_CONVEX_URL'].rstrip('/'),
        timeout=10.0,
    )
    sanity_http = AsyncClient(
        base_url=f"https://{os.environ['NEXT_PUBLIC_SANITY_PROJECT_ID']}.api.sanity.io",
        timeout=30.0,
    )

    # Strong reference for create_task'd background runs (see Pattern 3)
    app.state.graph = graph
    app.state.checkpointer = checkpointer
    app.state.pool = pool
    app.state.convex_http = convex_http
    app.state.sanity_http = sanity_http
    app.state.background_tasks = set()  # strong-ref set for create_task

    yield

    # Shutdown — order matters
    for task in app.state.background_tasks:
        task.cancel()
    await convex_http.aclose()
    await sanity_http.aclose()
    await pool.close()


app = FastAPI(lifespan=lifespan, title='Eisenbalm Pipeline')
app.include_router(runs.router)
app.include_router(webhooks.router)
app.include_router(health.router)
```

**Source:** [LangGraph add-memory](https://docs.langchain.com/oss/python/langgraph/add-memory), [psycopg ConnectionPool with checkpointer pattern](https://github.com/langchain-ai/langgraph/discussions/2967)

### Pattern 2: `interrupt()` + `Command(resume=...)` (THE LOAD-BEARING PATTERN — see §2 for full walkthrough)

**What:** Pause the graph for Andrew at Editor gate 1 when no winner can be selected, then resume from a separate FastAPI endpoint.

**Source:** [LangGraph interrupts docs](https://docs.langchain.com/oss/python/langgraph/interrupts)

### Pattern 3: Long-running graph invocation outside the request lifecycle (sharp edge)

**What:** `/run/weekly` returns `{runId}` immediately, but the graph may take 30+ seconds (real Phase 5) or interrupt indefinitely (gate 1). Using `BackgroundTasks` ties the coroutine to the request — if the client disconnects, the task is cancelled.

**Recommendation:** Use `asyncio.create_task()` with a strong reference held in `app.state.background_tasks` (a set). The task survives the request. Wrap in a try/finally that removes itself from the set on completion. The graph's own checkpoint provides recovery if the worker is killed mid-run.

**Example:**
```python
# src/eisenbalm_pipeline/api/runs.py
import asyncio
import time
import uuid
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

router = APIRouter()


class RunWeeklyBody(BaseModel):
    issueNumber: int = 999
    forceNoWinner: bool = False         # stub-mode toggle for D-36 test
    forceFailAgent: str | None = None   # stub-mode toggle for D-37 test


async def _execute_run(app, run_id: str, initial_state: dict, config: dict):
    """Background coroutine that runs the graph. Survives request disconnect."""
    try:
        result = await app.state.graph.ainvoke(initial_state, config=config)

        # If the graph hit interrupt(), result contains __interrupt__ — the
        # node already wrote 'awaiting-review' to Convex (per D-13). Nothing
        # more for us to do; /resume will re-invoke.
        # If complete, the Publisher node has already set 'awaiting-review'.
        # (status=='complete' is set in Phase 6 by the Sanity webhook.)
    except Exception as e:
        # The @agent_node decorator already wrote 'failed' to Convex.
        # Re-raise nothing; let the task die quietly.
        pass


@router.post('/run/weekly')
async def run_weekly(request: Request, body: RunWeeklyBody):
    # Auth: shared-secret header (D-31)
    if request.headers.get('X-Pipeline-Trigger-Secret') != os.environ['PIPELINE_TRIGGER_SECRET']:
        raise HTTPException(status_code=401, detail='Invalid trigger secret')

    run_id = uuid.uuid4().hex                     # D-09: generated EXACTLY ONCE
    started_at = int(time.time() * 1000)

    # Write initial pipelineRuns row BEFORE launching the graph (D-18 step 1).
    await convex_mutation(request.app, 'pipelineRuns:create', {
        'runId': run_id,
        'issueNumber': body.issueNumber,
        'startedAt': started_at,
    })

    initial_state = {
        'run_id': run_id,
        'issue_number': body.issueNumber,
        'publish_date': time.strftime('%Y-%m-%d'),
        'pipeline_started_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        # Stub-mode test toggles (consumed by the editor / wrapper)
        '_force_no_winner': body.forceNoWinner,
        '_force_fail_agent': body.forceFailAgent,
        # All other DispatchState fields start as None (D-04 / API_CONTRACTS §7)
    }

    config = {'configurable': {'thread_id': run_id}}

    # PATTERN 3: strong-ref'd background task — survives client disconnect
    task = asyncio.create_task(
        _execute_run(request.app, run_id, initial_state, config)
    )
    request.app.state.background_tasks.add(task)
    task.add_done_callback(request.app.state.background_tasks.discard)

    return {'runId': run_id}
```

### Pattern 4: Parallel fan-out in LangGraph 1.x (D-14)

**What:** From `Researcher` (single node), fan out to 7 parallel writer nodes; all converge at `validate_sections` join node.

**Two viable patterns; recommend Pattern A (plain multi-target edges) for Phase 4:**

**Pattern A — multi-target plain edges (simplest, recommended):**
```python
# src/eisenbalm_pipeline/graph/builder.py
from langgraph.graph import StateGraph, START, END
from eisenbalm_pipeline.graph.state import DispatchState

def build_graph(checkpointer):
    builder = StateGraph(DispatchState)

    builder.add_node('calibrator', calibrator_node)
    builder.add_node('scout', scout_node)
    builder.add_node('advocate', advocate_node)
    builder.add_node('editor_gate_1', editor_gate_1_node)
    builder.add_node('researcher', researcher_node)
    builder.add_node('origin_story', origin_story_node)
    builder.add_node('problem', problem_node)
    builder.add_node('founder_bio', founder_bio_node)
    builder.add_node('case_study', case_study_node)
    builder.add_node('game', game_node)
    builder.add_node('bonus', bonus_node)
    builder.add_node('design', design_node)
    builder.add_node('validate_sections', validate_sections_node)
    builder.add_node('qa', qa_node)
    builder.add_node('editor_final', editor_final_node)
    builder.add_node('publisher', publisher_node)

    # Sequential pre-fan-out
    builder.add_edge(START, 'calibrator')
    builder.add_edge('calibrator', 'scout')
    builder.add_edge('scout', 'advocate')
    builder.add_edge('advocate', 'editor_gate_1')
    builder.add_edge('editor_gate_1', 'researcher')

    # Fan-out: 7 parallel writers
    for writer in ('origin_story', 'problem', 'founder_bio',
                   'case_study', 'game', 'bonus', 'design'):
        builder.add_edge('researcher', writer)
        builder.add_edge(writer, 'validate_sections')  # fan-in

    # Sequential post-fan-in
    builder.add_edge('validate_sections', 'qa')
    builder.add_edge('qa', 'editor_final')
    builder.add_edge('editor_final', 'publisher')
    builder.add_edge('publisher', END)

    return builder.compile(checkpointer=checkpointer)
```

**Why this works without reducers:** Each writer node mutates a *different* TypedDict field (`origin_story`, `problem_statement`, etc.). LangGraph's default merge semantics is "field-wise overwrite — last writer wins per field." Because the 7 writers never write to the same field, there is no race; LangGraph merges all 7 updates into the state cleanly. The `validate_sections` node receives the merged state.

**When you'd need `Annotated[list, operator.add]`:** Only if two parallel nodes both append to the same list field. Phase 4 doesn't have this. Document this for Phase 5 in case parallel writers ever co-write to (e.g.) a shared `qa_corrections` list.

**Source:** [LangGraph graph API — branching](https://docs.langchain.com/oss/python/langgraph/use-graph-api), [Best practices for parallel nodes (fanouts)](https://forum.langchain.com/t/best-practices-for-parallel-nodes-fanouts/1900)

**Pattern B — `Send` API (only if dynamic):** If the number of writers were data-driven (e.g. "spawn one writer per scout candidate"), use `Send` with a conditional edge. Phase 4 has a fixed 7 — use Pattern A.

### Pattern 5: The `@agent_node` wrapper decorator (D-15 — STABLE CONTRACT INTO PHASE 5)

```python
# src/eisenbalm_pipeline/agents/_wrapper.py
import functools
import time
from typing import Any, Awaitable, Callable, Optional
import logging
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.lib.cost import record_cost
from eisenbalm_pipeline.graph.state import DispatchState

log = logging.getLogger(__name__)


def agent_node(
    *,
    name: str,
    emit_event: Optional[str] = None,
    payload_builder: Optional[Callable[[DispatchState], dict]] = None,
    max_tool_calls: Optional[int] = None,  # stored on the function; enforced in Phase 5
):
    """Wraps an agent body with try/except + Convex event emission + cost recording.

    Phase 5 only replaces the body of `fn`; the decorator stays untouched.
    """
    def decorator(fn: Callable[[DispatchState], Awaitable[DispatchState]]):
        fn._max_tool_calls = max_tool_calls   # noqa: SLF001 — Phase 5 reads this

        @functools.wraps(fn)
        async def wrapped(state: DispatchState) -> DispatchState:
            start = time.monotonic()
            run_id = state['run_id']
            # Stub-mode test toggle (D-37) — fails this agent if matched
            if state.get('_force_fail_agent') == name:
                err = RuntimeError(f'Forced failure for testing: {name}')
                await convex_mutation_safe('pipelineRuns:updateStatus', {
                    'runId': run_id,
                    'status': 'failed',
                    'completedAt': int(time.time() * 1000),
                    'errorMessage': f'{name}: RuntimeError: {err}',
                })
                raise err

            try:
                new_state = await fn(state)
                duration_ms = int((time.monotonic() - start) * 1000)

                if emit_event:
                    payload = payload_builder(new_state) if payload_builder else {}
                    await convex_mutation_safe('deliberationEvents:insert', {
                        'runId': run_id,
                        'agentId': name,
                        'eventType': emit_event,
                        'payload': __import__('json').dumps(payload),
                    })

                record_cost(run_id, name, tokens_in=0, tokens_out=0, usd=0.0,
                            duration_ms=duration_ms)
                return new_state

            except Exception as e:
                await convex_mutation_safe('pipelineRuns:updateStatus', {
                    'runId': run_id,
                    'status': 'failed',
                    'completedAt': int(time.time() * 1000),
                    'errorMessage': f'{name}: {type(e).__name__}: {e}',
                })
                raise  # propagate so LangGraph checkpoints the failure
        return wrapped
    return decorator
```

**Note:** `convex_mutation_safe` is a try/except wrapper around the raw `convex_mutation` — it logs and swallows errors per D-20 (Convex failures are non-blocking).

### Anti-Patterns to Avoid

- **Calling `interrupt()` inside `try/except`:** LangGraph 1.x uses an exception-based mechanism for `interrupt()`. Wrapping it in `try/except` (especially bare `except:`) silently breaks resume. (Sharp edge in STACK.md §"Sharp Edges" #3.)
- **Doing non-idempotent work BEFORE `interrupt()`:** The node re-runs from the top on resume. `convex_mutation('pipelineRuns:updateStatus', {'status': 'awaiting-review'})` is idempotent (it's an upsert on the row). `convex_mutation('pitchLog:insert', {...})` is NOT — running it twice creates duplicate rows. Phase 4's Editor gate 1 must only do idempotent writes before `interrupt()`.
- **Compiling the graph per request:** Compile once in `lifespan` and store on `app.state.graph`. Re-compile is expensive (graph wiring) and forces a new checkpointer instance which would fight the lifespan-owned one.
- **Constructing `AsyncPostgresSaver` per request:** Same reason. Lifespan-owned.
- **`async with AsyncPostgresSaver.from_conn_string(...) as cp:` in lifespan:** This works but ties checkpointer to a single connection (the async context manager owns it). Use `AsyncConnectionPool` + `AsyncPostgresSaver(pool)` for proper pooling. (Pattern 1 above.)
- **Pointing `SUPABASE_POSTGRES_URL` at the transaction pooler (port 6543):** Breaks AsyncPostgresSaver on first checkpoint read. Use session pooler (port 5432, `aws-0-<region>.pooler.supabase.com`).
- **Forgetting to mark `pipelineRuns:create` BEFORE `graph.ainvoke`:** If the graph blows up in Calibrator, the wrapper writes `status='failed'` but the row doesn't exist yet → `updateStatus` mutation throws "Run not found" (per `pipelineRuns.ts:45`). The CREATE must happen in the FastAPI handler before the background task is launched. (Already correct in Pattern 3 above.)
- **Using `request.app.state.background_tasks: list` instead of `set`:** Lists don't have O(1) `discard`; the `add_done_callback(set.discard)` pattern is the canonical strong-ref idiom from the Python docs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Postgres-backed checkpointer | Custom SQL schema + serializer | `AsyncPostgresSaver` from `langgraph-checkpoint-postgres` | LangGraph encodes the checkpoint schema; building your own = re-implementing the entire interrupt/resume protocol |
| Human-in-the-loop pause/resume | Custom queue + database flag | `interrupt()` + `Command(resume=...)` | The exception-based interrupt mechanism is wired through the checkpointer; rolling your own loses the "resume from interrupt point" semantics |
| Portable Text serialization | Manual block construction | `text_to_portable_text()` from API_CONTRACTS §2.4 | Schema-strict format with required `_key` UUIDs; manual construction silently produces malformed blocks that render as blank in Sanity Studio |
| Charity slug generation | `re.sub` regex roll-your-own | `python-slugify` (D-04) | Handles unicode, multiple normalizers; deterministic across runs |
| Convex HTTP wrapper | Per-mutation httpx calls | `convex_mutation(path, args)` helper | Centralizes auth header, base URL, error envelope parsing |
| Sanity HTTP wrapper | Per-doc httpx calls | `write_charity` / `write_issue_draft` helpers in `lib/sanity_client.py` | Centralizes auth header, api-version path, mutations array structure |
| Long-running coroutine outside request | Threading or Celery for Phase 4 | `asyncio.create_task` + `app.state` set | Adds dependency for no benefit; recovery is via the checkpoint, not a queue |
| Per-request graph compilation | `build_graph()` inside the route handler | Lifespan-owned compiled graph in `app.state.graph` | LangGraph compilation is expensive (graph wiring, edge validation); doing it 1× per process is the standard pattern |

**Key insight:** LangGraph + AsyncPostgresSaver is a **complete** solution to durable agent orchestration with human gates. Phase 4's job is to thread runId discipline through the three datastores and not get cute. Don't invent any new abstractions beyond the `@agent_node` decorator and the two HTTP wrappers — the framework gives you the rest.

## Runtime State Inventory

> **N/A** — Phase 4 is greenfield (Python project creation + Railway service provisioning). No existing runtime state, OS-registered tasks, or live service config is renamed or migrated. The only "external state" Phase 4 introduces is the Supabase Postgres tables created by `checkpointer.setup()` — and Phase 4 is the *creator*, not a migrator. Skip this section.

Confirmed by category:
- **Stored data:** Phase 4 CREATES the LangGraph checkpoint tables (`checkpoints`, `checkpoint_writes`, etc.) via `setup()`. Phase 4 also CREATES stub Sanity drafts at `issue-999`. No pre-existing data to migrate.
- **Live service config:** Phase 4 creates a new Railway service. No existing service is reconfigured.
- **OS-registered state:** None. Railway is the orchestrator.
- **Secrets / env vars:** All NEW (`SUPABASE_POSTGRES_URL`, `OPENROUTER_API_KEY`, `TAVILY_API_KEY`, `SANITY_API_TOKEN`, `EISENBALM_STUB_MODE`, `PIPELINE_TRIGGER_SECRET`). No renames. Phase 3's `CONVEX_DEPLOY_KEY` and Phase 1's `NEXT_PUBLIC_SANITY_PROJECT_ID` are re-used unchanged.
- **Build artifacts:** Phase 4 produces `uv.lock` (NEW, committed). Phase 1's `packages/pipeline/package.json` placeholder stays so pnpm-workspace.yaml still discovers the directory. The `tsconfig.json` placeholder is DELETED (CONTEXT.md mentions this).

## Common Pitfalls

### Pitfall 1: Supabase transaction pooler (port 6543) breaks `AsyncPostgresSaver`

**What goes wrong:** AsyncPostgresSaver uses prepared statements (via psycopg) for checkpoint reads/writes. The transaction pooler does not support prepared statements. On the second checkpoint read of a given prepared-statement name, you get:
```
psycopg.errors.InvalidSqlStatementName: prepared statement "__psycopg_pq3_1" does not exist
```
or
```
psycopg.OperationalError: prepared statement '__asyncpg_stmt_1__' already exists
```

**Why it happens:** The transaction pooler returns connections to the pool after each transaction. A prepared statement created on connection A may not exist when connection B is handed out for the next query.

**How to avoid:**
1. **Primary fix:** Use the **session pooler** instead. Host: `aws-0-<region>.pooler.supabase.com`, port `5432`. Session pooler holds a connection for the duration of the client session — prepared statements survive. Also supports IPv4 (Railway-compatible).
2. **Defensive fix (recommended IN ADDITION):** Configure psycopg to skip prepared statements regardless of which pooler is targeted:
   ```python
   pool = AsyncConnectionPool(
       conninfo=DB_URI,
       kwargs={
           'autocommit': True,
           'prepare_threshold': None,    # disable prepared statements
           'row_factory': dict_row,
       },
   )
   ```
3. **Doc the env var format in `packages/pipeline/.env.example`:**
   ```
   # CORRECT — session pooler, IPv4-compatible, supports prepared statements
   SUPABASE_POSTGRES_URL=postgres://postgres.<projectref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   
   # WRONG — transaction pooler, breaks prepared statements
   # SUPABASE_POSTGRES_URL=postgres://postgres:...@db.<projectref>.supabase.co:6543/postgres
   ```

**Warning signs:** First `/run/weekly` works; second errors with `InvalidSqlStatementName`; or resume after restart fails immediately with the same error.

**Sources:** [GitHub langgraph discussion #2967](https://github.com/langchain-ai/langgraph/discussions/2967), [Supabase Connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase: Disabling prepared statements](https://supabase.com/docs/guides/troubleshooting/disabling-prepared-statements-qL8lEL)

### Pitfall 2: Supabase direct connection is IPv6-only; Railway egress is IPv4-only

**What goes wrong:** If `SUPABASE_POSTGRES_URL` targets the direct connection (`db.<ref>.supabase.co:5432`), the deployed app hangs on connect with `ENETUNREACH (IPv6)`. Works locally on most ISPs; breaks on Railway.

**Why it happens:** Railway has documented no outbound IPv6 support. Supabase's direct connection host resolves to an IPv6 AAAA record only (unless you pay $4/mo for the IPv4 add-on).

**How to avoid:** Use the session pooler URL (Pitfall 1) which is dual-stack. Do not buy the IPv4 add-on unless absolutely necessary.

**Warning signs:** App boot succeeds locally but `lifespan` hangs forever on Railway. Logs show `awaiting db connection`.

**Sources:** [Supabase IPv4 add-on FAQ](https://supabase.com/docs/guides/troubleshooting/enabling-ipv4-addon), [Railway IPv6 outbound discussion](https://station.railway.com/questions/ipv6-outbound-38c621c0)

### Pitfall 3: Running `checkpointer.setup()` on every app start

**What goes wrong:** `setup()` runs DDL — `CREATE TABLE IF NOT EXISTS` etc. — and acquires advisory locks. Running it on every container start (including in parallel workers) is wasteful and occasionally races. Phase 4 D-12 forbids this.

**How to avoid:** Move `setup()` into a CLI subcommand:
```python
# src/eisenbalm_pipeline/cli.py
import asyncio
import os
import sys
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver


async def setup_checkpointer():
    db_url = os.environ['SUPABASE_POSTGRES_URL']
    async with AsyncPostgresSaver.from_conn_string(db_url) as cp:
        await cp.setup()
        print('Checkpointer tables created / verified.')


def main():
    if len(sys.argv) < 2 or sys.argv[1] != 'setup-checkpointer':
        print('Usage: python -m eisenbalm_pipeline.cli setup-checkpointer')
        sys.exit(1)
    asyncio.run(setup_checkpointer())


if __name__ == '__main__':
    main()
```

Wire as Railway `preDeployCommand` so it runs once per deploy (or have Andrew invoke `railway run python -m eisenbalm_pipeline.cli setup-checkpointer` manually per D-29/D-30). On app startup, the lifespan asserts the tables exist (Pattern 1) and fails fast with a clear error if not — never auto-creates.

### Pitfall 4: `BackgroundTasks` cancellation on client disconnect

**What goes wrong:** Starlette's `BackgroundTasks` are part of the response lifecycle. If the client (curl, integration test) hangs up after receiving `{runId}` but before the BackgroundTask schedules, the task may be cancelled. For a 30-second stub run this is usually fine; for an `interrupt()`-paused indefinite run it's irrelevant (the graph state is in the checkpoint). But for FAILURE cases (Calibrator exception 5 seconds in), if the client has disconnected, the failure-handling Convex write may not happen — `pipelineRuns.status` stays at `'running'` forever.

**How to avoid:** Per CONTEXT D-06, plan uses `BackgroundTasks`. Acceptable IF:
- The plan documents that `pipelineRuns.status = 'running'` after 5+ minutes is a stale-state indicator
- The `GET /run/{runId}/status` endpoint exists for polling
- A future Phase 5+ "watchdog" can mark stale runs `failed`

**Stronger recommendation (Claude's discretion per CONTEXT):** Use `asyncio.create_task` per Pattern 3. Then the task survives client disconnect; the lifespan's strong-ref set prevents GC; and the checkpoint is the recovery mechanism for SIGKILL events.

**Sources:** [FastAPI background tasks cancellation discussion](https://github.com/fastapi/fastapi/discussions/8805), [Python Background Tasks — Asyncio Traps](https://dev.to/kaushikcoderpy/python-background-tasks-asyncio-traps-fastapi-celery-2026-381i)

### Pitfall 5: Sanity HTTP API rejects the document if `_id` already exists with a DIFFERENT `_type`

**What goes wrong:** The stub run writes `issue-999` as a `weeklyIssue`. If Andrew (or a prior test) accidentally created a `charity` document with `_id == 'issue-999'`, the `createOrReplace` mutation fails with `409 Conflict`.

**How to avoid:** Use a stub `issue_number` of `999` (CONTEXT D-16) which is unlikely to collide. Integration tests should also delete the draft on tearDown to keep the dataset clean.

### Pitfall 6: Sanity `pipelineMetadata.runId` is `null` after the draft write

**What goes wrong:** The httpx call writes the document, but the field is absent — usually because the JSON payload structure put `runId` at the wrong nesting level.

**How to avoid:** Match the schema exactly:
```json
{
  "_id": "issue-999",
  "_type": "weeklyIssue",
  "pipelineMetadata": {
    "runId": "abc123...",
    "startedAt": "2026-05-14T10:00:00Z",
    ...
  }
}
```
`pipelineMetadata` is an object (not a string). `runId` is a sibling of `startedAt` inside it. PIP-06 integration test catches this if it fires.

### Pitfall 7: Convex error envelope `{status: "error", errorMessage: ...}` returns HTTP 200

**What goes wrong:** `httpx.HTTPStatusError` is not raised on Convex validator failures — Convex returns 200 with `{"status": "error", "errorMessage": "..."}`. Phase 4 wrapper that only checks `response.status_code` silently swallows mutation failures.

**How to avoid:** In `convex_client.py`:
```python
async def convex_mutation(http: AsyncClient, path: str, args: dict) -> dict:
    r = await http.post(
        '/api/mutation',
        json={'path': path, 'args': args, 'format': 'json'},
        headers={
            'Content-Type': 'application/json',
            'Authorization': f"Convex {os.environ['CONVEX_DEPLOY_KEY']}",
        },
    )
    r.raise_for_status()  # catches 4xx/5xx
    body = r.json()
    if body.get('status') != 'success':
        raise RuntimeError(f"Convex mutation failed: {path} → {body.get('errorMessage')}")
    return body.get('value')
```

**Sources:** [Convex HTTP API docs](https://docs.convex.dev/http-api/)

## Code Examples

### Example 1: `interrupt()` in Editor gate 1 + `Command(resume)` from `/resume` endpoint

```python
# src/eisenbalm_pipeline/agents/editor.py
import time
from langgraph.types import interrupt
from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.graph.state import DispatchState


def _editor_decision_payload(state: DispatchState) -> dict:
    return {
        'winner': state['winning_charity']['name'],
        'rationale': state['editor_decision'],
    }


@agent_node(name='editor', emit_event='editor-decision',
            payload_builder=_editor_decision_payload)
async def editor_gate_1(state: DispatchState) -> DispatchState:
    candidates = state['candidates']

    # IDEMPOTENT block — anything here re-runs on resume. Safe operations only.
    no_clear_winner = state.get('_force_no_winner', False) or (
        max((c.get('advocateScore') or 0) for c in candidates) < 6
    )

    if no_clear_winner:
        # IDEMPOTENT: updateStatus is an upsert by runId.
        await convex_mutation_safe('pipelineRuns:updateStatus', {
            'runId': state['run_id'],
            'status': 'awaiting-review',
        })

        # SUSPEND. The graph state at this point is persisted to Postgres.
        # The node will re-run from the top on resume; the value passed to
        # Command(resume=...) becomes the return value of interrupt() this
        # second time around.
        human_input = interrupt({
            'reason': 'no-clear-winner',
            'candidates': [c['name'] for c in candidates],
        })

        # IMPORTANT: code below runs on the SECOND invocation only.
        # The above 'awaiting-review' mutation will fire AGAIN on the second
        # invocation, but it's a no-op upsert — safe.
        selected_name = human_input['editorSelection']
        winning = next(c for c in candidates if c['name'] == selected_name)

        # Now resume "running" status
        await convex_mutation_safe('pipelineRuns:updateStatus', {
            'runId': state['run_id'],
            'status': 'running',
        })
    else:
        winning = max(candidates, key=lambda c: c['advocateScore'])

    # Common path (no-winner and clear-winner both arrive here)
    return {
        **state,
        'winning_charity': winning,
        'editor_decision': f"Selected {winning['name']} (advocate score "
                           f"{winning.get('advocateScore', 'manual')})",
        'runner_up_notes': ', '.join(
            f"{c['name']} ({c.get('advocateScore', '-')})"
            for c in candidates if c['name'] != winning['name']
        ),
    }
```

```python
# src/eisenbalm_pipeline/api/runs.py (continued from Pattern 3)
from langgraph.types import Command
from pydantic import BaseModel


class ResumeBody(BaseModel):
    selection: dict   # {'charityName': str}


@router.post('/run/{run_id}/resume')
async def resume_run(request: Request, run_id: str, body: ResumeBody):
    if request.headers.get('X-Pipeline-Trigger-Secret') != os.environ['PIPELINE_TRIGGER_SECRET']:
        raise HTTPException(status_code=401, detail='Invalid trigger secret')

    config = {'configurable': {'thread_id': run_id}}

    # Verify the thread actually exists AND is interrupted.
    state = await request.app.state.graph.aget_state(config)
    if not state or not state.next:
        raise HTTPException(
            status_code=409,
            detail=f"Run {run_id} is not paused (state.next is empty)",
        )

    resume_payload = {'editorSelection': body.selection['charityName']}

    async def _resume_run():
        try:
            await request.app.state.graph.ainvoke(
                Command(resume=resume_payload),
                config=config,
            )
        except Exception:
            pass  # wrapper decorator already wrote 'failed' to Convex

    task = asyncio.create_task(_resume_run())
    request.app.state.background_tasks.add(task)
    task.add_done_callback(request.app.state.background_tasks.discard)

    return {'runId': run_id, 'resumed': True}
```

**Source:** [LangGraph interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts), [LangGraph wait-user-input how-to](https://medium.com/@areebahmed575/langgraphs-interrupt-function-the-simpler-way-to-build-human-in-the-loop-agents-faef98891a92)

### Example 2: Convex `convex_mutation` wrapper

```python
# src/eisenbalm_pipeline/lib/convex_client.py
import json
import logging
import os
from typing import Any
from httpx import AsyncClient, HTTPStatusError
from fastapi import Request

log = logging.getLogger(__name__)


async def convex_mutation(http: AsyncClient, path: str, args: dict) -> Any:
    """Call a Convex mutation. Raises on HTTP error OR Convex validator error.

    path: e.g. 'pipelineRuns:create'
    """
    r = await http.post(
        '/api/mutation',
        json={'path': path, 'args': args, 'format': 'json'},
        headers={
            'Content-Type': 'application/json',
            'Authorization': f"Convex {os.environ['CONVEX_DEPLOY_KEY']}",
        },
    )
    r.raise_for_status()
    body = r.json()
    if body.get('status') != 'success':
        raise RuntimeError(
            f"Convex mutation failed: path={path} args={args} "
            f"err={body.get('errorMessage')}"
        )
    return body.get('value')


async def convex_mutation_safe(path: str, args: dict) -> None:
    """Fire-and-forget variant per D-20: Convex failures log + continue.

    Reads the shared httpx client from the FastAPI app state via a contextvar
    OR — simpler — pass `http` in as the first arg from agent code.
    For Phase 4, use a module-level singleton client (D-33).
    """
    try:
        await convex_mutation(_CLIENT, path, args)
    except Exception as e:
        log.warning('convex_mutation_safe failed: %s %s — %r', path, args, e)


# Module-level shared client — created in lifespan, stored here too
_CLIENT: AsyncClient | None = None


def set_client(client: AsyncClient) -> None:
    global _CLIENT
    _CLIENT = client


async def convex_query(http: AsyncClient, path: str, args: dict) -> Any:
    """For PIP-06 integration test cleanup + GET /run/{runId}/status."""
    r = await http.post(
        '/api/query',
        json={'path': path, 'args': args, 'format': 'json'},
        headers={
            'Content-Type': 'application/json',
            'Authorization': f"Convex {os.environ['CONVEX_DEPLOY_KEY']}",
        },
    )
    r.raise_for_status()
    body = r.json()
    if body.get('status') != 'success':
        raise RuntimeError(f"Convex query failed: {path} → {body.get('errorMessage')}")
    return body.get('value')
```

**Source:** [Convex HTTP API docs](https://docs.convex.dev/http-api/)

### Example 3: Sanity write via raw `httpx` (no SDK)

```python
# src/eisenbalm_pipeline/lib/sanity_client.py
import json
import os
from typing import Any
from httpx import AsyncClient

PROJECT_ID = os.environ['NEXT_PUBLIC_SANITY_PROJECT_ID']
DATASET = os.environ.get('NEXT_PUBLIC_SANITY_DATASET', 'production')
API_VERSION = 'v2024-01-01'


def _auth_headers() -> dict[str, str]:
    return {
        'Authorization': f"Bearer {os.environ['SANITY_API_TOKEN']}",
        'Content-Type': 'application/json',
    }


async def write_charity(http: AsyncClient, charity: dict) -> str:
    """Idempotent createOrReplace for a charity document. Returns _id."""
    from slugify import slugify
    slug = slugify(charity['name'])
    doc_id = f'charity-{slug}'

    doc = {
        '_type': 'charity',
        '_id': doc_id,
        'name': charity['name'],
        'slug': {'_type': 'slug', 'current': slug},
        'location': charity['location'],
        'website': charity.get('website', ''),
        'charityNavigatorUrl': charity.get('charityNavigatorUrl'),
        'guidestarUrl': charity.get('guidestarUrl'),
        'foundingYear': charity.get('foundingYear'),
        'assetRange': charity.get('assetRange', ''),
        'focusArea': charity.get('focusArea', ''),
        'missionStatement': charity.get('missionStatement', ''),
        'scoutNotes': charity.get('scoutSummary', ''),
    }
    # Strip None-valued keys; Sanity accepts them but it pollutes the doc.
    doc = {k: v for k, v in doc.items() if v is not None}

    r = await http.post(
        f'/{API_VERSION}/data/mutate/{DATASET}',
        json={'mutations': [{'createOrReplace': doc}]},
        headers=_auth_headers(),
    )
    r.raise_for_status()
    return doc_id


async def write_issue_draft(http: AsyncClient, state: dict) -> str:
    """One write at pipeline end. See API_CONTRACTS §2.2 for the full doc shape."""
    issue_id = f"issue-{state['issue_number']}"
    doc = _build_issue_doc(state, issue_id)  # See API_CONTRACTS §2.2 verbatim
    r = await http.post(
        f'/{API_VERSION}/data/mutate/{DATASET}',
        json={'mutations': [{'createOrReplace': doc}]},
        headers=_auth_headers(),
    )
    r.raise_for_status()
    return issue_id


async def upload_pdf_to_issue(
    http: AsyncClient, issue_id: str, pdf_bytes: bytes, issue_number: int,
) -> None:
    """Phase 6 contract — Phase 4 ships the stub that records a placeholder URL."""
    filename = f'dispatch-issue-{issue_number}-problem-statement.pdf'

    # 1) Upload the binary
    r = await http.post(
        f'/{API_VERSION}/assets/files/{DATASET}',
        params={'filename': filename},
        content=pdf_bytes,
        headers={
            'Authorization': f"Bearer {os.environ['SANITY_API_TOKEN']}",
            'Content-Type': 'application/pdf',
        },
    )
    r.raise_for_status()
    asset_id = r.json()['document']['_id']

    # 2) Patch the issue to reference the asset
    r = await http.post(
        f'/{API_VERSION}/data/mutate/{DATASET}',
        json={'mutations': [{
            'patch': {
                'id': issue_id,
                'set': {
                    'problemPdf': {
                        '_type': 'file',
                        'asset': {'_type': 'reference', '_ref': asset_id},
                    }
                }
            }
        }]},
        headers=_auth_headers(),
    )
    r.raise_for_status()
```

**Sources:** [Sanity Mutation API reference](https://www.sanity.io/docs/http-reference/mutation), [Sanity Assets API reference](https://www.sanity.io/docs/http-reference/assets)

### Example 4: pytest integration test (PIP-06)

```python
# tests/test_pipeline_e2e.py
import os
import time
import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from eisenbalm_pipeline.api.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://test') as c:
        yield c


@pytest.mark.asyncio
async def test_pipeline_e2e_runId_threaded_to_all_datastores(client):
    issue_number = 999000 + (int(time.time()) % 100000)   # cheap unique-ish

    # 1. Trigger
    r = await client.post(
        '/run/weekly',
        json={'issueNumber': issue_number},
        headers={'X-Pipeline-Trigger-Secret': os.environ['PIPELINE_TRIGGER_SECRET']},
    )
    assert r.status_code == 200
    run_id = r.json()['runId']
    assert len(run_id) == 32  # uuid4().hex

    # 2. Poll
    for _ in range(60):  # 30s @ 0.5s
        r = await client.get(f'/run/{run_id}/status')
        status = r.json().get('status')
        if status in ('awaiting-review', 'complete', 'failed'):
            break
        await asyncio.sleep(0.5)
    assert status == 'awaiting-review'

    # 3. Assert Sanity draft
    sanity_doc = await _fetch_sanity_issue(issue_number)
    assert sanity_doc['pipelineMetadata']['runId'] == run_id

    # 4. Assert every Convex table has rows with matching runId
    for table_query in [
        'pipelineRuns:byRunId',
        'pitchLog:byRunId',
        'deliberationEvents:byRunId',
        'agentVotes:byRunId',
        'qaCorrections:byRunId',
    ]:
        rows = await _convex_query(table_query, {'runId': run_id})
        # pipelineRuns returns a single doc; others return list
        if isinstance(rows, list):
            for row in rows:
                assert row['runId'] == run_id
        elif rows is not None:
            assert rows['runId'] == run_id

    # 5. Cleanup — delete Sanity draft + Convex rows
    await _cleanup(issue_number, run_id)
```

**Source:** [FastAPI async tests](https://fastapi.tiangolo.com/advanced/async-tests/)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LangGraph `breakpoint` / `NodeInterrupt` | `interrupt()` + `Command(resume=...)` | LangGraph 1.0 (2024-Q4) | Anywhere using legacy breakpoints will silently break on 1.x |
| `MemorySaver` for dev | `AsyncPostgresSaver` + Supabase | 2024+ (PIP-09 mandates) | Cannot ship Phase 4 with MemorySaver — interrupt won't survive restart |
| Sanity Python SDK | Direct httpx against REST API | Always (no maintained SDK) | API_CONTRACTS §2 already encodes |
| `BackgroundTasks` for "long" work | `asyncio.create_task` with strong-ref set | 2025+ (FastAPI community shift) | BackgroundTasks acceptable only for < 1s post-response work |
| psycopg2 default | psycopg3 (>=3.2) | 2024+ | langgraph-checkpoint-postgres requires it |
| Supabase 6543 pooler | Session pooler 5432 (`aws-0-<region>.pooler.supabase.com`) | 2025-02-28 (transaction pooler-on-6543 limitations clarified) | Transaction pooler still useful for serverless; not for stateful LangGraph apps |

**Deprecated / outdated:**
- `try/except interrupt()` patterns from older LangGraph 0.x examples — break on 1.x
- The `langchain_postgres.checkpoint.PostgresSaver` module (in `langchain-postgres` package, not `langgraph-checkpoint-postgres`) — separate package, different shape, not what Phase 4 uses
- `--use-cdn=true` for write-side Sanity clients — writes always bypass CDN; the flag is read-only context

## Open Questions

1. **Should the Editor gate 1 `interrupt()` payload include the full deliberation transcript?**
   - What we know: The interrupt value must be JSON-serializable (sharp edge in STACK §3).
   - What's unclear: Whether the planner wants Andrew to see Scout summaries + Advocate arguments in the interrupt payload, or just candidate names.
   - Recommendation: Phase 4 stub passes `{'reason': 'no-clear-winner', 'candidates': [list of names]}` only — keep the payload minimal. Phase 5 (real Editor) can enrich.

2. **`pipelineRuns:updateStatus` mutation argument validators after the D-39 patch — does Convex accept `cost` as `v.optional(v.string())` even though the JSON content is structured?**
   - What we know: Convex schemas evolve forward-compatibly. The mutation signature must accept the new args.
   - What's unclear: Whether the schema patch needs *both* the table field (`pipelineRuns.cost`) AND the mutation's arg validator extended — yes, both. The plan must call out both edits.
   - Recommendation: Plan diff includes both `convex/schema.ts` AND `convex/pipelineRuns.ts` changes, plus the `pnpm --filter @eisenbalm/convex deploy` redeploy step.

3. **Does Phase 4 need a `_force_no_winner` toggle in `DispatchState`, or should it live outside the contract?**
   - What we know: API_CONTRACTS §7 is the locked state contract. Adding test-only fields could pollute it.
   - What's unclear: Whether the test toggle should be a top-level field, a nested `_test_options` object, or live on the FastAPI request body and propagate through the orchestrator's initial state.
   - Recommendation: Use **underscore-prefixed** fields (`_force_no_winner`, `_force_fail_agent`) in DispatchState. They're clearly test-only; agents check and ignore. The contract is API_CONTRACTS §7's *production fields*; the underscore convention signals "non-canonical, may not be persisted." This avoids re-writing DispatchState for testing.

## Environment Availability

Phase 4 introduces new external dependencies. Audit:

| Dependency | Required By | Available locally | Fallback |
|------------|------------|-------------------|----------|
| Python 3.11 | All pipeline code | ✓ (assume present; Andrew installs via pyenv if not) | None — required |
| `uv` | All pipeline tooling | ✓ Easy install (`curl -LsSf https://astral.sh/uv/install.sh \| sh`) | `pip install uv` from system Python |
| Docker | Local Dockerfile builds (optional — Railway builds remote) | ✓ for engineers; Andrew may not have it | Railway builds remotely from pushed Dockerfile — no local Docker required |
| Railway CLI | Manual provisioning (D-29) | ✓ Installable via `npm i -g @railway/cli` | Andrew can use Railway web UI |
| Supabase project | Postgres for checkpointer | ✗ — must be created (D-30) | None — required |
| Railway project | Pipeline hosting | ✗ — must be created (D-29) | None — required |
| Sanity production dataset | Stub draft write target | ✓ (Phase 1 D-15 — production) | None |
| Convex deployment | Mutation target | ✓ (Phase 3 D-02) | None |
| OpenRouter API key | Real agents only | ✗ in stub mode — placeholder in .env.example | Stub mode bypasses |
| Tavily API key | Real Scout only | ✗ in stub mode — placeholder | Stub mode bypasses |

**Missing dependencies with no fallback:**
- Supabase project + Railway project: both must be provisioned by Andrew (D-29/D-30) — the plan documents the steps; phase cannot deploy without them.

**Missing dependencies with fallback:**
- OpenRouter / Tavily keys: defer to Phase 5; placeholders in `.env.example` satisfy CONTEXT D-31.

## Validation Architecture

(Phase 4 has `workflow.nyquist_validation: true` in `.planning/config.json` — including this section.)

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `pytest` (>=8.3) + `pytest-asyncio` (>=0.24) |
| Config file | `packages/pipeline/pyproject.toml` `[tool.pytest.ini_options]` section |
| Quick run command | `cd packages/pipeline && uv run pytest -x` |
| Full suite command | `cd packages/pipeline && uv run pytest -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PIP-01 | Dockerfile builds | smoke | `docker build -t pipeline packages/pipeline/` (manual / Railway logs) | ❌ Wave 0 — depends on Andrew Docker availability; Railway CI build is the canonical check |
| PIP-02 | `POST /run/weekly` returns `{runId}` | integration | `uv run pytest tests/test_pipeline_e2e.py::test_returns_runId` | ❌ Wave 0 |
| PIP-03 | LangGraph runs all 14 nodes in sequence | integration | Same as PIP-06 (asserts via deliberationEvents agentIds) | ❌ Wave 0 |
| PIP-04 | Each agent stub returns structurally valid DispatchState | unit | `uv run pytest tests/agents/test_stub_fixtures.py` | ❌ Wave 0 — one test per agent asserting TypedDict shape |
| PIP-05 | runId generated once, threaded everywhere | integration | Covered by PIP-06 | ❌ Wave 0 |
| PIP-06 | Sanity `pipelineMetadata.runId == every Convex row's runId` | integration (e2e) | `uv run pytest tests/test_pipeline_e2e.py` | ❌ Wave 0 — the headline test |
| PIP-07 | Complete `weeklyIssue` draft written, deterministic charity `_id` | integration | Covered by PIP-06 + assertion on `_id == 'issue-{n}'` and `charity` ref | ❌ Wave 0 |
| PIP-08 | Convex writes for every event type | integration | `uv run pytest tests/test_pipeline_e2e.py::test_all_event_types_emitted` | ❌ Wave 0 |
| PIP-09 | AsyncPostgresSaver checkpoint persists; setup() one-time | unit | `uv run pytest tests/test_checkpointer.py::test_setup_idempotent` | ❌ Wave 0 |
| PIP-10 | Editor gate 1 interrupt → awaiting-review → resume → complete | integration | `uv run pytest tests/test_editor_gate_1_resume.py` | ❌ Wave 0 |
| PIP-11 | `pipelineRuns.cost` populated (0s in stub) | integration | `uv run pytest tests/test_pipeline_e2e.py::test_cost_shape` | ❌ Wave 0 |
| PIP-12 | `pipelineRuns.durationMs` > 0 | integration | `uv run pytest tests/test_pipeline_e2e.py::test_duration_ms` | ❌ Wave 0 |
| OPS-01 | Failed run writes `failed` + agentId + errorMessage | integration | `uv run pytest tests/test_agent_failure.py` | ❌ Wave 0 |
| OPS-02 | `GET /run/{runId}/status` returns current state | integration | `uv run pytest tests/test_status_endpoint.py` | ❌ Wave 0 |
| OPS-03 | Cost JSON visible on Sanity `pipelineMetadata.cost` | manual + integration | Sanity assertion in PIP-06 test + Andrew's smoke (D-42 step 5) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `uv run pytest -x` (fail-fast — earliest broken test halts)
- **Per wave merge:** `uv run pytest -v` (full local suite)
- **Phase gate (before `/gsd:verify-work`):** Full suite green AND Andrew's manual smoke test from D-42 succeeds (one curl + Sanity Studio + Convex dashboard check)

### Wave 0 Gaps

- [ ] `packages/pipeline/tests/conftest.py` — shared fixtures: `client` (`AsyncClient(transport=ASGITransport(app=app))`), env-loading, Convex test-cleanup helpers
- [ ] `packages/pipeline/tests/test_pipeline_e2e.py` — covers PIP-02, PIP-05, PIP-06, PIP-07, PIP-08, PIP-11, PIP-12
- [ ] `packages/pipeline/tests/test_editor_gate_1_resume.py` — covers PIP-10
- [ ] `packages/pipeline/tests/test_agent_failure.py` — covers OPS-01
- [ ] `packages/pipeline/tests/test_status_endpoint.py` — covers OPS-02
- [ ] `packages/pipeline/tests/test_checkpointer.py` — covers PIP-09
- [ ] `packages/pipeline/tests/agents/test_stub_fixtures.py` — covers PIP-04 (parametrize over all 14 agents)
- [ ] Framework install: `uv add --dev pytest 'pytest-asyncio>=0.24'`
- [ ] `pyproject.toml` `[tool.pytest.ini_options]` block: `asyncio_mode = "auto"`, `testpaths = ["tests"]`

**Minimum coverage to detect regressions:** PIP-06 (e2e) + PIP-10 (interrupt-resume) + OPS-01 (failure path) = three tests cover the three load-bearing axes (happy path, pause-resume, error path). Everything else is fine-grained verification of the same shape.

## Detailed Topic Walkthroughs

### §1 — LangGraph 1.1.10 + AsyncPostgresSaver + Supabase Postgres (THE CORE PATTERN)

**Verified package versions:**
- `langgraph==1.1.10` (CONTEXT D-04)
- `langgraph-checkpoint-postgres==3.1.0` (released 2026-05-12; requires Python ≥3.10) — **sub-dep that CONTEXT D-04 implies but doesn't pin; planner MUST add this to pyproject.toml**
- `psycopg[binary]>=3.2,<4` — required for `prepare_threshold` API

**Why version 3.x of `langgraph-checkpoint-postgres`?** LangGraph 1.x compatibility is in the 3.x line per the package's CHANGELOG. The 2.x line targeted LangGraph 0.x. Don't mix.

**Lifecycle pattern (FastAPI lifespan-owned, per Pattern 1 above):**

The `from_conn_string` style uses an async context manager that owns ONE connection. Phase 4 needs pooling for concurrent requests (and the integration test runs concurrent in-process), so the better pattern is `AsyncConnectionPool` + `AsyncPostgresSaver(pool)`.

**`checkpointer.setup()` semantics:**
- Idempotent — creates tables if they don't exist (uses `IF NOT EXISTS` patterns).
- Creates: `checkpoints`, `checkpoint_writes`, `checkpoint_blobs`, `checkpoint_migrations` tables (4 total) plus indexes.
- Acquires an advisory lock during DDL — safe under concurrent invocation but unnecessary.
- **Recommended execution:** One-time via `python -m eisenbalm_pipeline.cli setup-checkpointer` (D-12), invoked manually by Andrew (D-29) OR via Railway's `preDeployCommand` field in `railway.toml`.
- **Detecting "already set up":** Query `SELECT to_regclass('public.checkpoints')` — if non-null, tables exist (Pattern 1's lifespan assertion).

**Compile-time vs runtime:** Compile graph ONCE at startup with the checkpointer attached (Pattern 1). Reuse the compiled graph across all requests. Per-invocation, only the `config={'configurable': {'thread_id': run_id}}` changes.

**`thread_id` collision behavior:** If two concurrent `graph.ainvoke(initial, config={'thread_id': X})` calls share a `thread_id`, LangGraph treats them as the same conversation thread — writes interleave on the checkpoint and behavior is undefined. **Phase 4 must NEVER reuse a `run_id`** — D-09 already mandates fresh uuid4 per `/run/weekly`. Calling `/run/{runId}/resume` with the same `thread_id` is correct because resume is sequential after pause.

**Supabase connection string format (planner copies to `.env.example`):**
```
# SESSION POOLER (port 5432) — required for Railway IPv4 egress + prepared statements
SUPABASE_POSTGRES_URL=postgres://postgres.<projectref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

**Sources:** [langgraph-checkpoint-postgres PyPI](https://pypi.org/project/langgraph-checkpoint-postgres/), [Memory how-to](https://docs.langchain.com/oss/python/langgraph/add-memory)

---

### §2 — `interrupt()` + `Command(resume=...)` semantics in LangGraph 1.x

**Imports:**
```python
from langgraph.types import interrupt, Command
```

**Behavior when `interrupt()` is called inside an `ainvoke`:**
1. The node hits `interrupt(value)`.
2. LangGraph raises an internal `GraphInterrupt` exception caught by the runtime.
3. The current state (checkpoint) is written to Postgres.
4. `await graph.ainvoke(initial_state, config=config)` **RETURNS** a result dict that includes:
   - All state fields populated up to that point
   - A special `__interrupt__` key listing the interrupt values
   - (v2 API: `result.interrupts` is a tuple instead)
5. `ainvoke` does NOT block waiting for a resume. Control returns to your code.

**Detecting interrupt in result (Phase 4 doesn't need this — the wrapper in `_execute_run` doesn't inspect; Convex `awaiting-review` was already written inside the node BEFORE `interrupt()`):**
```python
result = await graph.ainvoke(initial_state, config=config)
if '__interrupt__' in result:
    # Graph paused. The node wrote 'awaiting-review' to Convex before pausing.
    # Nothing more to do here — wait for /resume.
    pass
```

**Resume call shape:**
```python
config = {'configurable': {'thread_id': run_id}}  # MUST match the original
result = await graph.ainvoke(
    Command(resume={'editorSelection': 'The Quiet Foundation'}),
    config=config,
)
```

**What `graph.ainvoke(Command(resume=...), ...)` does under the hood:**
1. Loads the latest checkpoint from Postgres for `thread_id == run_id`.
2. Identifies which node was suspended (the one that called `interrupt()`).
3. Re-runs that node from the top.
4. When the SAME `interrupt(...)` call is reached, it does NOT suspend again — instead, it RETURNS the value passed in `Command(resume=...)`.
5. The node continues to completion; the graph proceeds through subsequent edges.

**Idempotency requirement for code BEFORE `interrupt()`:** Critical. On resume, all code from the top of the node runs again. If you `INSERT` a row before `interrupt()`, you get duplicates. If you `updateStatus` (upsert), you're safe.

**Container restart behavior:**
- Container dies after `interrupt()` (e.g., Railway redeploy mid-pause).
- The checkpoint in Postgres is intact.
- New container starts up; lifespan rebuilds the graph (with the SAME checkpointer pointed at the SAME Postgres).
- A call to `POST /run/{runId}/resume` arrives.
- `graph.ainvoke(Command(resume=...), config={'thread_id': run_id})` does the load-and-replay correctly.
- The new process did not need to know anything about the previous process — the runId is the contract.

**Race conditions to plan for:**
- **`/resume` called BEFORE `interrupt()` is reached:** Use `graph.aget_state(config)` first; if `state.next` is empty (graph not paused), return 409. (Pattern shown in Example 1's resume endpoint.)
- **Two `/resume` calls for the same runId:** The first wins. The second observes `state.next` is empty (the graph has moved past) and returns 409. If they arrive truly concurrently, LangGraph's checkpoint write is the serialization point — one will succeed, the other will likely error on a stale checkpoint. **Mitigation:** rate-limit `/resume` (one in flight per runId) via an in-memory lock keyed by runId. Phase 4 may skip this — manual operation, unlikely to race — but the plan should note it for v2.
- **Resume payload shape mismatch:** If `Command(resume=value)` is passed and the interrupt expected a dict with `editorSelection` key but you pass a plain string, `human_input['editorSelection']` raises `KeyError` on the node's second pass. Pydantic-validate the `ResumeBody` shape.

**Sources:** [Interrupts — Docs by LangChain](https://docs.langchain.com/oss/python/langgraph/interrupts), [interrupt API reference](https://reference.langchain.com/python/langgraph/types/interrupt)

---

### §3 — `graph.ainvoke` vs `graph.astream` + FastAPI `BackgroundTasks` (cancellation sharp edge)

**`ainvoke` vs `astream`:**
- `ainvoke` returns the final state (single awaitable).
- `astream` is an async iterator yielding intermediate states.
- Phase 4 doesn't need streaming back to the client (`/run/weekly` returns immediately) — use `ainvoke`.

**Sharp edge — BackgroundTasks vs asyncio.create_task:**

| Aspect | `BackgroundTasks` | `asyncio.create_task` + `app.state` set |
|--------|-------------------|------------------------------------------|
| Survives client disconnect | **No** (cancelled with the response) | **Yes** |
| Survives request timeout | **No** | **Yes** |
| Survives uvicorn worker restart (SIGTERM) | No (cancelled) | No (also cancelled — checkpoint recovers) |
| Implementation simplicity | Simpler | One extra line per route |
| GC safety | OK (FastAPI holds ref) | Requires strong-ref set |

**Recommendation:** CONTEXT D-06 picks `BackgroundTasks`; that's acceptable IF the plan acknowledges the cancellation possibility. The cleaner technical answer is `asyncio.create_task` per Pattern 3. The graph's checkpoint is the safety net for either choice.

**For `interrupt()` to pause the graph:** The `ainvoke` call returns (doesn't block) when interrupt fires. So the background coroutine completes naturally. The graph stays paused in Postgres. `/resume` re-invokes via a NEW background coroutine. No long-lived coroutine is needed.

**Sources:** [FastAPI BackgroundTasks discussion #8805](https://github.com/fastapi/fastapi/discussions/8805), [Python Background Tasks — Asyncio Traps, FastAPI & Celery (2026)](https://dev.to/kaushikcoderpy/python-background-tasks-asyncio-traps-fastapi-celery-2026-381i)

---

### §4 — Parallel fan-out with LangGraph 1.1 (see Pattern 4 above for the full code)

**Recap:** Use plain `add_edge` with multiple targets from `researcher` and multiple sources to `validate_sections`. LangGraph 1.1 supports this natively; the 7 parallel writes merge into the TypedDict state automatically because each writer mutates a distinct field.

**`validate_sections` node implementation:**
```python
# src/eisenbalm_pipeline/agents/validate.py
import time
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.graph.state import DispatchState

REQUIRED_FIELDS = (
    'origin_story', 'problem_statement', 'founder_bio',
    'case_study', 'game', 'bonus', 'theme',
)


async def validate_sections(state: DispatchState) -> DispatchState:
    missing = [f for f in REQUIRED_FIELDS if not state.get(f)]
    if missing:
        await convex_mutation_safe('pipelineRuns:updateStatus', {
            'runId': state['run_id'],
            'status': 'failed',
            'completedAt': int(time.time() * 1000),
            'errorMessage': f'partial-failure: missing sections {missing}',
        })
        # Raising halts the graph; the checkpoint records the partial state.
        raise RuntimeError(f'partial-failure: missing sections {missing}')
    return state
```

`validate_sections` is NOT decorated with `@agent_node` because:
1. It doesn't emit a deliberation event (no `agentId` in the brief's 14-agent list).
2. It writes `pipelineRuns.status='failed'` directly with a special errorMessage prefix (D-26).
3. Wrapping it would double-write the failed status.

**Source:** [LangGraph use-graph-api](https://docs.langchain.com/oss/python/langgraph/use-graph-api), [PITFALLS.md §1.3](../../research/PITFALLS.md)

---

### §5 — Sanity Python SDK status & raw `httpx` mutation pattern

**Status as of May 2026:** There is NO maintained official Sanity Python SDK. PyPI `sanity` (0.2.5) is abandoned. `OmniPro-Group/sanity-python` exists on GitHub but is community-only and incomplete. **Plan must use raw `httpx` against the Sanity Content API.**

**API base URL:**
```
https://{NEXT_PUBLIC_SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01
```

**Mutation endpoint:**
```
POST /v2024-01-01/data/mutate/{dataset}
Content-Type: application/json
Authorization: Bearer {SANITY_API_TOKEN}

Body: {"mutations": [{"createOrReplace": {...}}]}
```

**Asset upload endpoint (Phase 6 owns the real call; Phase 4 ships the stub):**
```
POST /v2024-01-01/assets/files/{dataset}?filename=...
Content-Type: application/pdf
Authorization: Bearer {SANITY_API_TOKEN}

Body: <binary>
```

See Example 3 above for the full `lib/sanity_client.py` implementation.

**Phase 4 only uses `createOrReplace` (idempotent inserts). Phase 6 adds the asset upload + patch sequence.**

**Sources:** [Sanity Mutation API reference](https://www.sanity.io/docs/http-reference/mutation), [Sanity Assets API reference](https://www.sanity.io/docs/http-reference/assets), STACK.md §"Sharp Edges" #1

---

### §6 — Convex HTTP API from Python (Phase 4 is the first real caller)

**Endpoint:** `POST {NEXT_PUBLIC_CONVEX_URL}/api/mutation`

**Headers:**
```
Content-Type: application/json
Authorization: Convex {CONVEX_DEPLOY_KEY}
```

**Body:**
```json
{
  "path": "pipelineRuns:create",
  "args": { "runId": "abc...", "issueNumber": 999, "startedAt": 1715000000000 },
  "format": "json"
}
```

**Path syntax confirmed:** `module:export` where `module` is the filename minus extension (`pipelineRuns.ts` → `pipelineRuns`) and `export` is the named export (`create`, `byRunId`, etc.). Confirmed: `pipelineRuns:create`, `pipelineRuns:updateStatus`, `pitchLog:insert`, `pitchLog:markSelected`, `deliberationEvents:insert`, `agentVotes:insert`, `qaCorrections:insert`.

**Auth header is `Convex {key}` NOT `Bearer {key}`** for deploy-key auth. (`Bearer` is for end-user auth-provider tokens, which v1 doesn't have.)

**Success response:**
```json
{ "status": "success", "value": {...}, "logLines": [...] }
```

**Error response (HTTP 200 — sharp edge):**
```json
{ "status": "error", "errorMessage": "...", "errorData": {...}, "logLines": [...] }
```

**Idempotency:** Convex does NOT dedupe — the wrapper must check `status == 'success'`. The `pipelineRuns:create` will throw on duplicate `runId` if a unique index were defined, but the existing schema has only `by_runId` (non-unique) — so duplicate inserts CAN happen. CONTEXT D-09 mitigates by generating a fresh `run_id` per `/run/weekly` request.

**The two Phase 4 schema-patch concerns for the Convex side (D-39):**

The `pipelineRuns` table gets two new optional fields (`durationMs: v.optional(v.number())` and `cost: v.optional(v.string())`). The `pipelineRuns:updateStatus` mutation signature must accept these in its `args` validator. Existing rows are forward-compatible (optional fields default to undefined).

**Plan-level Convex deploy step:** `pnpm --filter @eisenbalm/convex deploy` — same workflow as Phase 3 D-04. The plan must own a discrete task for this.

**Sources:** [Convex HTTP API docs](https://docs.convex.dev/http-api/)

---

### §7 — Supabase Postgres URL format for Railway

**Three connection options compared:**

| Mode | Host | Port | IPv4? | Prepared statements? | Phase 4 verdict |
|------|------|------|-------|----------------------|------------------|
| Direct | `db.<ref>.supabase.co` | 5432 | **NO** (IPv6-only) | Yes | ❌ Won't work from Railway without $4/mo IPv4 add-on |
| Session pooler (Supavisor) | `aws-0-<region>.pooler.supabase.com` | 5432 | **Yes** | **Yes** | ✅ **Recommended** |
| Transaction pooler (Supavisor) | `<ref>.pooler.supabase.com` (varies) | 6543 | Yes | **NO** | ❌ Breaks AsyncPostgresSaver |

**Phase 4 specifies:** session pooler. Connection string for `.env.example`:
```
SUPABASE_POSTGRES_URL=postgres://postgres.<projectref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

**Defensive psycopg config (Pattern 1 above):** `prepare_threshold=None` + `autocommit=True` + `row_factory=dict_row`. This means even if someone accidentally points at the transaction pooler, the app degrades gracefully (slightly slower without prepared statements but no errors).

**`?sslmode=require`:** Supabase enforces TLS on all poolers. Most modern drivers default to SSL with the pooler hostnames, but appending `?sslmode=require` to the connection string is harmless and explicit. **Do append it.**

**`?pgbouncer=true`:** Some ORMs read this to disable prepared statements. psycopg does NOT — use `prepare_threshold=None` in kwargs instead. Don't bother adding `?pgbouncer=true`.

**Sources:** [Supabase Connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase IPv4 FAQ](https://supabase.com/docs/guides/troubleshooting/enabling-ipv4-addon), [Railway IPv6 thread](https://station.railway.com/questions/ipv6-outbound-38c621c0)

---

### §8 — Dockerfile (WeasyPrint deps pre-installed per D-28)

**Verified system packages for WeasyPrint 60+ on `python:3.11-slim-bookworm`:**

Official WeasyPrint Debian/bookworm install list (with wheels):
```
libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0
```

CONTEXT D-28's explicit list (more comprehensive — includes JPEG/OpenJP2 support):
```
libpango-1.0-0 libpangocairo-1.0-0 libcairo2 libffi-dev
libgdk-pixbuf-2.0-0 shared-mime-info fonts-liberation
```

**Add for completeness** (from in-the-wild Railway issues):
```
libharfbuzz0b libharfbuzz-subset0 libjpeg62-turbo libopenjp2-7
fontconfig
```

**Full recommended apt list:**
```
libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 libcairo2
libgdk-pixbuf-2.0-0 libharfbuzz0b libharfbuzz-subset0
libjpeg62-turbo libopenjp2-7 libffi-dev
shared-mime-info fontconfig fonts-liberation
```

**Multi-stage Dockerfile (recommended pattern, per Hynek + uv docs):**

```dockerfile
# packages/pipeline/Dockerfile
# syntax=docker/dockerfile:1.7

# ── Builder stage ────────────────────────────────────────────────
FROM python:3.11-slim-bookworm AS builder

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never

COPY --from=ghcr.io/astral-sh/uv:0.5.10 /uv /bin/uv

WORKDIR /app

# Install Python deps first for layer caching
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    uv sync --frozen --no-dev --no-install-project

# Copy source, install project
COPY src/ ./src/
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# ── Runtime stage ────────────────────────────────────────────────
FROM python:3.11-slim-bookworm AS runtime

# WeasyPrint system deps (Phase 4 installs even though Phase 6 owns PDF)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 libcairo2 \
        libgdk-pixbuf-2.0-0 libharfbuzz0b libharfbuzz-subset0 \
        libjpeg62-turbo libopenjp2-7 libffi-dev \
        shared-mime-info fontconfig fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN useradd --create-home --uid 10001 app
WORKDIR /app

# Copy installed venv from builder
COPY --from=builder --chown=app:app /app /app

USER app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "eisenbalm_pipeline.api.main:app", \
     "--host", "0.0.0.0", "--port", "8000"]
```

**Notes:**
- `uv` binary copied from official ghcr.io image — Hynek pattern.
- WeasyPrint deps in runtime stage only (build stage doesn't need them).
- `--frozen` requires `uv.lock` to be in sync with `pyproject.toml` — fails build if out of date (catches local drift).
- `EXPOSE 8000` — Railway maps `$PORT` to this; uvicorn binds 0.0.0.0:8000.
- Railway's `startCommand` in `railway.toml` overrides `CMD` (see §9 next).

**Sources:** [WeasyPrint install docs](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html), [Hynek's production uv Dockerfile](https://hynek.me/articles/docker-uv/), [uv Docker integration guide](https://docs.astral.sh/uv/guides/integration/docker/)

---

### §9 — Railway deployment specifics (`railway.toml`)

**Full `railway.toml`:**

```toml
# packages/pipeline/railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "uvicorn eisenbalm_pipeline.api.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/healthz"
healthcheckTimeout = 60
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3

# Phase 4: one-time setup runs as preDeployCommand
preDeployCommand = ["python -m eisenbalm_pipeline.cli setup-checkpointer"]
```

**`preDeployCommand` is the answer to D-12.** Confirmed in Railway docs: it runs once per deploy, before the container starts handling traffic, with the same image and env vars. `setup()` is idempotent — running it on every deploy is fine and matches the "one-time after Supabase provisioned" intent without requiring Andrew to remember a manual step.

**Note for D-29 (manual provisioning):** Even with `preDeployCommand`, Andrew still needs to set `SUPABASE_POSTGRES_URL` via `railway variables set` BEFORE the first deploy. Plan documents this order.

**Healthcheck contract:**
- `GET /healthz` returns 200 with `{"ok": true, "checkpointer": "connected", "stubMode": true}` (CONTEXT D-34).
- Railway expects 200 within `healthcheckTimeout` (60s) of container startup. Phase 4 startup latency includes lifespan (AsyncPostgresSaver pool open + graph compile) — typically 2–5 seconds. 60s is comfortable.
- Failing the healthcheck triggers Railway's restart loop. Cold-start is slow first time; the lifespan-assertion query against Postgres has to wait for connection.

**Logs format:** Railway captures stdout. Recommend stdlib `logging` configured for JSON line output (one log entry per line) so Railway's log search works on structured fields:
```python
import logging
import json

class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            'level': record.levelname,
            'logger': record.name,
            'msg': record.getMessage(),
            'agent': getattr(record, 'agent', None),
            'run_id': getattr(record, 'run_id', None),
        })
```

**`railway run` for one-shot CLI invocations:** `railway run python -m eisenbalm_pipeline.cli setup-checkpointer` executes the command in the deployed environment's variable context but doesn't go through the Dockerfile build — it uses the local Python by default. For Phase 4, prefer `preDeployCommand` (above) which runs in the actual Docker image. `railway run` is the fallback for emergencies.

**Cold-start latency expectations:**
- Railway image pull: ~10–30s on first deploy, cached after.
- Container startup: 2–5s (Python import + FastAPI lifespan).
- Lifespan blocks until Postgres connection + table assertion + graph compile = ~1–3s.
- Total: typically 5–10s warm, 30–60s cold.

**Sources:** [Railway config-as-code docs](https://docs.railway.com/reference/config-as-code), [Railway healthcheck docs](https://docs.railway.com/deployments/healthchecks)

---

### §10 — pytest + pytest-asyncio + httpx integration test pattern

**`tests/conftest.py`:**
```python
import os
import pytest
from httpx import AsyncClient, ASGITransport


# Auto async mode — no need to mark every test
collect_ignore = []


@pytest.fixture
def anyio_backend():
    return 'asyncio'


@pytest.fixture
async def client():
    """In-process FastAPI test client. Uses the real app + real lifespan.

    Requires env vars to be set (SUPABASE_POSTGRES_URL, CONVEX_DEPLOY_KEY, etc.)
    or skip if missing.
    """
    if not os.getenv('SUPABASE_POSTGRES_URL'):
        pytest.skip('SUPABASE_POSTGRES_URL not set; integration test skipped')
    from eisenbalm_pipeline.api.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url='http://test',
        headers={'X-Pipeline-Trigger-Secret': os.environ['PIPELINE_TRIGGER_SECRET']},
    ) as c:
        yield c


@pytest.fixture
async def convex_query_fn():
    """Helper for Convex query assertions."""
    from httpx import AsyncClient as AC
    async with AC(base_url=os.environ['NEXT_PUBLIC_CONVEX_URL'].rstrip('/')) as http:
        async def _q(path: str, args: dict):
            r = await http.post(
                '/api/query',
                json={'path': path, 'args': args, 'format': 'json'},
                headers={'Authorization': f"Convex {os.environ['CONVEX_DEPLOY_KEY']}"},
            )
            r.raise_for_status()
            body = r.json()
            assert body['status'] == 'success'
            return body['value']
        yield _q
```

**`pyproject.toml` pytest config:**
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
filterwarnings = ["ignore::DeprecationWarning"]
```

**Test choice — in-process (`ASGITransport`) vs deployed-URL:**
- **In-process** (recommended for Phase 4): `AsyncClient(transport=ASGITransport(app=app))`. Fast, runs the real FastAPI app with the real lifespan. Hits real Sanity + real Convex + real Supabase. Catches everything except Docker/Railway/Networking issues.
- **Deployed URL** (recommended for Andrew's manual smoke per D-42): point a separate test config at the Railway URL. Catches the Docker + Railway-specific failures. Slower.

CONTEXT D-35 says "live Railway URL (or local `uvicorn` for dev)" — plan can pick. Recommend in-process for `pytest -k test_pipeline_e2e` (fast iteration) and deployed-URL for Andrew's smoke (production verification).

**Sanity cleanup** in `test_pipeline_e2e.py` teardown:
```python
async def _cleanup(issue_number: int, run_id: str):
    """Delete the Sanity draft + Convex rows for repeatability."""
    from httpx import AsyncClient
    project = os.environ['NEXT_PUBLIC_SANITY_PROJECT_ID']
    dataset = os.environ.get('NEXT_PUBLIC_SANITY_DATASET', 'production')
    token = os.environ['SANITY_API_TOKEN']
    issue_id = f'issue-{issue_number}'

    async with AsyncClient() as http:
        # Delete Sanity draft
        await http.post(
            f'https://{project}.api.sanity.io/v2024-01-01/data/mutate/{dataset}',
            json={'mutations': [{'delete': {'id': issue_id}}]},
            headers={'Authorization': f'Bearer {token}'},
        )
        # Convex rows: harder to delete without a custom mutation. Leave them;
        # they're scoped to the unique runId so they don't pollute future runs.
```

**Sources:** [FastAPI async tests](https://fastapi.tiangolo.com/advanced/async-tests/), [httpx ASGITransport docs](https://www.python-httpx.org/advanced/transports/)

## Sources

### Primary (HIGH confidence)
- [LangGraph Memory how-to](https://docs.langchain.com/oss/python/langgraph/add-memory) — AsyncPostgresSaver lifecycle, container restart behavior
- [LangGraph Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts) — `interrupt()` + `Command(resume=...)` semantics
- [LangGraph use-graph-api](https://docs.langchain.com/oss/python/langgraph/use-graph-api) — fan-out / join patterns
- [langgraph-checkpoint-postgres PyPI 3.1.0](https://pypi.org/project/langgraph-checkpoint-postgres/) — package version, dependencies
- [Convex HTTP API docs](https://docs.convex.dev/http-api/) — `/api/mutation` body shape, auth header, error envelope
- [Sanity Mutation API reference](https://www.sanity.io/docs/http-reference/mutation) — `/data/mutate/{dataset}` URL, body shape
- [Sanity Assets API reference](https://www.sanity.io/docs/http-reference/assets) — `/assets/files/{dataset}` upload endpoint
- [Supabase Connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres) — three pooler modes, port differences
- [Supabase: Disabling prepared statements](https://supabase.com/docs/guides/troubleshooting/disabling-prepared-statements-qL8lEL) — psycopg `prepare_threshold` config
- [Supabase IPv4 add-on FAQ](https://supabase.com/docs/guides/troubleshooting/enabling-ipv4-addon) — IPv6-only direct connection, IPv4 add-on cost
- [Railway config-as-code](https://docs.railway.com/reference/config-as-code) — `railway.toml` schema, `preDeployCommand`
- [Railway healthchecks](https://docs.railway.com/deployments/healthchecks) — healthcheck contract
- [uv Docker integration guide](https://docs.astral.sh/uv/guides/integration/docker/) — multi-stage build pattern
- [Hynek's production uv Dockerfile](https://hynek.me/articles/docker-uv/) — non-root user, layer caching, runtime deps
- [WeasyPrint install docs](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html) — official Debian apt package list
- [FastAPI async tests](https://fastapi.tiangolo.com/advanced/async-tests/) — ASGITransport pattern
- [Railway IPv6 outbound](https://station.railway.com/questions/ipv6-outbound-38c621c0) — Railway is IPv4-only egress

### Secondary (MEDIUM confidence)
- [LangGraph discussion #2967 — AsyncPostgresSaver + Supabase pooler](https://github.com/langchain-ai/langgraph/discussions/2967) — `AsyncConnectionPool` + `prepare_threshold=0` workaround
- [psycopg3 prepared statements docs](https://www.psycopg.org/psycopg3/docs/advanced/prepare.html) — `prepare_threshold` API
- [psycopg + PgBouncer compatibility](https://github.com/pgbouncer/pgbouncer/discussions/995) — community confirmation that psycopg3 >=3.2 supports PgBouncer with `prepare_threshold=None`
- [Supabase asyncpg pooling Medium article](https://medium.com/@patrickduch93/supabase-pooling-and-asyncpg-dont-mix-here-s-the-real-fix-44f700b05249) — sharp edge confirmation
- [Python Background Tasks — Asyncio Traps (2026)](https://dev.to/kaushikcoderpy/python-background-tasks-asyncio-traps-fastapi-celery-2026-381i) — BackgroundTasks cancellation behavior
- [FastAPI discussion #8805 — client disconnect cancellation](https://github.com/fastapi/fastapi/discussions/8805) — confirmation BackgroundTasks gets cancelled
- [Best practices for parallel nodes in LangGraph](https://forum.langchain.com/t/best-practices-for-parallel-nodes-fanouts/1900) — fan-out without reducers when fields differ
- [Sanity Connection guide → pooler differences](https://supabase.com/docs/guides/troubleshooting/supavisor-and-connection-terminology-explained-9pr_ZO)

### Tertiary (LOW confidence — pure community / single-source)
- [LangGraph 1.1 Agent Patterns 2026 blog](https://callsphere.ai/blog/langgraph-agent-patterns-2026-stateful-multi-step-ai-workflows) — interrupt/resume in production patterns; cross-referenced against official docs
- [Markaicode: LangGraph Interrupt Pause and Resume](https://markaicode.com/langgraph-interrupt-pause-resume-agent/) — same patterns, verified against official docs

## Metadata

**Confidence breakdown:**
- LangGraph + AsyncPostgresSaver + Supabase patterns: HIGH — multiple official sources confirm + GitHub issues confirm sharp edges
- `interrupt()` + `Command(resume=...)` semantics: HIGH — official LangChain reference + 2026 community docs aligned
- Sanity HTTP API: HIGH — official Sanity docs verified for v2024-01-01 endpoint shape
- Convex HTTP API: HIGH — official Convex docs verified for path syntax, auth header, error envelope
- Supabase pooler sharp edges: HIGH — confirmed across docs, GitHub issues, in-the-wild bug reports
- Railway specifics (`preDeployCommand`, healthcheck): HIGH — official Railway docs
- Dockerfile WeasyPrint deps: HIGH — official WeasyPrint docs + Hynek's uv pattern
- pytest + httpx async testing: HIGH — official FastAPI + httpx docs
- BackgroundTasks vs create_task: MEDIUM — community consensus is strong but no official FastAPI doc forbids BackgroundTasks for long work; CONTEXT D-06 has discretion

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (30 days for stable APIs); LangGraph and `langgraph-checkpoint-postgres` are in fast-moving release cycles — recheck `langgraph-checkpoint-postgres` version + AsyncPostgresSaver API surface within 7 days if implementation slips.

## RESEARCH COMPLETE

- **Sharp edge #1 (load-bearing):** Use Supabase **session pooler** (port 5432, host `aws-0-<region>.pooler.supabase.com`) — it's the only mode that's both IPv4-compatible (Railway egress) AND supports prepared statements (AsyncPostgresSaver). Additionally set psycopg `prepare_threshold=None` defensively so misconfigured envs degrade gracefully instead of crashing on the second checkpoint write.
- **The interrupt/resume contract:** `interrupt()` raises an internal exception caught by LangGraph; `await graph.ainvoke()` RETURNS (does not block) with `__interrupt__` in the result. On resume via `graph.ainvoke(Command(resume=value), config={'thread_id': run_id})`, LangGraph loads the checkpoint, RE-RUNS the suspended node from the top (so all pre-interrupt code MUST be idempotent — `pipelineRuns:updateStatus` upserts are safe, `pitchLog:insert` would duplicate), and `interrupt()` returns the resume value on the second pass. Container restart survives this cleanly as long as the SAME thread_id + SAME Postgres are reused.
- **Sub-dep pin missing from CONTEXT D-04:** `langgraph-checkpoint-postgres==3.1.0` (released 2026-05-12) is required for LangGraph 1.x. The plan must add this + `psycopg[binary]>=3.2` to `pyproject.toml`. CONTEXT D-04 omits both — flag in the plan.
- **No maintained Sanity Python SDK** — use raw `httpx` against `POST /v2024-01-01/data/mutate/{dataset}` with `Authorization: Bearer {token}` and body `{"mutations": [{"createOrReplace": {...}}]}`. STACK.md already documented this; planner copies the helper into `lib/sanity_client.py`. Convex's `POST /api/mutation` uses `Authorization: Convex {key}` (NOT Bearer) and returns errors as HTTP 200 with `{status: "error", errorMessage}` — wrapper must branch on `status`, not `response.status_code`.
- **`preDeployCommand` in `railway.toml` is the canonical home** for `python -m eisenbalm_pipeline.cli setup-checkpointer` (D-12) — runs once per deploy with the deployed env vars, before traffic flows. Andrew still sets `SUPABASE_POSTGRES_URL` via `railway variables set` before the first deploy. Healthcheck at `/healthz`, 60s timeout, `restartPolicyType="ON_FAILURE"`.
