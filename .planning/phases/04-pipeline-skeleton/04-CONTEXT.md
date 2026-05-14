# Phase 4: Pipeline Skeleton - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning
**Mode:** auto (user requested no clarifying questions — recommended defaults selected for every gray area)

<domain>
## Phase Boundary

Stand up the FastAPI + LangGraph + Supabase pipeline on Railway with **all 14 stub agents wired in the brief's exact sequence**, prove the three-datastore write contract end-to-end (Sanity draft + Convex events + Supabase checkpoint), validate the Editor gate 1 `interrupt()`/`resume` pause cycle, and emit per-run cost + duration — **all without spending a cent on real LLM calls**. Phase 4 is the load-bearing skeleton that Phase 5 swaps real agents into; every contract that Phase 5+ relies on must exist and pass an integration test here.

**In scope:**
- New Python project at `packages/pipeline/` initialized with `uv` (pyproject.toml, lock, venv) — destroys the current TypeScript placeholder (`package.json` stays so pnpm sees the workspace; `tsconfig.json` deleted)
- FastAPI app exposing `POST /run/weekly`, `POST /run/{runId}/resume`, `GET /run/{runId}/status`, `POST /run/{runId}/publish` (manual fallback — actual Publisher work is Phase 6, but the endpoint shape lands here per PIP-02 and WHK-08)
- LangGraph `StateGraph` with the full 14-node graph: Calibrator → Scout → Advocate → Editor[gate 1, with `interrupt()`] → Researcher → fan-out{OriginStory, Problem, FounderBio, CaseStudy, Game, Bonus, Design} → join → QA → Editor[final] → Publisher
- `DispatchState` TypedDict matching API_CONTRACTS.md §7 verbatim (single source of truth — every agent reads/writes this shape)
- 14 stub agent node functions, each returning **deterministic, structurally valid** fixtures matching the contract for that agent
- `AsyncPostgresSaver` checkpointer wired to Supabase Postgres; `checkpointer.setup()` runs as a one-time deploy step (not on every startup, per PIP-09)
- Three datastore clients: `lib/sanity_client.py` (Python sanity SDK), `lib/convex_client.py` (httpx → `/api/mutation`), `lib/portable_text.py` (the helper from API_CONTRACTS.md §2.4)
- An agent-wrapper decorator (`@agent_node`) that owns try/except, Convex event emission, per-agent token/cost recording, and iteration-limit enforcement — so Phase 5 only writes the agent body
- Stub-mode "fake OpenRouter": a deterministic mock client that returns canned responses, records simulated token counts, and never hits the network
- runId discipline: generated **exactly once** inside `POST /run/weekly` (UUID v4), threaded into the initial state, propagated to every Sanity write + every Convex mutation
- Idempotent stub draft write to Sanity (deterministic `_id = issue-{issueNumber}`) with `status: 'draft'`, full structurally-valid section payloads, and `pipelineMetadata.runId` set
- Editor gate 1 `interrupt()` flow proven: stub run with `forceNoWinner=True` sets `pipelineRuns.status = 'awaiting-review'`, pauses LangGraph, and a `POST /run/{runId}/resume {selection: ...}` re-injects via `Command(resume=...)` and runs to completion
- Failure path proven: a stub agent that raises results in `pipelineRuns.status = 'failed'` with failed `agentId` + error message visible in Convex; `GET /run/{runId}/status` returns the current state
- Cost & duration: `pipelineRuns.cost` (per-agent token + USD total, both 0 in stub mode but the shape exists) and `pipelineRuns.durationMs` populated at run end
- PIP-06 integration test: pytest harness that triggers `/run/weekly`, polls `/run/{runId}/status` until terminal, then asserts `weeklyIssue.pipelineMetadata.runId === every Convex row's runId` for that run
- Railway deployment: custom `Dockerfile` with **WeasyPrint system deps pre-installed now** (libpango, libcairo, libffi, libgdk-pixbuf — Phase 6 will not have to revisit infra), `python:3.11-slim` base, `uv` pinned, `uvicorn` entrypoint
- Manual Railway/Supabase provisioning checkpoint (mirrors Phase 1 sanity init + Phase 3 convex init): Andrew creates the Railway project + Supabase Postgres, copies env values into `.env.example` placeholder list, plan documents the commands but does NOT autonomously provision
- `packages/pipeline/README.md` onboarding doc (local dev, env list, smoke test, `checkpointer.setup()` one-time command, stub vs real toggle)

**Strictly NOT in this phase:**
- Any real LLM call. No OpenRouter spend. Stub agents only. (Phase 5 owns this.)
- Real Tavily/Brave web search. Stub Scout returns 3 hardcoded fake charities. (Phase 5.)
- Real WeasyPrint PDF generation. Stub Publisher records a placeholder `pdfAssetUrl: 'stub-pdf-not-yet-implemented'`. (Phase 6 owns the real PDF; this phase only proves the Publisher node runs and the Convex `publisher-deploy` event fires.)
- Real Sanity webhook on `status: published`. Phase 4 only ships the **endpoint shape** for `POST /run/{runId}/publish` manual fallback; HMAC verification + age check + idempotency are Phase 6.
- Real Vercel deploy hook fire. Stub Publisher logs the URL it would have called. (Phase 6.)
- Real Stripe webhook. (Phase 8.)
- Game embedCode validator. (Phase 7.)
- Jesse-voice rubric inside QA. Stub QA records zero corrections. (Phase 5.)
- Calibrator `bonusType` rotation logic. Stub Calibrator returns hardcoded `bigBudget`. (Phase 5 owns the previous-bonus-types lookup.)
- DesignAgent hex/font validation. Stub returns a hardcoded valid theme. (Phase 5 hardens the validator.)
- Researcher founder-name source verification (`httpx` fetch + string search). (Phase 5 — AGT-08.)
- Font whitelist enforcement. (Phase 5 — AGT-14.)
- Per-developer Supabase databases. Single production Supabase Postgres mirrors Phase 2 D-15 (production Sanity dataset) and Phase 3 D-02 (single production Convex deployment).
- LangSmith tracing wiring. Mentioned in research STACK as `langsmith@0.8.3` but defer to Phase 5 when real LLM calls exist to trace.
- Authentication on FastAPI endpoints. v1 has no users; pipeline is server-to-server. Endpoints are public-ish but protected only by Railway URL obscurity + a shared-secret header (`X-Pipeline-Trigger-Secret`) — defer hardening to v2.
- CI gates. Phase 1 D-15 deferred CI; Phases 2, 3 held the line; Phase 4 holds it too.

