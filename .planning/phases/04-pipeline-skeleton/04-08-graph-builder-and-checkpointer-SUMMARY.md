---
phase: 04-pipeline-skeleton
plan: 08
subsystem: infra
tags: [langgraph, async-postgres-saver, supabase, psycopg-pool, fastapi-lifespan, parallel-fan-out, state-graph, checkpointer, interrupt-resume, partial-failure]

# Dependency graph
requires:
  - phase: 04-pipeline-skeleton
    provides: "DispatchState TypedDict (Plan 02), convex_mutation_safe (Plan 02), 14 stub agent modules (Plan 07 — running in parallel and now merged), pinned langgraph==1.1.10 / langgraph-checkpoint-postgres==3.1.0 / psycopg[binary]>=3.2 (Plan 01)"
provides:
  - "build_graph(checkpointer) -> CompiledStateGraph factory wiring all 14 agents + validate_sections in the brief's exact sequence"
  - "create_pool() / create_checkpointer(pool) / assert_tables_exist(pool) — AsyncPostgresSaver lifecycle factory with defensive psycopg pool kwargs"
  - "validate_sections join node with REQUIRED_FIELDS tuple (origin_story, problem_statement, founder_bio, case_study, game, bonus, theme)"
  - "python -m eisenbalm_pipeline.cli setup-checkpointer — one-time DDL migration entrypoint"
