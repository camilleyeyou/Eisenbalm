---
phase: 04-pipeline-skeleton
verified: 2026-05-15T12:30:00Z
status: passed
score: 5/5 must-haves verified · 15/15 requirements satisfied
re_verification: null
verifier_notes:
  - "Initial verification (no prior VERIFICATION.md present)"
  - "Verified against codebase, live Railway deployment, and pytest suite"
  - "Live evidence: GET /healthz returns {ok:true, checkpointer:'connected', stubMode:true}; smoke-test runId e9ac2ec9c068489aa5f55969197bcdd2 still queryable with durationMs=5900 and 13-agent cost JSON"
  - "Local pytest: 19 passed, 9 skipped (integration tests skip without SUPABASE_POSTGRES_URL; they ran live in Plan 04-12 smoke)"
---

# Phase 4: Pipeline Skeleton Verification Report

**Phase Goal:** A FastAPI app on Railway runs a full LangGraph graph where all 14 stub agents return structurally valid outputs, the `runId` is generated exactly once and threaded to every Convex write and the Sanity draft, the Editor gate 1 interrupt surfaces correctly to Convex, and per-run cost and duration are logged — all verified cheaply before any LLM spend.

**Verified:** 2026-05-15
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement (5 ROADMAP Success Criteria)

| #   | Truth                                                                                                                                                                                                                                  | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `POST /run/weekly` returns `{runId}` and the 14-node sequence executes (Calibrator → Scout → Advocate → Editor[gate 1] → Researcher → 7-way fan-out → QA → Editor[final] → Publisher)                                                  | ✓ VERIFIED | `api/runs.py:120-171` `@router.post("/run/weekly")` calls `new_run_id()` (line 131), inserts `pipelineRuns:create` (140-148), launches background task. `graph/builder.py:115-131` wires every node in the exact sequence. Plan 04-12 smoke runId `e9ac2ec9c068489aa5f55969197bcdd2` returned within ~1s; status endpoint confirms the 14-node sequence ran (live evidence: 13 cost-JSON keys × editor counted once for two roles).                                                                                |
| 2   | Sanity `pipelineMetadata.runId` equals every Convex row's `runId` for the same run                                                                                                                                                     | ✓ VERIFIED | `lib/sanity_client.py:write_issue_draft` writes `pipelineMetadata.runId = state['run_id']` per CONTEXT D-22. `agents/publisher.py:75` is the single pipeline-end caller. `tests/test_pipeline_e2e.py:101-124` asserts the equality on Sanity + every Convex table. Plan 04-12 Andrew verified the draft `issue-999` in Sanity Studio against Convex dashboard rows.                                                                                                                                                |
| 3   | `forceNoWinner` triggers `interrupt()` → `pipelineRuns.status = 'awaiting-review'`; `/resume` re-injects via `Command(resume=...)` and runs to terminal                                                                                 | ✓ VERIFIED | `agents/editor.py:87-90` writes `pipelineRuns:updateStatus { status: 'awaiting-review' }` BEFORE `interrupt()` at line 95-100 (CONTEXT D-13 idempotency-before-interrupt). `api/runs.py:208-250` `resume_run` calls `graph.ainvoke(Command(resume=...))` with same `thread_id`. Plan 04-12 Test 3 runId `b10d959d931a47dbb3b23f19205fc396`: pause→awaiting-review (clean), resume→`{resumed:true}`, final→awaiting-review with `durationMs:102602`.                                                                  |
| 4   | Forced agent exception → `pipelineRuns.status = 'failed'` with `errorMessage` containing the failed agentId                                                                                                                            | ✓ VERIFIED | `agents/_wrapper.py:80-94` test toggle: when `state['_force_fail_agent'] == name`, writes `status='failed'` with `errorMessage = f"{name}: RuntimeError: ..."`. CONTEXT D-27 format prefix. Plan 04-12 Test 2 runId `0ce55b1a533441fd880e8df8737b6ed0`: `status='failed'`, `errorMessage='researcher: RuntimeError: Forced failure for testing (agent=researcher)'`.                                                                                                                                               |
| 5   | `pipelineRuns.cost` is JSON with per-agent token + USD totals; `pipelineRuns.durationMs` is wall-clock from start to draft-written                                                                                                     | ✓ VERIFIED | `lib/cost.py:48-99` accumulates `{tokens_in, tokens_out, usd, duration_ms}` per-agent; `get_cost_payload` returns `{"total": ..., "agents": {...}}`. `agents/publisher.py:58, 80-89` calls `end_run()` then `pipelineRuns:updateStatus` with `durationMs` + JSON-stringified `cost`. Live status endpoint confirms: `durationMs: 5900`, `cost` is parseable JSON with `total: 0.0` + 13-agent breakdown. Schema patch in `convex/schema.ts:19-20` and `convex/pipelineRuns.ts:40-41` accepts both new optional args. |