</domain>

<decisions>
## Implementation Decisions

### Python project & tooling

- **D-01:** **`uv` is the Python package manager**, pinned by version in the Dockerfile and locally. Rationale: `uv` is the fast modern standard, already named in the build brief and packages/pipeline/README.md placeholder. `pyproject.toml` + `uv.lock` checked in; no `requirements.txt`. The Dockerfile uses `RUN uv sync --frozen --no-dev`.
- **D-02:** **Python 3.11** (matches research STACK.md recommendation — Railway-supported, LangGraph-compatible, runs WeasyPrint cleanly). Pinned via `pyproject.toml` `requires-python = ">=3.11,<3.12"` and the Docker base image `python:3.11-slim-bookworm`.
- **D-03:** **`src/` layout** under `packages/pipeline/` — `packages/pipeline/src/eisenbalm_pipeline/...`. Cleaner imports, prevents accidental top-level shadowing. Module name: `eisenbalm_pipeline`. Package distribution is private; `tool.uv.package = true` so editable installs work for local dev.
- **D-04:** **Pinned dependencies** (verified in `.planning/research/STACK.md`):
  - `fastapi == 0.136.1`
  - `uvicorn[standard] == 0.46.0`
  - `langgraph == 1.1.10` (+ `langgraph-checkpoint-postgres` for `AsyncPostgresSaver`)
  - `pydantic == 2.13.4`
  - `httpx == 0.28.1`
  - `python-sanity` (official Python SDK — confirm exact pin during planning research; if no maintained SDK, fall back to direct HTTP via `httpx` with `client.create_or_replace` semantics replicated)
  - `supabase == 2.30.0` (Python SDK — used only for the `checkpointer.setup()` migration verification; LangGraph owns Postgres connection through `AsyncPostgresSaver`)
  - `python-slugify` (for charity `_id` derivation, matches API_CONTRACTS.md §2.1)
  - `langchain-openai == 1.2.1` (deferred actual usage to Phase 5, but install now so `pyproject.toml` stays stable across the phase boundary — stub mode never instantiates it)
  - `pytest`, `pytest-asyncio`, `httpx[testing]` (dev-deps for PIP-06 integration test)

### FastAPI surface & module layout

- **D-05:** **Modular FastAPI with `APIRouter`**, NOT a single `main.py`:
  ```
  src/eisenbalm_pipeline/
    api/
      main.py              # FastAPI app, router includes, lifespan
      runs.py              # POST /run/weekly, GET /run/{runId}/status, POST /run/{runId}/resume, POST /run/{runId}/publish
      webhooks.py          # POST /webhook/sanity-publish (endpoint stub only, full impl Phase 6)
      health.py            # GET /healthz (Railway healthcheck)
    graph/
      state.py             # DispatchState + nested TypedDicts (API_CONTRACTS.md §7)
      builder.py           # build_graph() — wires the StateGraph
      checkpointer.py      # AsyncPostgresSaver factory
    agents/
      _wrapper.py          # @agent_node decorator (try/except, Convex event, cost, iteration limit)
      calibrator.py        # stub
      scout.py             # stub
      advocate.py          # stub
      editor.py            # stub (gate 1 + final — two functions, one module)
      researcher.py        # stub
      origin_story.py      # stub
      problem.py           # stub
      founder_bio.py       # stub
      case_study.py        # stub
      game.py              # stub
      bonus.py             # stub
      design.py            # stub
      qa.py                # stub
      publisher.py         # stub
    lib/
      sanity_client.py     # write_charity, write_issue_draft, upload_pdf_to_issue helpers
      convex_client.py     # convex_mutation() async wrapper
      portable_text.py     # text_to_portable_text() helper (API_CONTRACTS.md §2.4 verbatim)
      cost.py              # CostRecorder context manager
      ids.py               # new_run_id() returning uuid4 hex
    stubs/
      fixtures.py          # deterministic per-agent fixture functions
      fake_openrouter.py   # placeholder client (returns canned strings, records 0 tokens) — used in Phase 5 swap point
    types.py               # public re-exports (DispatchState, etc.) for test code
  ```
- **D-06:** **`POST /run/weekly`** generates `runId` first (D-09), inserts the `pipelineRuns` row with `status='running'` and `startedAt=Date.now()`, then `await graph.ainvoke(initial_state, config={'configurable': {'thread_id': runId}})` inside a background task. Returns `{ runId }` immediately (per PIP-02). The graph itself runs to completion (or interrupt) in the background; clients poll `GET /run/{runId}/status` for terminal state.
- **D-07:** **`GET /run/{runId}/status`** reads from Convex `pipelineRuns:byRunId` (canonical source for run status — Phase 3 already shipped the query). Optionally enriches with the latest `deliberationEvents` event for visibility. Returns `{ runId, status, startedAt, completedAt?, durationMs?, errorMessage?, agentId?, lastEvent? }`.
- **D-08:** **`POST /run/{runId}/resume`** accepts `{ selection: { charityName: string } }`, fetches the existing thread from `AsyncPostgresSaver`, and calls `graph.ainvoke(Command(resume={'editorSelection': selection.charityName}), config={'configurable': {'thread_id': runId}})`. The Editor gate 1 node consumes `Command.resume` via `interrupt()`'s return value, sets `state['winning_charity']` from the human pick, and the graph resumes through the fan-out.

### runId discipline

- **D-09:** **runId is generated exactly once** inside `POST /run/weekly` handler before any agent runs:
  ```python
  run_id = uuid.uuid4().hex   # plain hex, no dashes — matches what's already in apps/web examples
  ```
  Threaded into `initial_state['run_id']`, passed to every `convex_mutation(...)` call, written to `pipelineMetadata.runId` on the Sanity draft. The agent-wrapper decorator (D-15) reads `state['run_id']` from the LangGraph state — never re-generates.
- **D-10:** **`thread_id` for `AsyncPostgresSaver` == `runId`** (one-to-one). Lets `POST /run/{runId}/resume` re-attach to the exact pending interrupt without any side index.