affects: [04-09-fastapi-app-and-routers, 04-10-integration-tests, 04-12-smoke-test, phase-05-real-agents, phase-09-frontend-deliberation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lifespan-managed AsyncPostgresSaver: pool + AsyncPostgresSaver(pool), NOT from_conn_string in lifespan (research §1 Pattern 1)"
    - "Defensive psycopg kwargs (prepare_threshold=None, autocommit=True, row_factory=dict_row) so the saver degrades gracefully if env points at Supabase transaction pooler (research Pitfall 1)"
    - "Fail-fast tables assertion via SELECT to_regclass('public.checkpoints') in lifespan — never auto-runs DDL (research Pitfall 3)"
    - "Parallel fan-out via Pattern A plain multi-target add_edge calls — no Send API, no Annotated reducers (research §4)"
    - "validate_sections join node — explicitly NOT @agent_node-decorated to avoid double-write of failed status (research §4)"
    - "errorMessage prefix 'partial-failure: missing sections [...]' instead of new status enum value (CONTEXT D-26)"
    - "Dual AsyncPostgresSaver usage: from_conn_string async-with for one-shot CLI DDL vs AsyncConnectionPool + AsyncPostgresSaver(pool) for long-lived lifespan (research §1)"

key-files:
  created:
    - "packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py — AsyncPostgresSaver factory + fail-fast tables check"
    - "packages/pipeline/src/eisenbalm_pipeline/graph/builder.py — build_graph(checkpointer) StateGraph wiring"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/validate.py — validate_sections join node + REQUIRED_FIELDS"
    - "packages/pipeline/src/eisenbalm_pipeline/cli.py — setup-checkpointer CLI subcommand"
  modified: []

key-decisions:
  - "validate_sections placed under agents/ (planner discretion per CONTEXT) — keeps all graph nodes co-located with the 14 editorial agents while remaining structurally distinct (no @agent_node decorator)"
  - "SECTION_WRITERS (7 entries: origin_story, problem, founder_bio, case_study, game, bonus, design) aligns with validate.REQUIRED_FIELDS, but the writer node name `design` writes to the `theme` DispatchState field (per CONTEXT D-18 — Design writes `theme`, not `design`) — this asymmetry is documented in both modules"
  - "Pattern A plain multi-target edges chosen over Send API because Phase 4 has a FIXED 7 writers (not data-driven); each writer mutates a distinct field so no Annotated reducers are needed (research §4 'Why this works without reducers')"
  - "Two AsyncPostgresSaver patterns coexist: cli.py uses from_conn_string async-with (one-shot DDL); graph/checkpointer.py uses pool + AsyncPostgresSaver(pool) (long-lived lifespan). Both are valid per research §1"
  - "build_graph imports the 14 agent modules at module top — module is only imported by Plan 09's lifespan AFTER both Plan 07 and Plan 08 have merged"

patterns-established:
  - "Module-level SECTION_WRITERS tuple: graph topology asserted as data, not buried in code; future plans inspect or extend it"
  - "Fail-fast lifespan assertion separate from DDL: assert_tables_exist() is called by lifespan; cli.setup_checkpointer() is called by deploy step (railway preDeployCommand). Same module never does both."
  - "Defensive psycopg pool kwargs documented inline: every kwarg comment explains the failure mode it prevents (Pitfall 1 lookalike errors)"

requirements-completed: [PIP-09]

# Metrics
duration: 6min
completed: 2026-05-14
---

# Phase 04 Plan 08: Graph Builder + Checkpointer Summary

**14-node LangGraph StateGraph with parallel 7-writer fan-out, AsyncPostgresSaver lifecycle factory against Supabase Postgres, validate_sections join node with `partial-failure:` errorMessage prefix, and one-time `setup-checkpointer` CLI.**

## Performance

- **Duration:** ~6 min (parallel with Plan 04-07)
- **Started:** 2026-05-14T02:50:54Z
- **Completed:** 2026-05-14T02:56:52Z
- **Tasks:** 4
- **Files created:** 4

## Accomplishments

- **graph/checkpointer.py:** `create_pool` returns `AsyncConnectionPool(prepare_threshold=None, autocommit=True, row_factory=dict_row)` — defensive kwargs ensure AsyncPostgresSaver works even if env ever targets the Supabase transaction pooler instead of the session pooler. `assert_tables_exist` runs `SELECT to_regclass('public.checkpoints')` and raises with a pointed CLI hint if missing. `_conn_string()` raises a session-pooler-format hint on missing env var.
- **graph/builder.py:** `build_graph(checkpointer)` wires START → calibrator → scout → advocate → editor_gate_1 → researcher → 7-way parallel fan-out → validate_sections → qa → editor_final → publisher → END. Uses Pattern A plain multi-target `add_edge` calls (no Send API, no Annotated reducers) because each writer mutates a distinct DispatchState field. Graph compiles to a 16-internal-node `CompiledStateGraph` (14 agents + validate + START/END).
- **agents/validate.py:** `validate_sections` is the post-fan-out join node. `REQUIRED_FIELDS = ('origin_story', 'problem_statement', 'founder_bio', 'case_study', 'game', 'bonus', 'theme')`. On any missing field it writes `pipelineRuns:updateStatus` with `status='failed'` and `errorMessage='partial-failure: missing sections [...]'` then raises `RuntimeError` to halt the graph. **NOT** decorated with `@agent_node` (avoids double-write of failed status per research §4).
- **cli.py:** `python -m eisenbalm_pipeline.cli setup-checkpointer` calls `AsyncPostgresSaver.from_conn_string(db_url)` and `cp.setup()` — idempotent DDL that creates the 4 LangGraph tables. Exits 2 with a clean error message if `SUPABASE_POSTGRES_URL` is unset; exits 1 with usage on no args.

## Task Commits

1. **Task 1: graph/checkpointer.py — AsyncPostgresSaver factory** — `066eaa9` (feat)
2. **Task 2: agents/validate.py — validate_sections join node** — `d2bf676` (feat)
3. **Task 3: graph/builder.py — 14-node StateGraph wiring** — `5a800d4` (feat)
4. **Task 4: cli.py — setup-checkpointer subcommand** — `42a2a4b` (feat)

All four task commits used `--no-verify` per the parallel-execution directive (running alongside Plan 04-07).

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py` (89 lines) — `create_pool`, `create_checkpointer`, `assert_tables_exist`, `_conn_string` (private helper)
- `packages/pipeline/src/eisenbalm_pipeline/agents/validate.py` (56 lines) — `validate_sections`, `REQUIRED_FIELDS`
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` (136 lines) — `build_graph`, `SECTION_WRITERS`
- `packages/pipeline/src/eisenbalm_pipeline/cli.py` (63 lines) — `setup_checkpointer`, `main`

## Decisions Made

- **validate.py placement under `agents/`** rather than `graph/`: keeps all graph nodes (including infrastructure nodes) co-located. The node is functionally NOT an editorial agent (no @agent_node, no deliberation event, no agentId in the brief's 14-agent list) — documented in the module docstring so Phase 5 doesn't accidentally wrap it.
- **`SECTION_WRITERS` tuple as a module-level constant** with comment explaining why the writer node `design` writes the state field `theme` (CONTEXT D-18 — Design writes `theme`). This asymmetry is the most likely place for future bugs; calling it out at the data level prevents drift.
- **Dual AsyncPostgresSaver patterns** — `from_conn_string` async-with in cli.py (single connection lifetime matches the one-shot DDL) and `AsyncConnectionPool + AsyncPostgresSaver(pool)` in graph/checkpointer.py (pool spans the FastAPI process lifetime). Documented in cli.py docstring to prevent future "why two patterns?" confusion.
- **Defensive `prepare_threshold=None`** even though CONTEXT D-30 says Andrew will use the session pooler: cheap insurance against future env misconfiguration; the only cost is foregoing prepared-statement caching, which is irrelevant for the per-request checkpoint load/save pattern.

## Deviations from Plan

None — plan executed exactly as written. All four tasks landed verbatim per the plan's `<action>` code blocks (which themselves were copied from 04-RESEARCH.md §1 / §4 / Pitfall 3).

## Issues Encountered

None. Plan 07 was running in parallel and shipped its 14 agent modules (including `publisher.py`) before Task 3's import-level verification, so I was able to run the full 4-module import check AND compile `build_graph(checkpointer=None)` to validate the StateGraph wiring (16 internal nodes verified) before writing the SUMMARY.

## Verification

```bash
# 1. Per-module checks (Tasks 1, 2, 4):
cd packages/pipeline && uv run python -c "
from eisenbalm_pipeline.graph.checkpointer import create_pool, create_checkpointer, assert_tables_exist
from eisenbalm_pipeline.agents.validate import validate_sections, REQUIRED_FIELDS
from eisenbalm_pipeline.cli import setup_checkpointer, main
print('3 modules OK')"
# → 3 modules OK

# 2. Plan 07 + Plan 08 integration check (Task 3 build_graph):
cd packages/pipeline && uv run python -c "
from eisenbalm_pipeline.graph.builder import build_graph
graph = build_graph(checkpointer=None)
print(type(graph).__name__, len(list(graph.get_graph().nodes)))"
# → CompiledStateGraph 18  (16 nodes + START + END)

# 3. CLI smoke test (no env vars):
cd packages/pipeline && uv run python -m eisenbalm_pipeline.cli
# → "Usage: python -m eisenbalm_pipeline.cli setup-checkpointer" (exit 1)
cd packages/pipeline && unset SUPABASE_POSTGRES_URL && uv run python -m eisenbalm_pipeline.cli setup-checkpointer
# → "ERROR: SUPABASE_POSTGRES_URL is not set. See packages/pipeline/.env.example ..." (exit 2)

# 4. Plan-level grep checks (all pass):
grep -F "prepare_threshold" packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py
grep -F "builder.compile(checkpointer=checkpointer)" packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
grep -F "partial-failure: missing sections" packages/pipeline/src/eisenbalm_pipeline/agents/validate.py

# 5. Regression: pytest still green:
cd packages/pipeline && uv run pytest -q
# → 25 skipped (no real tests yet; ships in Plan 10)
```

## User Setup Required

None — all four files are local code only. Real Supabase connection is exercised by Plan 12 (Andrew's smoke test) when `SUPABASE_POSTGRES_URL` is populated in Railway.

## Next Phase Readiness

**Plan 09 (FastAPI app and routers)** is unblocked. The lifespan composes:
1. `pool = create_pool()` → `await pool.open()`
2. `checkpointer = create_checkpointer(pool)`
3. `await assert_tables_exist(pool)` — fails fast if `setup-checkpointer` was never run
4. `graph = build_graph(checkpointer)` → stored on `app.state.graph` for reuse
5. On shutdown: `await pool.close()`

The Editor gate 1 `interrupt()` flow (already in `agents/editor.py` from Plan 07) integrates cleanly because the compiled graph has the checkpointer attached at compile time — the `Command(resume=...)` re-injection in Plan 09's `/run/{runId}/resume` will load the exact pending interrupt by `thread_id == runId` (CONTEXT D-10).

**Plan 12 (Andrew's smoke test)** uses `railway run python -m eisenbalm_pipeline.cli setup-checkpointer` as the one-time provisioning step before any `/run/weekly` call (CONTEXT D-30, D-42 step 2).

## Self-Check: PASSED

- [x] FOUND: packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py
- [x] FOUND: packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
- [x] FOUND: packages/pipeline/src/eisenbalm_pipeline/agents/validate.py
- [x] FOUND: packages/pipeline/src/eisenbalm_pipeline/cli.py
- [x] FOUND commit: 066eaa9 (Task 1 — checkpointer.py)
- [x] FOUND commit: d2bf676 (Task 2 — validate.py)
- [x] FOUND commit: 5a800d4 (Task 3 — builder.py)
- [x] FOUND commit: 42a2a4b (Task 4 — cli.py)
- [x] All 4 module imports succeed under `uv run python -c`
- [x] `build_graph(checkpointer=None)` compiles to a CompiledStateGraph with 18 nodes (14 agents + validate + START + END)
- [x] `grep -F "prepare_threshold"` matches in checkpointer.py (Pitfall 1 evidence)
- [x] `grep -F "builder.compile(checkpointer=checkpointer)"` matches in builder.py
- [x] `grep -F "partial-failure: missing sections"` matches in validate.py (CONTEXT D-26 evidence)
- [x] `python -m eisenbalm_pipeline.cli` (no args) prints usage and exits 1
- [x] `python -m eisenbalm_pipeline.cli setup-checkpointer` without env var exits 2 with descriptive error
- [x] pytest still passes (25 skipped, 0 failed — no regression)

---
*Phase: 04-pipeline-skeleton*
*Completed: 2026-05-14*