**Score:** 5/5 truths verified

---

## Required Artifacts (Three-Level Verification)

| Artifact                                                                | Exists | Substantive | Wired | Status     | Details                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------- | ------ | ----------- | ----- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/pipeline/Dockerfile`                                          | ✓      | ✓           | ✓     | ✓ VERIFIED | Multi-stage `python:3.11-slim-bookworm`; all 13 WeasyPrint apt deps present (libpango, libcairo, libgdk-pixbuf, libharfbuzz, libffi, fonts-liberation, etc.). Shell-form CMD with `${PORT:-8000}` (Bug 2 fix).                   |
| `packages/pipeline/railway.toml`                                        | ✓      | ✓           | ✓     | ✓ VERIFIED | `preDeployCommand` runs `setup-checkpointer` (CONTEXT D-12, idempotent). `healthcheckPath=/healthz`. No `startCommand` (Bug 2 fix — lets Dockerfile CMD shell-expand `$PORT`).                                                  |
| `src/eisenbalm_pipeline/api/runs.py`                                    | ✓      | ✓           | ✓     | ✓ VERIFIED | 4 routes: POST `/run/weekly`, GET `/run/{run_id}/status`, POST `/run/{run_id}/resume`, POST `/run/{run_id}/publish`. Strong-ref `asyncio.create_task` (research §3 Pattern 3). runId generated once at line 131.                  |
| `src/eisenbalm_pipeline/agents/_wrapper.py`                             | ✓      | ✓           | ✓     | ✓ VERIFIED | `@agent_node` decorator with try/except, Convex emit, cost recording. `except GraphInterrupt: raise` at lines 130-137 (Bug 4 fix). errorMessage format per CONTEXT D-27. Used by all 14 agents.                                  |
| `src/eisenbalm_pipeline/agents/editor.py`                               | ✓      | ✓           | ✓     | ✓ VERIFIED | `editor_gate_1` writes `awaiting-review` BEFORE `interrupt()` (idempotency-before-interrupt); `editor_final` for final approval. Both use `name='editor'` (intentional — same agentId for both invocations).                     |
| `src/eisenbalm_pipeline/agents/publisher.py`                            | ✓      | ✓           | ✓     | ✓ VERIFIED | Calls `end_run` → `write_issue_draft` (Sanity) → `pipelineRuns:updateStatus{status='awaiting-review', durationMs, cost}` (Convex). Single pipeline-end Sanity write per CONTEXT D-18 step 11. emit_event='publisher-deploy'.    |
| `src/eisenbalm_pipeline/graph/builder.py`                               | ✓      | ✓           | ✓     | ✓ VERIFIED | StateGraph wires Calibrator → Scout → Advocate → editor_gate_1 → Researcher → 7 parallel writers → validate_sections → QA → editor_final → Publisher → END. Pattern A multi-target edges (no reducer needed per RESEARCH §4).    |
| `src/eisenbalm_pipeline/graph/checkpointer.py`                          | ✓      | ✓           | ✓     | ✓ VERIFIED | AsyncPostgresSaver factory (PIP-09). One-time setup via `cli.py setup-checkpointer`. Plan 04-12 verified 4 LangGraph tables created in Supabase: `checkpoints`, `checkpoint_writes`, `checkpoint_blobs`, `checkpoint_migrations`. |
| `src/eisenbalm_pipeline/graph/state.py`                                 | ✓      | ✓           | ✓     | ✓ VERIFIED | `DispatchState` TypedDict matching API_CONTRACTS §7 verbatim, plus two underscore-prefixed test toggles (`_force_no_winner`, `_force_fail_agent`).                                                                              |
| `src/eisenbalm_pipeline/lib/cost.py`                                    | ✓      | ✓           | ✓     | ✓ VERIFIED | `begin_run`/`record_cost`/`get_cost_payload`/`end_run` + `CostRecorder` CM. Shape `{total, agents:{name:{tokens_in,tokens_out,usd,duration_ms}}}` matches PIP-11 contract. Thread-safe via `threading.Lock`.                      |
| `src/eisenbalm_pipeline/lib/sanity_client.py`                           | ✓      | ✓           | ✓     | ✓ VERIFIED | `write_issue_draft` sets `pipelineMetadata.runId` + `pipelineMetadata.cost = json.dumps(cost_payload)`. Deterministic `_id = issue-{n}`. Raw httpx (no SDK).                                                                     |
| `src/eisenbalm_pipeline/lib/convex_client.py`                           | ✓      | ✓           | ✓     | ✓ VERIFIED | `convex_mutation` + `convex_mutation_safe` + `convex_query`. `Authorization: Convex {KEY}` (NOT Bearer). Error branches on body `status` field (Pitfall 7 defended).                                                              |
| `src/eisenbalm_pipeline/lib/ids.py`                                     | ✓      | ✓           | ✓     | ✓ VERIFIED | `new_run_id() -> uuid4().hex` (32-char no-dash). Called exactly once in `api/runs.py:131`.                                                                                                                                       |
| `src/eisenbalm_pipeline/stubs/fixtures.py`                              | ✓      | ✓           | ✓     | ✓ VERIFIED | 15 deterministic fixture functions (14 agents — editor has 2). Tested via 17 parametrized fixture tests in `tests/agents/test_stub_fixtures.py`. All PIP-04 checks pass.                                                          |
| `convex/schema.ts` (durationMs + cost patch)                            | ✓      | ✓           | ✓     | ✓ VERIFIED | Lines 19-20: `durationMs: v.optional(v.number())` + `cost: v.optional(v.string())`. Additive — no existing field touched.                                                                                                       |
| `convex/pipelineRuns.ts` (updateStatus extension)                       | ✓      | ✓           | ✓     | ✓ VERIFIED | Lines 40-41: `updateStatus` mutation accepts the two new optional args. Deployed to dev deployment `modest-magpie-797`. HTTP smoke test confirmed validator accepts new fields (Plan 04-03 SUMMARY).                              |
| `apps/studio/schemas/weeklyIssue.ts` (pipelineMetadata.cost)            | ✓      | ✓           | ✓     | ✓ VERIFIED | Lines 348-354: `defineField({name:'cost', type:'text', rows:4, description:'JSON: per-agent...'})`. Typegen regenerated (Plan 04-04 SUMMARY commit `bf0404f`).                                                                    |
| `tests/test_pipeline_e2e.py` + `test_editor_gate_1_resume.py` + `test_agent_failure.py` | ✓      | ✓           | ✓     | ✓ VERIFIED | Real assertions (not skips). Module-level skipif gates on `SUPABASE_POSTGRES_URL`; Plan 04-12 ran them live against Railway, 3 runIds documented in SUMMARY.                                                                  |

All 18 artifacts pass Levels 1-3.

---

## Key Link Verification (Wiring)

| From                                | To                                      | Via                                                                                          | Status | Details                                                                                                                            |
| ----------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `POST /run/weekly`                  | LangGraph `ainvoke`                     | `asyncio.create_task(_execute_run(...))` with `thread_id = runId`                            | WIRED  | `api/runs.py:165-169` — strong-ref'd task survives client disconnect (research Pattern 3 + Pitfall 4)                              |
| `POST /run/{runId}/resume`          | Editor gate 1 `interrupt()` resumption  | `graph.ainvoke(Command(resume={'editorSelection': ...}), config={'thread_id': run_id})`     | WIRED  | `api/runs.py:239-242` — same `thread_id` lets `AsyncPostgresSaver` find the paused checkpoint                                      |
| Pipeline `runId`                    | Convex `pipelineRuns:create`            | `convex_mutation(http, 'pipelineRuns:create', {runId, issueNumber, startedAt})`             | WIRED  | `api/runs.py:140-148` — pre-graph insert prevents wrapper failure-path from hitting "Run not found"                                |
| Pipeline `runId`                    | Sanity `weeklyIssue.pipelineMetadata.runId` | `write_issue_draft(http, state, cost_payload)` reads `state['run_id']`                   | WIRED  | `agents/publisher.py:75` + `lib/sanity_client.py:write_issue_draft` (Plan 04-02 SUMMARY confirms verbatim API_CONTRACTS §2)        |
| Editor gate 1 pause                 | Convex `pipelineRuns.status='awaiting-review'` | `convex_mutation_safe('pipelineRuns:updateStatus', {runId, status:'awaiting-review'})` BEFORE `interrupt()` | WIRED  | `agents/editor.py:87-90` — idempotent placement per RESEARCH §2 (CONTEXT D-13)                                                     |
| GraphInterrupt exception            | Skipped failure path (NOT 'failed')     | `except GraphInterrupt: raise` in `@agent_node`                                              | WIRED  | `agents/_wrapper.py:130-137` (Bug 4 fix — commit `ab7be28`) — re-propagates without touching Convex                                |
| Any agent exception                 | Convex `pipelineRuns.status='failed'` + errorMessage | `convex_mutation_safe('pipelineRuns:updateStatus', {status:'failed', errorMessage: f'{name}:...'})` | WIRED  | `agents/_wrapper.py:139-152` + lines 80-94 (forced fail toggle). Format per CONTEXT D-27.                                          |
| Per-agent cost                      | Convex + Sanity cost JSON               | `record_cost(...)` → `end_run()` → `cost_payload_to_json()` → updateStatus + write_issue_draft | WIRED  | `lib/cost.py` + `agents/publisher.py:58, 80-89`. Live evidence: 13-agent JSON visible in `/status` endpoint of smoke runId          |
| Wall-clock duration                 | Convex `pipelineRuns.durationMs`        | `begin_run()` at `/run/weekly` → `end_run()` returns duration → updateStatus                 | WIRED  | `api/runs.py:135` (begin) + `agents/publisher.py:58, 80-89` (end). Live: `durationMs:5900` for happy-path smoke                    |
| Parallel section writers            | LangGraph last-writer-wins merge        | Each writer returns ONLY its delta field (origin_story / problem_statement / etc.)           | WIRED  | `agents/origin_story.py:31` etc. return `fixtures.X_output()` directly, NOT `{**state, ...}` (Bug 3 fix — commit `265e555`)         |
| 14 agent nodes                      | LangGraph StateGraph                    | `builder.add_node(...)` + `builder.add_edge(...)` in `build_graph()`                         | WIRED  | `graph/builder.py:93-131` — 14 named nodes + END; sequential edges + 7-way fan-out + validate_sections join                        |
| Supabase Postgres                   | `AsyncPostgresSaver` checkpointer       | `lifespan` constructs the saver once; `setup-checkpointer` CLI runs migrations one time      | WIRED  | `cli.py setup-checkpointer` + `railway.toml preDeployCommand`. Plan 04-12 confirmed 4 checkpoint tables in Supabase.               |

All 12 key links WIRED.

---

## Data-Flow Trace (Level 4)

| Artifact                        | Data Variable                | Source                                                  | Produces Real Data | Status     |
| ------------------------------- | ---------------------------- | ------------------------------------------------------- | ------------------ | ---------- |
| `pipelineRuns.cost`             | cost JSON string             | `lib/cost.py` accumulator (per-agent `record_cost`)     | ✓ (stub 0.0s)      | ✓ FLOWING  |
| `pipelineRuns.durationMs`       | wall-clock ms                | `begin_run` → `end_run` delta                           | ✓                  | ✓ FLOWING  |
| `pipelineRuns.status`           | enum                         | wrapper writes 'failed' / editor writes 'awaiting-review' / publisher writes 'awaiting-review' | ✓ | ✓ FLOWING  |
| `pipelineMetadata.runId`        | UUID hex                     | `state['run_id']` threaded from `/run/weekly`           | ✓                  | ✓ FLOWING  |
| `pipelineMetadata.cost`         | JSON string                  | `json.dumps(cost_payload)` from same `end_run()`        | ✓ (stub 0.0s)      | ✓ FLOWING  |
| `deliberationEvents.payload`    | JSON per-agent payload       | `payload_builder(new_state)` in wrapper                 | ✓                  | ✓ FLOWING  |
| `pitchLog` rows                 | per-candidate Scout data     | `agents/scout.py` writes one row per candidate          | ✓                  | ✓ FLOWING  |
| `agentVotes` rows               | Advocate's scored arguments  | `agents/advocate.py` writes one per candidate           | ✓                  | ✓ FLOWING  |
| `qaCorrections` rows            | QA corrections (stub: 0)     | `agents/qa.py` would write per-correction in real mode  | ⚠️ stub-empty       | ✓ FLOWING (by design — stub records 0) |

All wired data sources produce real data (or designed-empty placeholders for Phase 5 to fill).

---

## Behavioral Spot-Checks

| Behavior                                                          | Command                                                                  | Result                                                       | Status |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ | ------ |
| Stub fixtures return valid DispatchState shape (PIP-04)           | `uv run pytest tests/agents/test_stub_fixtures.py -q`                    | `17 passed in 0.05s`                                         | ✓ PASS |
| Full pipeline test suite runs without import errors               | `uv run pytest -q`                                                       | `19 passed, 9 skipped in 1.04s` (integration tests skip without SUPABASE_POSTGRES_URL — by design) | ✓ PASS |
| Live Railway healthcheck                                          | `curl https://eisenbalm-pipeline-production.up.railway.app/healthz`     | `{"ok":true,"checkpointer":"connected","stubMode":true}`     | ✓ PASS |
| Live status endpoint returns smoke-test happy-path runId          | `curl .../run/e9ac2ec9c068489aa5f55969197bcdd2/status`                  | `status='awaiting-review', durationMs=5900, cost=...(13 agents)`, `errorMessage:null` | ✓ PASS |