### LangGraph integration

- **D-11:** **`AsyncPostgresSaver` against Supabase Postgres** for checkpointing (PIP-09 locked). Connection string in `SUPABASE_POSTGRES_URL` env var (full DSN, including pgbouncer pool mode if Supabase requires it). Connection construction uses `AsyncPostgresSaver.from_conn_string(SUPABASE_POSTGRES_URL)` inside a FastAPI `lifespan` context manager so it's created at app startup and disposed cleanly on shutdown.
- **D-12:** **`checkpointer.setup()` is a one-time deploy step**, NOT run on every startup (PIP-09 explicit). Implementation: a CLI subcommand `python -m eisenbalm_pipeline.cli setup-checkpointer` plus a Railway `release` command in `railway.toml` (or `Dockerfile`-level `ONBUILD` doc). README documents the prerequisite — fresh Supabase deployment requires `setup-checkpointer` once before first `/run/weekly`. App startup skips it and asserts the tables exist (fail-fast with descriptive error if missing).
- **D-13:** **Editor gate 1 uses LangGraph 1.x native `interrupt()`** + `Command(resume=...)`. The node:
  ```python
  @agent_node(name='editor', emit_event='editor-decision')
  async def editor_gate_1(state: DispatchState) -> DispatchState:
      # ... select winner from advocate-scored candidates
      if no_clear_winner:
          # Pause; surface to Convex first
          await convex_mutation('pipelineRuns:updateStatus', {'runId': state['run_id'], 'status': 'awaiting-review'})
          human_input = interrupt({'reason': 'no-clear-winner', 'candidates': [c['name'] for c in state['candidates']]})
          selected_name = human_input['editorSelection']
          state['winning_charity'] = next(c for c in state['candidates'] if c['name'] == selected_name)
      else:
          state['winning_charity'] = top_candidate
      # ... write editor-decision event, return state
  ```
  After `interrupt()` returns the resumed value, the node writes `pipelineRuns:updateStatus` back to `'running'` and proceeds. Resume payload shape matches D-08.
- **D-14:** **Phase 2 fan-out via parallel edges** — `Editor[gate 1]` → `Researcher` → seven parallel edges to OriginStory, Problem, FounderBio, CaseStudy, Game, Bonus, Design → all converge into a synthetic `validate_sections` node → QA → Editor[final] → Publisher. The `validate_sections` node (new in Phase 4, not in the brief explicitly but pulled from PITFALLS.md §1.3) asserts every required state field is populated; missing fields write `pipelineRuns.status='partial-failure'` (or `failed`) before halting the graph. This is the safety net the brief implies but doesn't spell out.

### Stub agent strategy

- **D-15:** **One wrapper decorator owns the agent lifecycle** — Phase 5 doesn't have to re-implement boilerplate:
  ```python
  def agent_node(*, name: str, emit_event: Optional[str] = None, max_tool_calls: Optional[int] = None):
      """Decorator: try/except + Convex event + cost recording + iteration limit."""
      def decorator(fn):
          @functools.wraps(fn)
          async def wrapped(state: DispatchState) -> DispatchState:
              start = time.monotonic()
              try:
                  new_state = await fn(state)
                  duration_ms = int((time.monotonic() - start) * 1000)
                  if emit_event:
                      await _emit_event(state['run_id'], name, emit_event, _payload_for(name, new_state))
                  _record_cost(name, tokens=0, duration_ms=duration_ms)  # stub: 0 tokens
                  return new_state
              except Exception as e:
                  await convex_mutation('pipelineRuns:updateStatus', {
                      'runId': state['run_id'],
                      'status': 'failed',
                      'completedAt': int(time.time() * 1000),
                      'errorMessage': f'{name}: {e!r}',
                  })
                  raise   # let LangGraph see the failure for checkpoint consistency
          return wrapped
      return decorator
  ```
  Every agent function is decorated. Phase 5 keeps the decorator, replaces the function body with real LLM logic.