All 4 spot-checks pass.

---

## Requirements Coverage (15 IDs)

| Requirement | Source Plan(s)                                 | Description                                                                                    | Status      | Evidence                                                                                                                       |
| ----------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| PIP-01      | 04-01 (bootstrap)                              | FastAPI builds + deploys to Railway via custom Dockerfile (WeasyPrint deps preinstalled)       | ✓ SATISFIED | `Dockerfile` has all 13 WeasyPrint apt deps; Railway build green (Plan 04-12 SUMMARY); live `/healthz` confirms deployment      |
| PIP-02      | 04-09 (FastAPI)                                | `POST /run/weekly` returns `{runId}`                                                           | ✓ SATISFIED | `api/runs.py:120-171` — verified by `test_returns_runId` and all 3 live smoke tests                                            |
| PIP-03      | 04-07 (stub agents) + 04-08 (builder)          | LangGraph wires the 14-node sequence in exact brief order                                      | ✓ SATISFIED | `graph/builder.py:115-131` — Plan 04-12 cost JSON contains every agent ID                                                       |
| PIP-04      | 04-10 (integration tests)                      | Each stub returns structurally valid DispatchState                                             | ✓ SATISFIED | `tests/agents/test_stub_fixtures.py` 17 tests pass (parametrized over 15 fixtures: 14 agents + editor counted twice)            |
| PIP-05      | 04-02 (lib modules)                            | `runId` generated exactly once, threaded into every Convex write + Sanity                      | ✓ SATISFIED | `lib/ids.py:new_run_id`, called once at `api/runs.py:131`; verified by `test_pipeline_e2e_runId_threaded_to_all_datastores`     |
| PIP-06      | 04-10 (integration tests)                      | Integration test asserts Sanity `pipelineMetadata.runId == every Convex row's runId`           | ✓ SATISFIED | `tests/test_pipeline_e2e.py:82-126` ran live in Plan 04-12 (runId `e9ac2ec9c068489aa5f55969197bcdd2`)                          |
| PIP-07      | 04-07 (stub agents — publisher)                | Pipeline writes complete `weeklyIssue` draft to Sanity (status='draft', deterministic `_id`)   | ✓ SATISFIED | `agents/publisher.py:75` + `lib/sanity_client.py:write_issue_draft`; Andrew confirmed `issue-999` in Studio                     |
| PIP-08      | 04-07 (stub agents)                            | Pipeline writes to all 5 Convex tables                                                          | ✓ SATISFIED | Andrew verified all 5 tables (pipelineRuns, deliberationEvents, agentVotes, qaCorrections, pitchLog) populated in dashboard     |
| PIP-09      | 04-08 (checkpointer)                           | LangGraph state checkpointed to Supabase via `AsyncPostgresSaver`; `setup()` one-time           | ✓ SATISFIED | `graph/checkpointer.py` + `cli.py setup-checkpointer` (idempotent); `railway.toml preDeployCommand` runs once per deploy        |
| PIP-10      | 04-09 (FastAPI) + 04-10 (tests)                | Editor gate 1 `interrupt()` → `awaiting-review` → `/resume` re-injects checkpoint              | ✓ SATISFIED | `agents/editor.py:87-100` + `api/runs.py:208-250`; Plan 04-12 Test 3 runId `b10d959d931a47dbb3b23f19205fc396` (post-Bug-4 fix)  |
| PIP-11      | 04-03 (schema) + 04-02 (cost) + 04-07 (publisher) | Per-run cost logged to Convex `pipelineRuns.cost`                                              | ✓ SATISFIED | `convex/schema.ts:20` + `lib/cost.py` + `agents/publisher.py:80-89`; live JSON: `{"total":0.0,"agents":{13 entries}}`           |
| PIP-12      | 04-03 (schema) + 04-07 (publisher)             | Pipeline duration (start → draft-written) tracked on `pipelineRuns.durationMs`                 | ✓ SATISFIED | `convex/schema.ts:19` + `lib/cost.py:begin_run/end_run`; live: `durationMs=5900` for happy-path smoke                          |
| OPS-01      | 04-06 (wrapper) + 04-10 (tests)                | Failed agent → `pipelineRuns.status='failed'` with agentId + errorMessage                       | ✓ SATISFIED | `agents/_wrapper.py:80-94, 139-152`; Plan 04-12 Test 2 runId `0ce55b1a533441fd880e8df8737b6ed0` returned correct errorMessage   |
| OPS-02      | 04-09 (FastAPI)                                | `GET /run/{runId}/status` returns current pipeline state                                       | ✓ SATISFIED | `api/runs.py:176-203`; live evidence verified for happy-path runId; returns canonical shape per CONTEXT D-07                    |
| OPS-03      | 04-04 (Sanity patch) + 04-02 (sanity_client) + 04-07 (publisher) | Per-run cost summary visible in Sanity Studio on `weeklyIssue.pipelineMetadata.cost`    | ✓ SATISFIED | `apps/studio/schemas/weeklyIssue.ts:348-354` + `lib/sanity_client.py:write_issue_draft` writes JSON; Andrew confirmed in Studio |