- **D-16:** **Stub outputs are deterministic fixtures**, NOT random. `stubs/fixtures.py` exports `calibrator_output()`, `scout_candidates()`, `advocate_scored()`, `research_output()`, `origin_story()`, etc. — each returns a hardcoded but **structurally valid** payload matching the LangGraph state contract. Determinism makes PIP-06 integration test repeatable.
  - Stub fixtures use a fake charity ("The Quiet Foundation" — already seeded by Phase 2's demo content seed) so the stub run reuses existing Sanity data and doesn't pollute the charity database with fake test entries on every run.
  - Stub `issue_number` defaults to `999` (well above realistic v1 issue counts) so stub runs don't collide with real issue numbers when Phase 5 lands. `POST /run/weekly` accepts an optional `{ issueNumber }` body to override.
- **D-17:** **Stub mode is the default in Phase 4**; toggle is `EISENBALM_STUB_MODE=true` in env, defaulting to `true` if unset. Phase 5 flips the default and adds a real-mode path. The toggle lives in `lib/openrouter_client.py` (or `stubs/fake_openrouter.py`) — agent code never branches on it.

### Three-datastore write discipline

- **D-18:** **Write order on a successful stub run** (canonical for Phase 5 to inherit):
  1. `/run/weekly` POST → generate runId → `Convex:pipelineRuns:create({runId, issueNumber, startedAt})` → return `{runId}`
  2. **Calibrator** → `Convex:deliberationEvents:insert` (no Sanity write, no `pipelineRuns` change)
  3. **Scout** (stub: returns 3 fake candidates) → for each candidate: `Sanity:write_charity` (deterministic `_id`, idempotent) → `Convex:pitchLog:insert`
  4. **Advocate** → for each candidate: `Convex:agentVotes:insert` + `Convex:deliberationEvents:insert{eventType: 'advocate-argument'}`
  5. **Editor gate 1** → `Convex:pitchLog:markSelected` + `Convex:deliberationEvents:insert{eventType: 'editor-decision'}`
  6. **Researcher** → no datastore write (research data lives only in LangGraph state)
  7. **Phase 2 fan-out (parallel)** — each section agent emits one `Convex:deliberationEvents:insert{eventType: 'section-draft'}`
  8. **`validate_sections` node** — assertion pass; no datastore write on success, `pipelineRuns:updateStatus{failed}` on failure
  9. **QA** → for each correction (stub: 0): `Convex:qaCorrections:insert` + one summary `Convex:deliberationEvents:insert{eventType: 'qa-correction'}`
  10. **Editor final** → `Convex:deliberationEvents:insert{eventType: 'editor-final'}`
  11. **Pipeline-end** (right before Publisher) → `Sanity:write_issue_draft(state)` — single Sanity write that creates the entire `weeklyIssue` draft with `pipelineMetadata.runId = run_id`
  12. **Publisher (stub)** → `Convex:pipelineRuns:updateStatus{status='awaiting-review', completedAt}` + `Convex:deliberationEvents:insert{eventType: 'publisher-deploy'}`. Note: status is `awaiting-review` (not `complete`) until Andrew publishes via Sanity — `complete` is set in Phase 6 by the real Sanity webhook handler.
- **D-19:** **Idempotent inserts only** — Sanity uses deterministic `_id`s (`charity-{slug}`, `issue-{issueNumber}`) per Phase 1 D-17 + Phase 2 D-17 pattern; Convex inserts include `runId` so re-runs with the same `runId` would produce duplicate rows. **Therefore: every `POST /run/weekly` generates a new `runId`**, and re-running the pipeline for the same `issueNumber` is allowed (it overwrites the Sanity draft + appends a new run history in Convex). Convex never deduplicates by `runId` automatically — that's by design (each run is a separate observable record).
- **D-20:** **Sanity writes wrap in try/except; Convex writes are fire-and-forget logged**. Per API_CONTRACTS.md §Error handling — Sanity failure halts the pipeline (content is canonical); Convex failure logs + continues (deliberation layer is observable, not load-bearing). The `@agent_node` decorator handles the Convex side. Sanity writes happen explicitly inside specific agent bodies (Scout, pipeline-end node) and use a context manager `_sanity_safe()` that on failure sets `state['error']` and calls `pipelineRuns:updateStatus{status='failed'}` before re-raising.
- **D-21:** **No Convex retries in Phase 4**. Phase 5 may add exponential backoff for OpenRouter; Convex is on the same Railway VPC as the pipeline (effectively LAN latency) so retries add complexity for marginal benefit. Log + continue is sufficient.

### Cost & duration tracking

- **D-22:** **`CostRecorder` context manager** in `lib/cost.py` is bound to a `runId` and accumulates per-agent `{tokens_in, tokens_out, usd}` records in memory during the run; on pipeline completion (or failure), it flushes to Convex via a new mutation contract addendum `pipelineRuns:updateStatus` accepting a `cost: v.optional(v.object({...}))` field, and to Sanity by being JSON-stringified into `weeklyIssue.pipelineMetadata.cost` (mirror the existing `modelVersions` JSON-string pattern from API_CONTRACTS.md §2.2). In stub mode, every agent records `{tokens: 0, usd: 0.0}`. Schema impact: **Convex `pipelineRuns:updateStatus` mutation needs a `cost` arg added; this is a Phase 4 change to Phase 3's deployed function** — flag this in the plan as a Convex re-deploy step. Andrew or the engineer re-runs `pnpm --filter @eisenbalm/convex deploy` after the new mutation arg lands.
- **D-23:** **`durationMs` is `pipeline_end_ms - pipeline_start_ms`**, recorded inside the Publisher node (or the top-level FastAPI handler if the pipeline failed before Publisher). Convex `pipelineRuns` schema already has `completedAt` (Unix ms); `durationMs` is added as a Phase 4 schema patch on the existing table — `v.optional(v.number())`. **Schema impact:** `convex/schema.ts` gets a `durationMs: v.optional(v.number())` field added to `pipelineRuns`; the `updateStatus` mutation accepts the new field. Same redeploy step as D-22.
- **D-24:** **OPS-03 (per-run cost in Sanity Studio)** uses the `pipelineMetadata.cost` JSON string described in D-22. No schema change to Sanity is needed — `pipelineMetadata` is already an open object on the `weeklyIssue` schema (Phase 1 schemas allow it via the metadata field). Studio displays it as raw JSON; a custom field renderer can come in Phase 5 or v2.

### Iteration limits & error envelope

- **D-25:** **Iteration limit decorator** is `@agent_node(..., max_tool_calls=N)`. In Phase 4 stubs, tool calls are not made (the fake client never invokes tools), so the limit is recorded but never tripped. The shape exists so Phase 5 only needs to plug real tool-calling agents into the same decorator (AGT-18). Default limits: Scout=8, Researcher=12, all others=None.
- **D-26:** **`pipelineRuns.status` value space is fixed by `convex/schema.ts`** — `'running' | 'awaiting-review' | 'complete' | 'failed'`. Phase 4 does NOT add a new `'partial-failure'` state despite PITFALLS.md §1.3 suggesting one. Instead, `validate_sections` failure sets `status='failed'` with an `errorMessage` like `partial-failure: missing sections [origin_story, game]`. Why: avoid schema-change cascades through Phase 3's already-shipped contract. Phase 5 or 9 can revisit if real partial failures become common.
- **D-27:** **`errorMessage` format**: `f'{agentId}: {exception_class_name}: {short_message}'` — first segment grep-able to count failures by agent. The wrapper decorator (D-15) constructs this string.

### Railway deployment & infra

- **D-28:** **Custom Dockerfile (PIP-01)** at `packages/pipeline/Dockerfile`. Base: `python:3.11-slim-bookworm`. Build stages:
  1. System deps: `libpango-1.0-0`, `libpangocairo-1.0-0`, `libcairo2`, `libffi-dev`, `libgdk-pixbuf-2.0-0`, `shared-mime-info`, `fonts-liberation`. **WeasyPrint deps installed in Phase 4 even though Phase 6 owns the real PDF** — keeps the Dockerfile stable across phases (PIP-01 explicit).
  2. Install `uv` from official pip wheel + `uv sync --frozen --no-dev`.
  3. Copy `src/` + `pyproject.toml` + `uv.lock` only (no node_modules, no `.git`, no `.planning`).
  4. Entrypoint: `uv run uvicorn eisenbalm_pipeline.api.main:app --host 0.0.0.0 --port $PORT`.
- **D-29:** **Railway provisioning is manual by Andrew** (mirrors Phase 1 sanity init, Phase 3 convex init). Plan documents:
  - `railway init` (creates project, links to GitHub or local) — interactive
  - `railway link` (links the local `packages/pipeline/` directory to the Railway service)
  - `railway up` (initial deploy to verify Dockerfile builds)
  - `railway variables set ...` for every env var (RUN explicitly listed in README)
  - `railway run python -m eisenbalm_pipeline.cli setup-checkpointer` (one-time, after Supabase env vars are set)
  - Plan does NOT autonomously run any of these.
- **D-30:** **Supabase provisioning is manual by Andrew** (same pattern):
  - Create Supabase project from dashboard
  - Copy connection string (transaction pooler, port 6543) into Railway env as `SUPABASE_POSTGRES_URL`
  - `railway run python -m eisenbalm_pipeline.cli setup-checkpointer` runs the LangGraph table migrations one time
  - Plan documents the steps; Andrew executes.

### Environment variables

- **D-31:** **New env vars introduced in Phase 4**:
  - `SUPABASE_POSTGRES_URL` — full Postgres DSN for `AsyncPostgresSaver` (server-side secret)
  - `OPENROUTER_API_KEY` — even in stub mode, define the var (placeholder OK in `.env.example`) so Phase 5 has zero env churn
  - `TAVILY_API_KEY` — same reasoning; placeholder OK
  - `SANITY_API_TOKEN` — write token for `python-sanity` client; pipeline-only
  - `EISENBALM_STUB_MODE` — `'true'` in Phase 4, `'false'` flipped in Phase 5
  - `PIPELINE_TRIGGER_SECRET` — shared secret required as `X-Pipeline-Trigger-Secret` header on `/run/weekly` (poor-man's auth for v1)
  - Re-uses Phase 3's `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOY_KEY` for Convex mutations
  - Re-uses Phase 1's `NEXT_PUBLIC_SANITY_PROJECT_ID` for Sanity writes
- **D-32:** **Env wiring**:
  - `packages/pipeline/.env.example` (committed, new) — lists all pipeline env vars with placeholders
  - `packages/pipeline/.env` (gitignored) — local dev secrets (each engineer has their own)
  - Root `.env.example` — extend with the new pipeline-shaped vars for cross-workspace clarity (mirrors Phase 3 D-21)
  - Railway env via `railway variables set` (manual, documented)

### FastAPI lifecycle & startup

- **D-33:** **FastAPI `lifespan` context manager** owns:
  - `AsyncPostgresSaver` construction (D-11) — instantiated once, reused across requests
  - LangGraph `StateGraph` compilation — compile the graph once at startup, reuse the compiled graph object
  - HTTP client pools (`httpx.AsyncClient` for Convex mutations) — single shared client
  - On shutdown: dispose the checkpointer connection pool, close httpx clients
- **D-34:** **`GET /healthz` returns 200 with `{ ok: true, checkpointer: 'connected', stubMode: true }`** for Railway healthcheck. Required by Railway to consider the service "live" after deploy. Failing healthcheck triggers Railway's restart loop.

### Testing strategy

- **D-35:** **PIP-06 integration test** lives at `packages/pipeline/tests/test_pipeline_e2e.py`. Uses `pytest-asyncio` + the live Railway URL (or local `uvicorn` for dev). Test body:
  1. Generate a unique `issueNumber` (e.g. 999000 + random suffix) to avoid clobbering the Phase 2 demo issue
  2. `POST /run/weekly { issueNumber }` → assert 200 + receive `{ runId }`
  3. Poll `GET /run/{runId}/status` until `status in ('complete', 'awaiting-review', 'failed')` with 30s timeout
  4. Assert `status == 'awaiting-review'` (stub Publisher leaves it there)
  5. Fetch `weeklyIssue` from Sanity by `_id = issue-{issueNumber}`; assert `pipelineMetadata.runId == runId`
  6. Fetch every Convex table by `runId`; assert every row has `runId == runId`
  7. **Cleanup:** delete the Sanity draft + Convex rows so the test is repeatable
- **D-36:** **Interrupt-resume test** (`test_editor_gate_1_resume.py`): same harness but with `forceNoWinner: true` in the POST body (a stub-mode toggle the Editor agent honors); assert `status == 'awaiting-review'` mid-run; `POST /run/{runId}/resume { selection: { charityName: 'The Quiet Foundation' } }`; poll again; assert eventual `status == 'awaiting-review'` (final terminal state) and Sanity draft now has the resumed charity.
- **D-37:** **Failure-path test** (`test_agent_failure.py`): set `forceFailAgent: 'researcher'` in POST body; assert `status == 'failed'` with `errorMessage` containing `'researcher:'`.
- **D-38:** **Tests run locally, NOT in CI** (Phase 1 D-15 deferred CI; carry the same posture). `packages/pipeline/README.md` documents `uv run pytest`.

### Schema patches (Phase 3 contract addendum)

- **D-39:** **Two additive Convex schema patches** land in Phase 4:
  - Add `durationMs: v.optional(v.number())` to `pipelineRuns` table
  - Add `cost: v.optional(v.string())` to `pipelineRuns` table (JSON-stringified payload — mirrors the `modelVersions` pattern). Why string not object: schema evolution is easier; nested object validation can come in Phase 5 when the cost shape is real.
  - Extend `pipelineRuns:updateStatus` mutation args to accept both new fields as optional
  - **Phase 4 redeploys Convex** after schema patch — same workflow as Phase 3 D-04 (`pnpm --filter @eisenbalm/convex deploy`)
  - Plan ships the schema diff + the redeploy step + a one-line note in `convex/README.md` indicating Phase 4 ownership of these fields

### Documentation

- **D-40:** **`packages/pipeline/README.md`** is rewritten from the Phase 1 placeholder to the canonical onboarding doc. Sections: prerequisites (Python 3.11, uv, Railway CLI, Supabase project), env vars table, local dev (`uv run uvicorn ...`), one-time setup (`setup-checkpointer`), stub mode toggle, running the integration test, deploy workflow, link to API_CONTRACTS.md §2/§3/§5/§7. Includes Andrew's manual smoke test for the end of Phase 4.
- **D-41:** **Update root `.env.example`** with new pipeline env vars; cross-reference from `apps/web/README.md` Convex section noting that `CONVEX_DEPLOY_KEY` is shared with Railway/pipeline.

### Andrew's smoke test (PIP-* evidence)

- **D-42:** End-of-phase smoke test in `packages/pipeline/README.md`:
  1. Andrew completes Railway + Supabase provisioning (D-29, D-30) one time
  2. `railway run python -m eisenbalm_pipeline.cli setup-checkpointer` — verify Supabase tables created
  3. `curl -X POST $RAILWAY_URL/run/weekly -H "X-Pipeline-Trigger-Secret: $SECRET" -d '{}'` → expect `{"runId": "..."}` within 1 second
  4. Wait 30 seconds (stub pipeline completes fast)
  5. `curl $RAILWAY_URL/run/{runId}/status` → expect `{ status: 'awaiting-review', durationMs: <some int>, cost: '{"total":0.0,"agents":{...}}' }`
  6. Open Sanity Studio → find draft `issue-999` → confirm every section populated with stub content + `pipelineMetadata.runId` set
  7. Open Convex dashboard → confirm rows in all five tables with matching `runId`
  8. Re-run integration test (`uv run pytest -k test_pipeline_e2e`) for cleanup verification
  9. (Optional) Test interrupt-resume: `curl -X POST $RAILWAY_URL/run/weekly -d '{"forceNoWinner":true}'` → poll status → expect `awaiting-review` → `curl -X POST $RAILWAY_URL/run/{runId}/resume -d '{"selection":{"charityName":"The Quiet Foundation"}}'` → poll status → expect terminal completion

### Claude's Discretion

Planner has flexibility on:
- Exact Dockerfile multi-stage layout (single vs builder/runtime split — pick what's faster on Railway)
- Whether to use FastAPI `BackgroundTasks` or raw `asyncio.create_task` for invoking the graph asynchronously after `/run/weekly` returns
- Stub fixture exact text content — must be Jesse-voice-ish (dry, neutral, plausible) but does not need to be literary; "Lorem ipsum" is fine if the planner prefers obvious-stub markers
- Whether `_emit_event` payload construction lives in the wrapper or in each agent (the wrapper version is cleaner; per-agent is more flexible). Default: wrapper with a per-agent payload-builder hook.
- Exact CLI shape for `setup-checkpointer` (subcommand under `python -m eisenbalm_pipeline.cli` vs standalone script)
- Whether to use `pydantic.BaseModel` for FastAPI request bodies vs raw dicts — `BaseModel` recommended for `/run/weekly` body validation
- Logging library choice (`logging` stdlib vs `structlog` vs `loguru`) — Railway captures stdout; recommend stdlib `logging` configured with JSON output for Railway log search
- Whether `validate_sections` node lives in `graph/builder.py` inline or as its own module (`agents/validate.py`)

### Folded Todos

(None — `gsd-tools todo match-phase 4` returned zero matches.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 4-specific contracts (read first)

- `docs/API_CONTRACTS.md §2` — Pipeline → Sanity writes (Python). Copy `write_charity`, `write_issue_draft`, `upload_pdf_to_issue`, `text_to_portable_text`, `set_charity_first_featured` verbatim into `lib/sanity_client.py` + `lib/portable_text.py`.
- `docs/API_CONTRACTS.md §3` — Pipeline → Convex (Python via HTTP `/api/mutation`). Copy `convex_mutation()` wrapper verbatim into `lib/convex_client.py`. Every call site in §3.1–3.6 is the canonical mutation payload shape — agents must match exactly.
- `docs/API_CONTRACTS.md §5` — Sanity → Pipeline webhook. Phase 4 only ships the **endpoint stub** (`POST /webhook/sanity-publish` returning 200, no HMAC yet). Real impl is Phase 6. Plan must add the route stub so Phase 6 doesn't churn the router.
- `docs/API_CONTRACTS.md §7` — LangGraph state contract. **`DispatchState` and all nested TypedDicts must match this section verbatim** in `graph/state.py`. Do not invent fields. Do not rename fields. Phase 5 expands the agent bodies; the state shape is locked here.

### Existing schemas (read; do not modify in Phase 4 beyond the two additive patches in D-39)

- `convex/schema.ts` — Five tables, all indexes. Phase 4 ADDS `durationMs` and `cost` to `pipelineRuns` (D-39). Everything else stays.
- `convex/pipelineRuns.ts` — `byRunId`, `create`, `updateStatus`. Phase 4 EXTENDS `updateStatus` args to accept the new `durationMs` and `cost` fields (D-39).
- `apps/studio/schemas/weeklyIssue.ts` — `pipelineMetadata` field (look for it; Phase 4 stub draft writes runId/startedAt/completedAt/modelVersions/cost there). If `cost` is not present in the schema, add it as `defineField({ name: 'cost', type: 'text', description: 'JSON-stringified per-agent cost summary' })`.
- `apps/studio/sanity.types.ts` — regenerated by `pnpm sanity:typegen` after the schema patch above; `@eisenbalm/shared` re-export picks it up automatically.

### Project / brand

- `CLAUDE.md` — "do not modify field names without checking API_CONTRACTS.md first" rule
- `docs/CLAUDE_CODE_BRIEF.md` §"The nine-agent pipeline" (lines ~78–210) — canonical agent sequence + each agent's input/output contract. The stub fixture text should be in Jesse's voice (dry, neutral) but planner has discretion on literary quality.

### Prior CONTEXT.md files (consumed)

- `.planning/phases/01-sanity-foundation/01-CONTEXT.md` — Sanity workspace conventions (deterministic `_id`s, manual init checkpoint pattern, env wiring discipline)
- `.planning/phases/02-web-shell-theme-engine/02-CONTEXT.md` — `python-slugify` mention not present (verify); `issue-{issueNumber}` deterministic `_id` pattern locked
- `.planning/phases/03-convex-deployment/03-CONTEXT.md` — Convex HTTP API contract (D-22), `Authorization: Convex {key}` header pattern, `_generated/` artifacts checked in, manual deploy step, Phase 4 unblocked for Python pipeline writes

### Phase 4 research artifacts (auto-loaded)

- `.planning/research/STACK.md` "Pipeline Backend Layer" — pinned Python deps (D-04). Phase 4 planner copies pins verbatim.
- `.planning/research/PITFALLS.md` §1.3 (Parallel phase partial failure → `validate_sections` node, D-14)
- `.planning/research/PITFALLS.md` §1.5 (Per-run cost runaway → iteration limit decorator, D-25)
- `.planning/research/PITFALLS.md` §1.4 (OpenRouter alias drift → model pinning, deferred to Phase 5 but the `modelVersions` JSON field is set up here)
- `.planning/codebase/INTEGRATIONS.md` "OpenRouter / Tavily / Suno / NotebookLM" — integration points; Phase 4 stubs do NOT call any of these but reserves the env vars + client module paths

### Phase 4 dedicated research flag (planner will spawn `gsd-phase-researcher`)

- **LangGraph `interrupt()` + `AsyncPostgresSaver` integration patterns** — exact version pairing (`langgraph@1.1.10` + `langgraph-checkpoint-postgres`), `Command(resume=...)` semantics, behavior on Railway container restart mid-interrupt (does the checkpoint survive? does the resumed graph re-emit `interrupt()` or pick up at the next node?), Supabase Postgres connection pooling with `AsyncPostgresSaver`. This is the load-bearing pattern for the entire phase — researcher must produce a code-level walkthrough in `04-RESEARCH.md` before planner writes the plan.

### Phase 6 forward link (Phase 4 contract owed)

- `POST /webhook/sanity-publish` endpoint stub (no HMAC, no idempotency, no 30s delay) — Phase 4 ships the route at `api/webhooks.py` returning `{ ok: true }`; Phase 6 hardens it
- `POST /run/{runId}/publish` manual fallback — Phase 4 ships the route + invokes the Publisher node directly; Phase 6 wires the real WeasyPrint PDF generation inside the Publisher node body

### Phase 5 forward link (Phase 4 contract owed)

- `@agent_node` decorator is the stable interface — Phase 5 only changes agent bodies, not the decorator
- `lib/openrouter_client.py` module path exists (even if stub) — Phase 5 fills in the real `ChatOpenAI` instantiation
- `EISENBALM_STUB_MODE` env var is the single toggle — Phase 5 flips the default + adds the real-mode code path inside the openrouter client

### Phase 9 forward link (Phase 4 contract owed)

- Every Convex event row written during a Phase 4 stub run satisfies the live deliberation queries Phase 9 will subscribe to — the deliberation accordion empty state from Phase 3's `DeliberationSlot` placeholder graduates to real data when Phase 5 runs against real LLMs

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `packages/pipeline/README.md` + `packages/pipeline/package.json` (placeholder) — Phase 1 reserved the workspace slot. Phase 4 rewrites README, deletes `tsconfig.json` (Python lives here, not TS), keeps `package.json` empty so pnpm still discovers the workspace.
- `docs/API_CONTRACTS.md §2.4 text_to_portable_text` — copy verbatim into `lib/portable_text.py`. No design work.
- `docs/API_CONTRACTS.md §3 convex_mutation` — copy verbatim into `lib/convex_client.py`. No design work.
- `docs/API_CONTRACTS.md §7 DispatchState` — copy verbatim into `graph/state.py`. No design work.
- Phase 2 demo charity "The Quiet Foundation" (Sanity `_id = charity-the-quiet-foundation`) — stub Scout/Editor reuses this so stub runs don't pollute the charity database with fake test entries
- Phase 3 Convex HTTP API contract (`Authorization: Convex {CONVEX_DEPLOY_KEY}`, `POST /api/mutation`) — Phase 4 pipeline is the first real caller; Phase 3 already verified the pathway works via `curl` smoke test
- `apps/studio/schemas/weeklyIssue.ts pipelineMetadata` — open metadata object exists on the schema (verify exact field shape during planning); `runId`, `startedAt`, `completedAt`, `modelVersions` already accommodated

### Established Patterns

- **Manual interactive CLI checkpoints by Andrew** for external services (Phase 1 sanity init, Phase 3 convex init) — Phase 4 reuses for Railway + Supabase provisioning
- **Generated/derived artifacts checked in** (Phase 1 `sanity.types.ts`, Phase 3 `convex/_generated/`) — Phase 4 commits `uv.lock` for reproducible builds
- **`.env.local` (gitignored) + `.env.example` (committed) per workspace** — Phase 4 adds `packages/pipeline/.env.example`
- **Deterministic `_id`s for inserts** (Phase 1 `agent-{id}`, Phase 2 `charity-{slug}`, `issue-{padded}`) — Phase 4 reuses + uses `issue-999` for stub runs
- **Schema patches are additive, never breaking** — Phase 3 deployed five Convex tables; Phase 4 ADDS `durationMs` and `cost` to `pipelineRuns` without altering any existing field or index
- **Pin major+minor versions** (Phase 1 sanity@^5.24, Phase 2 next@^15.3, Phase 3 convex@^1.38) — Phase 4 pins every Python dep to exact patch (`fastapi==0.136.1` not `^0.136.1`) because Python pin semantics differ from npm + uv.lock provides reproducibility independently
- **Single production deployment per environment** (Phase 2 sanity production-only, Phase 3 convex single deployment) — Phase 4 holds the line: one Railway project, one Supabase project, no staging
- **README per workspace** for onboarding — Phase 4 rewrites `packages/pipeline/README.md`
- **No CI gates in v1** (Phase 1 D-15) — Phase 4 holds: integration tests run locally only
- **Field names locked across schemas + contracts + types** — Phase 4 `DispatchState` TypedDict mirrors API_CONTRACTS.md §7; Sanity writes use exact field names from `weeklyIssue.ts`; Convex mutations use exact arg names from `convex/*.ts` files

### Integration Points

- `packages/pipeline` → Convex HTTP API (new) — first cross-language datastore boundary; Phase 4 owns the Python side, Phase 3 already shipped the Convex side
- `packages/pipeline` → Sanity write API (new) — Python SDK; idempotent create-or-replace per Phase 1 + 2 patterns
- `packages/pipeline` → Supabase Postgres (new) — exclusively via `AsyncPostgresSaver`; no direct queries
- Sanity → pipeline (new endpoint, stub-only in Phase 4) — `POST /webhook/sanity-publish` route exists, returns 200, no HMAC; Phase 6 hardens
- Manual `POST /run/{runId}/publish` (new) — fallback re-trigger; Phase 4 ships endpoint + invokes Publisher node; Phase 6 wires real PDF + Vercel deploy hook

### Constraints from Existing Code

- `convex/` is at repo root per brief — Phase 4 does NOT relocate; it patches the schema in place (additive only) and redeploys
- `convex/schema.ts` field names are locked except for the two additive patches (D-39); the `updateStatus` mutation signature is extended, not replaced
- Sanity schemas are not free to extend without a TypeGen regeneration — the `pipelineMetadata.cost` schema field requires running `pnpm sanity:typegen` after the change so `@eisenbalm/shared` re-exports the new shape
- pnpm-workspace.yaml already includes `packages/*` (Phase 1 D-06 confirmed) — no workspace surgery needed for Phase 4
- Phase 2's `pnpm dev:web` and Phase 3's `pnpm --filter @eisenbalm/convex deploy` patterns establish the per-workspace command shape — Phase 4 follows with `pnpm --filter pipeline dev` (which shells out to `uv run uvicorn ...`)

</code_context>

<specifics>
## Specific Ideas

- **Stub mode must produce a publishable-shape Sanity draft.** Andrew (or an engineer) should be able to open the stub draft in Studio and see every section populated with sensible-looking placeholder text — not "TODO" markers, not empty fields, not visible "STUB" labels in the rendered output. Why: this validates the WHOLE shape (PIP-04 + PIP-07) and lets Phase 5 swap real agents in without re-validating the Sanity write path.

- **The wrapper decorator is the Phase 4 → Phase 5 contract.** If `@agent_node(name='scout')` works in stub mode, Phase 5 only needs to replace the function body and add an `openrouter_client` call inside. No new infrastructure in Phase 5. This is the single most important architectural decision in this phase.

- **Stub Editor gate 1 has two modes:** default mode picks the highest advocate score as winner; `forceNoWinner` mode triggers `interrupt()`. Both paths must be tested in Phase 4 (D-36). Phase 5 will add nuance (deliberation transcript quality, runner-up rationale) but the gate mechanics stay.

- **Phase 4 is the cheapest defense against Phase 5 cost runaway.** Every iteration limit, error envelope, cost-recording slot, and validation node exists in stub mode so Phase 5's first real run has guardrails on day one. PITFALLS.md §1.5 is the source for this discipline.

- **The two Convex schema patches (D-39) are the only schema migration in Phase 4.** Plan must call them out as a discrete task with: schema diff, redeploy command (`pnpm --filter @eisenbalm/convex deploy`), TypeScript regeneration check (auto in convex deploy), and a one-line README update. No other Phase 3 contract churns.

- **Andrew's first run after Phase 4 should be one curl command.** README must produce a 6–8 line shell session that, once Railway + Supabase are provisioned, runs the entire stub pipeline end-to-end. If it takes more than a single page of README copy-paste, the onboarding is too heavy.

- **The integration test (PIP-06) is the proof.** If the test passes locally + against the deployed Railway URL, the phase is done. If it fails, no manual smoke can fill the gap.

</specifics>

<deferred>
## Deferred Ideas

- **LangSmith tracing** — useful for Phase 5 debugging but adds env + cost burden in stub mode; defer to Phase 5 with a one-line `langsmith` package install + env var add.
- **Per-developer Supabase Postgres databases** — single production database mirrors Phase 2/3 single-deployment pattern; revisit only if there are multiple engineers and migration conflicts appear.
- **Sanity Studio custom field renderer for `pipelineMetadata.cost`** (raw JSON is acceptable in v1) — defer to Phase 5 or v2 when there's a real cost shape worth visualizing.
- **`partial-failure` status value** in `pipelineRuns.status` enum — schema-change cascade not worth it for v1; PITFALLS.md §1.3 noted but D-26 routes through `failed + errorMessage`.
- **Retry logic with exponential backoff for OpenRouter** — Phase 5 problem, not Phase 4. Stub mode never makes network calls to fail.
- **Per-section retry on individual writer failure** (PITFALLS.md §1.3 suggests "GameWriter fails → retry once with simplified prompt") — Phase 5 or Phase 7 (Game-specific retry) problem.
- **Cron-triggered weekly `/run/weekly`** — v2 per REQUIREMENTS.md V2-03. v1 is manually triggered (Andrew curl or admin button later).
- **Authentication on FastAPI endpoints beyond shared-secret header** — v1 lives behind Railway URL obscurity + the trigger secret; v2 might add proper API auth if the surface grows.
- **Per-run cost runaway alerting** (PITFALLS.md §1.5) — Phase 5 problem when costs are real; Phase 4 ships the infrastructure (D-22) but no alerts.
- **OpenRouter model version pinning** (PITFALLS.md §1.4) — Phase 5 problem; Phase 4 ships the `modelVersions` JSON field but stub mode records `{}`.
- **Researcher founder-name source verification via `httpx`** (AGT-08) — Phase 5; Phase 4 stub Researcher returns a hardcoded `founderName` + `founderNameSourceUrl`.
- **Calibrator `bonusType` rotation logic** (AGT-01) — Phase 5; Phase 4 stub Calibrator returns hardcoded `bigBudget`.
- **DesignAgent hex/font whitelist enforcement** (AGT-13, AGT-14) — Phase 5; Phase 4 stub DesignAgent returns a known-valid theme.
- **GameWriter embedCode validator** (GAM-02) — Phase 7; Phase 4 stub GameWriter returns `embedCode: '<html><body><p>stub-game</p></body></html>'`.
- **Custom Sanity Studio warning banner for partial failures** (PITFALLS.md §1.3 implementation) — Phase 5 or 9; Phase 4 surfaces via Convex `errorMessage` field.
- **Real Suno/NotebookLM integration** — V2 per REQUIREMENTS.md V2-01, V2-02.
- **A `/dev/replay` endpoint** that takes a `runId` and re-runs the pipeline from a specific checkpoint — useful Phase 5+ debugging; defer.

### Reviewed Todos (not folded)

(None — no todos were reviewed; `gsd-tools todo match-phase 4` returned 0 matches.)

</deferred>

---

*Phase: 04-pipeline-skeleton*
*Context gathered: 2026-05-13*