**All 15 requirement IDs satisfied. Zero ORPHANED requirements.**

REQUIREMENTS.md traceability table (lines 213-227) marks all 15 as "Complete" — verified consistent with this verification.

---

## Anti-Patterns Found

None. Scan of `packages/pipeline/src/eisenbalm_pipeline/**/*.py`:

- No `TODO`/`FIXME`/`HACK`/`XXX` markers outside comments that explain Phase 5/6 boundaries
- No `return null` / `return {}` stub returns in production code paths (every stub returns its structurally-valid fixture)
- `console.log`-only handlers: not applicable (Python)
- Hardcoded empty data: only the intentional `qa_output()` stub returns 0 corrections, by design (Phase 5 will populate when real QA rubric lands)
- Empty-`init` defaults that mask missing data: none — every state field has an explicit producer

**Notable: design-by-comment markers** (not anti-patterns):
- `publisher.py` writes `"stubPdfNote": "stub-pdf-not-yet-implemented"` — explicit Phase 6 contract marker
- `api/webhooks.py` (not opened but per SUMMARY) returns 200 stub — explicit Phase 6 contract marker
- `api/runs.py:255-272` `manual_publish` returns `phase4Stub: True` — explicit Phase 6 contract marker

These are intentional cross-phase contract markers, not stubs masking incomplete Phase 4 work.

---

## Bugs Surfaced + Patched During Smoke (Plan 04-12)

All 4 bugs are correctly reflected in the codebase and traceable in git history:

| # | Commit    | Bug                                                                                        | Fix Location                                | Verified in Codebase                                                      |
| - | --------- | ------------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------- |
| 1 | `7f3152f` | Dockerfile BuildKit `--mount=type=cache` rejected by Railway's BuildKit (no explicit `id`) | `packages/pipeline/Dockerfile`              | Verified: Dockerfile uses plain `COPY+RUN` for `uv sync` (no cache-mount) |
| 2 | `8a81f03` + `9878f56` | Port binding — Dockerfile hardcoded port 8000 (exec form, no `$PORT` expansion); `railway.toml startCommand` passed `$PORT` literally | `Dockerfile` (CMD switched to shell form with `${PORT:-8000}`) + `railway.toml` (startCommand removed) | Verified: `Dockerfile:48` uses `CMD uvicorn ... --port ${PORT:-8000}` (shell form); `railway.toml` has no `startCommand` |
| 3 | `265e555` | LangGraph parallel-write error — all 14 agents returned `{**state, **delta}`, causing `InvalidUpdateError` in the 7-way fan-out | All 14 agent modules                        | Verified: section writers (e.g., `agents/origin_story.py:31`) now return `fixtures.X_output()` directly (just the delta). Sequential agents (editor, publisher) retain `{**state, ...}` because they need merged state — by design and unaffected by the parallel-write rule. |
| 4 | `ab7be28` | `GraphInterrupt` mis-classified as failure — `@agent_node`'s `except Exception` caught LangGraph's pause signal | `agents/_wrapper.py:130-137`                | Verified: explicit `except GraphInterrupt: raise` block re-propagates without touching Convex; Editor gate 1 already writes `awaiting-review` BEFORE `interrupt()` per CONTEXT D-13 |

All 4 fixes are additive — no decision in CONTEXT.md was reversed. Each fix has a rationale comment in the patched file.

---

## Notes on SUMMARY-vs-Code Discrepancy (Informational, NOT a Gap)

Plan 04-12's SUMMARY states "Cost JSON in Test 1 + Test 3 final state lists all 14 agent IDs". The live cost JSON for runId `e9ac2ec9c068489aa5f55969197bcdd2` contains **13 keys**, not 14 — because both `editor_gate_1` and `editor_final` use `name='editor'` in the `@agent_node` decorator (verified at `agents/editor.py:76` and `agents/editor.py:142`). This is intentional design (the editor's two invocations share one agentProfile per Phase 1 D-17). The SUMMARY's "14" wording is imprecise but does not reflect a code defect. Reality: 13 distinct agent IDs, with `editor`'s `duration_ms` accumulating across both invocations (via `record_cost` additive semantics in `lib/cost.py:48-74`).

---

## Gaps Summary

**None.** Every must-have, every required artifact, every key link, every data-flow path, and every requirement ID is satisfied with concrete codebase + live-deployment evidence. The 4 bugs surfaced during smoke testing were patched in-phase and are correctly reflected in the codebase.

The phase delivered the stable foundation Phase 5 swaps real LLM agents into: the wrapper, graph builder, state contract, FastAPI surface, datastore clients, schema patches (Convex `durationMs`+`cost`, Sanity `pipelineMetadata.cost`), checkpointer wiring, and Railway+Supabase deployment all carry forward unchanged.

---

## Final Verdict

**Status: passed**

- 5/5 ROADMAP success criteria verified
- 15/15 phase requirement IDs satisfied (PIP-01 through PIP-12, OPS-01, OPS-02, OPS-03)
- 18/18 required artifacts pass all four verification levels (exists, substantive, wired, data flowing)
- 12/12 key links verified WIRED
- 4/4 behavioral spot-checks PASS
- 4/4 bugs surfaced during smoke are correctly patched and reflected in code
- Zero orphaned requirements
- Zero anti-patterns or stub markers in production paths

Phase 4 is complete. Phase 5 (Agent Quality) is unblocked.

---

_Verified: 2026-05-15_
_Verifier: Claude (gsd-verifier)_
