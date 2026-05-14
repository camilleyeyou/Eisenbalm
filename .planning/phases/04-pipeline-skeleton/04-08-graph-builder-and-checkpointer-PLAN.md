---
phase: 04-pipeline-skeleton
plan: 08
type: execute
wave: 2
depends_on:
  - "04-02"
  - "04-06"
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
  - packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/validate.py
  - packages/pipeline/src/eisenbalm_pipeline/cli.py
autonomous: true
requirements:
  - PIP-09
must_haves:
  truths:
    - "`build_graph(checkpointer)` wires the 14 agents in the brief's exact sequence: Calibrator → Scout → Advocate → Editor[gate 1] → Researcher → fan-out{7 writers} → validate_sections → QA → Editor[final] → Publisher"
    - "The 7 writers (origin_story, problem, founder_bio, case_study, game, bonus, design) run in parallel via plain multi-target edges (research §4 Pattern A) — no Send API, no Annotated reducers (research §4 'When you'd need...')"
    - "`validate_sections` join node asserts every required state field is populated; missing → writes pipelineRuns.status='failed' with errorMessage prefix 'partial-failure: missing sections [...]' (CONTEXT D-14 + D-26 + research §4)"
    - "`AsyncPostgresSaver` + `AsyncConnectionPool` with `prepare_threshold=None` defensively set on the psycopg pool (research Pitfall 1 — degrade gracefully if env points at transaction pooler)"
    - "`python -m eisenbalm_pipeline.cli setup-checkpointer` is the canonical one-time migration entrypoint (CONTEXT D-12) — runs `await cp.setup()` against Supabase and exits 0"
    - "The lifespan's fail-fast assertion (`SELECT to_regclass('public.checkpoints')`) lives here so Plan 09 just imports the factory"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/builder.py"
      provides: "build_graph(checkpointer) -> CompiledStateGraph"
      contains: "StateGraph(DispatchState)"
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py"
      provides: "create_pool, create_checkpointer, assert_tables_exist"
      contains: "AsyncPostgresSaver"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/validate.py"
      provides: "validate_sections join node"
      contains: "REQUIRED_FIELDS"
    - path: "packages/pipeline/src/eisenbalm_pipeline/cli.py"
      provides: "setup-checkpointer CLI subcommand"
      contains: "setup_checkpointer"
  key_links:
    - from: "graph/builder.py:build_graph"
      to: "All 14 agent functions from Plan 07 + validate_sections from Plan 08"
      via: "StateGraph add_node + add_edge wiring"
      pattern: "builder.add_node"
    - from: "graph/checkpointer.py:create_pool"
      to: "Supabase Postgres session pooler"
      via: "AsyncConnectionPool with prepare_threshold=None + autocommit=True + row_factory=dict_row"
      pattern: "prepare_threshold"
    - from: "cli.py:setup_checkpointer"
      to: "AsyncPostgresSaver.setup()"
      via: "One-time DDL creating 4 LangGraph tables"
      pattern: "setup()"
---

<objective>
Wire the full 14-node LangGraph + checkpointer infrastructure: the graph builder (research §4 Pattern A — plain multi-target edges for fan-out), the AsyncPostgresSaver lifecycle factory (research §1 + Pattern 1), the validate_sections join node (CONTEXT D-14 + research §4 implementation), and the `setup-checkpointer` CLI subcommand (CONTEXT D-12 + research Pitfall 3).

Purpose: PIP-09 — `AsyncPostgresSaver` checkpoints to Supabase Postgres; `setup()` is a one-time deploy step (not on every startup). The graph itself is the structural backbone of Phase 4 — every other plan exists to wire something INTO this graph.
Output: A compiled StateGraph object factory + a checkpointer factory + a CLI that runs the one-time migration. Plan 09's FastAPI lifespan composes these.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-pipeline-skeleton/04-CONTEXT.md
@.planning/phases/04-pipeline-skeleton/04-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/graph/state.py
@packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py
@packages/pipeline/src/eisenbalm_pipeline/agents/scout.py
@packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py
@packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
@packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
@packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
@packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
@packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
@packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
@packages/pipeline/src/eisenbalm_pipeline/agents/game.py
@packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py
@packages/pipeline/src/eisenbalm_pipeline/agents/design.py
@packages/pipeline/src/eisenbalm_pipeline/agents/qa.py
@packages/pipeline/src/eisenbalm_pipeline/agents/publisher.py
</context>

<tasks>

<task type="auto">
  <name>Task 1: graph/checkpointer.py — AsyncPostgresSaver factory + fail-fast assertion</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §1 "LangGraph 1.1.10 + AsyncPostgresSaver + Supabase Postgres (THE CORE PATTERN)" — full lifecycle pattern
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Pattern 1" lines 198-289 — lifespan-managed pool + assertion query (COPY VERBATIM where applicable)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Common Pitfalls" Pitfall 1 (`prepare_threshold=None` defensively set), Pitfall 2 (session pooler is the only Supabase mode that works with Railway), Pitfall 3 (setup() is NOT in lifespan; lifespan asserts and fails fast)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-11 (AsyncPostgresSaver against Supabase Postgres), D-12 (setup() one-time)
  </read_first>
  <action>
    Write `packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py`:

    ```python
    """AsyncPostgresSaver lifecycle factory (CONTEXT D-11, D-12 + research §1).

    FastAPI lifespan (Plan 09) calls:
      pool = await create_pool()
      await pool.open()
      checkpointer = AsyncPostgresSaver(pool)
      await assert_tables_exist(pool)   # fail-fast if setup() never ran
      graph = build_graph(checkpointer)

    On shutdown: await pool.close().

    The setup() DDL lives in cli.py:setup_checkpointer (Task 4 below).
    It is INTENTIONALLY NOT called on every startup (research Pitfall 3).
    """
    from __future__ import annotations
    import logging
    import os

    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from psycopg.rows import dict_row
    from psycopg_pool import AsyncConnectionPool

    log = logging.getLogger(__name__)


    def _conn_string() -> str:
        try:
            return os.environ["SUPABASE_POSTGRES_URL"]
        except KeyError as exc:
            raise RuntimeError(
                "SUPABASE_POSTGRES_URL is required. See packages/pipeline/.env.example. "
                "Use the session pooler (port 5432), NOT the transaction pooler (6543)."
            ) from exc


    def create_pool(max_size: int = 10) -> AsyncConnectionPool:
        """Construct (but do not open) the psycopg AsyncConnectionPool.

        Defensive defaults (research Pitfall 1):
          - prepare_threshold=None  → disable prepared statements (PgBouncer-safe)
          - autocommit=True         → required by AsyncPostgresSaver
          - row_factory=dict_row    → required for AsyncPostgresSaver internal queries
        """
        return AsyncConnectionPool(
            conninfo=_conn_string(),
            max_size=max_size,
            kwargs={
                "autocommit": True,
                "prepare_threshold": None,
                "row_factory": dict_row,
            },
            open=False,
        )


    def create_checkpointer(pool: AsyncConnectionPool) -> AsyncPostgresSaver:
        """Construct the AsyncPostgresSaver backed by the given pool."""
        return AsyncPostgresSaver(pool)


    async def assert_tables_exist(pool: AsyncConnectionPool) -> None:
        """Fail-fast check: do the LangGraph checkpoint tables exist?

        Raises RuntimeError with a clear error message pointing at the CLI
        if the tables are missing (research Pattern 1 + Pitfall 3).
        """
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT to_regclass('public.checkpoints')")
                row = await cur.fetchone()
                if not row or row.get("to_regclass") is None:
                    raise RuntimeError(
                        "AsyncPostgresSaver tables not found in Supabase. "
                        "Run once: `python -m eisenbalm_pipeline.cli setup-checkpointer` "
                        "(or rely on the Railway preDeployCommand in railway.toml)."
                    )
        log.info("AsyncPostgresSaver tables verified.")
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.graph.checkpointer import create_pool, create_checkpointer, assert_tables_exist; import inspect; src = inspect.getsource(create_pool); assert 'prepare_threshold' in src; assert 'autocommit' in src; assert 'dict_row' in src; src2 = inspect.getsource(assert_tables_exist); assert 'to_regclass' in src2; assert 'setup-checkpointer' in src2; print('OK')"</automated>
  </verify>
  <done>
    - `create_pool()` returns an `AsyncConnectionPool` with `prepare_threshold=None`, `autocommit=True`, `row_factory=dict_row`, `open=False`
    - `create_checkpointer(pool)` returns `AsyncPostgresSaver(pool)`
    - `assert_tables_exist(pool)` runs `SELECT to_regclass('public.checkpoints')` and raises with the canonical error message pointing at the CLI if missing
    - `_conn_string()` reads `SUPABASE_POSTGRES_URL` and raises with a helpful pooler-mode hint if missing
  </done>
</task>

<task type="auto">
  <name>Task 2: agents/validate.py — validate_sections join node</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/validate.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-14 (validate_sections is new in Phase 4, pulled from PITFALLS.md §1.3; missing fields write pipelineRuns.status='failed' or 'partial-failure'; before halting)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-26 (Phase 4 does NOT add 'partial-failure' enum value; status='failed' with errorMessage 'partial-failure: missing sections [...]')
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §4 "Parallel fan-out with LangGraph 1.1" — full implementation of validate_sections (COPY)
    - convex/schema.ts pipelineRuns.status union (lines 9-14 — locked: running, awaiting-review, complete, failed)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §4 "validate_sections is NOT decorated with @agent_node because" (3 reasons listed)
  </read_first>
  <action>
    Write `packages/pipeline/src/eisenbalm_pipeline/agents/validate.py` per research §4:

    ```python
    """validate_sections — join node after the 7 parallel writers (CONTEXT D-14).

    NOT decorated with @agent_node (research §4) because:
      1. Doesn't emit a deliberation event (no agentId in the brief's 14-agent list).
      2. Writes pipelineRuns.status='failed' directly with a special errorMessage
         prefix 'partial-failure: ...' (CONTEXT D-26 keeps the enum locked).
      3. Wrapping it would double-write the failed status.
    """
    from __future__ import annotations
    import time

    from eisenbalm_pipeline.graph.state import DispatchState
    from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe


    REQUIRED_FIELDS: tuple[str, ...] = (
        "origin_story",
        "problem_statement",
        "founder_bio",
        "case_study",
        "game",
        "bonus",
        "theme",
    )


    async def validate_sections(state: DispatchState) -> DispatchState:
        """Assert every required section field is populated; halt with a
        descriptive errorMessage if anything is missing.

        Pass-through on success — the merged state from the 7 parallel writers
        flows downstream to QA unchanged.
        """
        missing = [f for f in REQUIRED_FIELDS if not state.get(f)]
        if missing:
            await convex_mutation_safe("pipelineRuns:updateStatus", {
                "runId": state["run_id"],
                "status": "failed",
                "completedAt": int(time.time() * 1000),
                # CONTEXT D-26 routing: prefix `partial-failure:` to keep
                # the status enum locked while signaling the failure mode.
                "errorMessage": f"partial-failure: missing sections {missing}",
            })
            # Raising halts the graph; the checkpoint records the partial state.
            raise RuntimeError(f"partial-failure: missing sections {missing}")
        return state
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.validate import validate_sections, REQUIRED_FIELDS; assert REQUIRED_FIELDS == ('origin_story', 'problem_statement', 'founder_bio', 'case_study', 'game', 'bonus', 'theme'); import inspect; src = inspect.getsource(validate_sections); assert 'partial-failure: missing sections' in src; assert 'status' in src and 'failed' in src; print('OK')"</automated>
  </verify>
  <done>
    - `REQUIRED_FIELDS` tuple has exactly 7 entries matching CONTEXT D-18's parallel-writer outputs
    - On missing fields: calls `pipelineRuns:updateStatus` with `status='failed'` and `errorMessage` starting with `'partial-failure: missing sections '`
    - Then raises `RuntimeError` with the same prefix
    - NOT decorated with `@agent_node` (research §4 explicit)
  </done>
</task>

<task type="auto">
  <name>Task 3: graph/builder.py — wires all 14 agents + validate_sections in the brief's sequence</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/graph/builder.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §4 "Pattern 4 — Parallel fan-out in LangGraph 1.x" — full reference code (Pattern A: plain multi-target edges; recommended for Phase 4)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §4 "Why this works without reducers" (each writer mutates a distinct field — no race)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Pattern 1" lines 252 (`builder.compile(checkpointer=checkpointer)` — receives the checkpointer)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-14 (graph sequence: Calibrator → Scout → Advocate → Editor[gate 1] → Researcher → fan-out{7 writers} → validate_sections → QA → Editor[final] → Publisher)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Anti-Patterns" ("Compiling the graph per request" — compile ONCE in lifespan)
    - docs/CLAUDE_CODE_BRIEF.md §"The nine-agent pipeline" (brief sequence — 14 agents counting Editor twice)
    - All 14 agent modules from Plan 07 (verify the import names match: calibrator, scout, advocate, editor_gate_1, editor_final, researcher, origin_story, problem, founder_bio, case_study, game, bonus, design, qa, publisher)
    - agents/validate.py from Task 2 of this plan
  </read_first>
  <action>
    Write `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` per research §4 Pattern A:

    ```python
    """LangGraph StateGraph builder (CONTEXT D-14 + research §4 Pattern A).

    Wires the 14 agents in the brief's exact sequence:

        Calibrator
            ↓
        Scout
            ↓
        Advocate
            ↓
        Editor (gate 1, with interrupt())
            ↓
        Researcher
            ↓
        ┌── origin_story ──┐
        ├── problem ───────┤
        ├── founder_bio ───┤
        ├── case_study ────┤── fan-out (7 parallel writers)
        ├── game ──────────┤
        ├── bonus ─────────┤
        └── design ────────┘
            ↓
        validate_sections (join — CONTEXT D-14)
            ↓
        QA
            ↓
        Editor Final
            ↓
        Publisher
            ↓
        END

    Source: 04-RESEARCH.md §4 Pattern A + Pattern 1 (lifespan-owned compile).
    """
    from __future__ import annotations
    from typing import Any

    from langgraph.graph import StateGraph, START, END

    from eisenbalm_pipeline.graph.state import DispatchState
    from eisenbalm_pipeline.agents.calibrator import calibrator
    from eisenbalm_pipeline.agents.scout import scout
    from eisenbalm_pipeline.agents.advocate import advocate
    from eisenbalm_pipeline.agents.editor import editor_gate_1, editor_final
    from eisenbalm_pipeline.agents.researcher import researcher
    from eisenbalm_pipeline.agents.origin_story import origin_story
    from eisenbalm_pipeline.agents.problem import problem
    from eisenbalm_pipeline.agents.founder_bio import founder_bio
    from eisenbalm_pipeline.agents.case_study import case_study
    from eisenbalm_pipeline.agents.game import game
    from eisenbalm_pipeline.agents.bonus import bonus
    from eisenbalm_pipeline.agents.design import design
    from eisenbalm_pipeline.agents.qa import qa
    from eisenbalm_pipeline.agents.publisher import publisher
    from eisenbalm_pipeline.agents.validate import validate_sections


    SECTION_WRITERS = (
        "origin_story",
        "problem",
        "founder_bio",
        "case_study",
        "game",
        "bonus",
        "design",
    )


    def build_graph(checkpointer: Any) -> Any:
        """Compile the StateGraph with the given checkpointer (Plan 09 calls this).

        Args:
            checkpointer: AsyncPostgresSaver instance (from graph/checkpointer.py).

        Returns:
            A CompiledStateGraph ready for `await graph.ainvoke(state, config=...)`.
        """
        builder = StateGraph(DispatchState)

        # Sequential agents
        builder.add_node("calibrator", calibrator)
        builder.add_node("scout", scout)
        builder.add_node("advocate", advocate)
        builder.add_node("editor_gate_1", editor_gate_1)
        builder.add_node("researcher", researcher)

        # 7 parallel section writers
        builder.add_node("origin_story", origin_story)
        builder.add_node("problem", problem)
        builder.add_node("founder_bio", founder_bio)
        builder.add_node("case_study", case_study)
        builder.add_node("game", game)
        builder.add_node("bonus", bonus)
        builder.add_node("design", design)

        # Join + post-parallel sequential
        builder.add_node("validate_sections", validate_sections)
        builder.add_node("qa", qa)
        builder.add_node("editor_final", editor_final)
        builder.add_node("publisher", publisher)

        # Sequential pre-fan-out edges
        builder.add_edge(START, "calibrator")
        builder.add_edge("calibrator", "scout")
        builder.add_edge("scout", "advocate")
        builder.add_edge("advocate", "editor_gate_1")
        builder.add_edge("editor_gate_1", "researcher")

        # Fan-out: 7 parallel writers — Pattern A (plain multi-target edges,
        # no reducer needed because each writer mutates a distinct field).
        for writer in SECTION_WRITERS:
            builder.add_edge("researcher", writer)
            builder.add_edge(writer, "validate_sections")

        # Sequential post-fan-in edges
        builder.add_edge("validate_sections", "qa")
        builder.add_edge("qa", "editor_final")
        builder.add_edge("editor_final", "publisher")
        builder.add_edge("publisher", END)

        # Compile once with checkpointer attached. Plan 09 lifespan calls
        # build_graph(checkpointer) exactly once and stores result in app.state.graph.
        return builder.compile(checkpointer=checkpointer)
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.graph.builder import build_graph, SECTION_WRITERS; assert SECTION_WRITERS == ('origin_story', 'problem', 'founder_bio', 'case_study', 'game', 'bonus', 'design'); import inspect; src = inspect.getsource(build_graph); assert 'editor_gate_1' in src; assert 'editor_final' in src; assert 'validate_sections' in src; assert 'publisher' in src; assert 'builder.compile(checkpointer=checkpointer)' in src; print('OK')"</automated>
  </verify>
  <done>
    - `build_graph(checkpointer)` constructs a `StateGraph(DispatchState)` and compiles it
    - All 14 agent nodes + `validate_sections` registered with `add_node`
    - Edges match research §4 Pattern A: sequential pre/post + 7 parallel writer fan-out
    - `SECTION_WRITERS` tuple has exactly 7 entries matching `validate.REQUIRED_FIELDS`-aligned outputs
    - `builder.compile(checkpointer=checkpointer)` — checkpointer attached at compile time
  </done>
</task>

<task type="auto">
  <name>Task 4: cli.py — setup-checkpointer subcommand</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/cli.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-12 (`python -m eisenbalm_pipeline.cli setup-checkpointer` is the one-time CLI invocation)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md "Claude's Discretion" ("Exact CLI shape for setup-checkpointer (subcommand under python -m eisenbalm_pipeline.cli vs standalone script)" — subcommand chosen)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Pitfall 3" lines 602-633 (full reference impl — copy verbatim)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §1 "checkpointer.setup() semantics" (idempotent; creates 4 tables: checkpoints, checkpoint_writes, checkpoint_blobs, checkpoint_migrations)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §9 "Railway deployment specifics" — preDeployCommand wires this CLI; Andrew can also run `railway run python -m eisenbalm_pipeline.cli setup-checkpointer` per CONTEXT D-29
  </read_first>
  <action>
    Write `packages/pipeline/src/eisenbalm_pipeline/cli.py` per research Pitfall 3:

    ```python
    """CLI entrypoint for one-time operations.

    Currently exposes one subcommand:
      setup-checkpointer  — Runs AsyncPostgresSaver.setup() against Supabase.
                            Idempotent. CONTEXT D-12 + research Pitfall 3.

    Invocation:
      python -m eisenbalm_pipeline.cli setup-checkpointer

    Used by:
      - railway.toml preDeployCommand (Plan 01 wired this)
      - Andrew's manual provisioning (CONTEXT D-29 — railway run ...)
    """
    from __future__ import annotations
    import asyncio
    import os
    import sys

    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver


    async def setup_checkpointer() -> None:
        """Run AsyncPostgresSaver.setup() against the configured Supabase Postgres.

        Idempotent: creates the 4 LangGraph tables (checkpoints, checkpoint_writes,
        checkpoint_blobs, checkpoint_migrations) if they don't exist. Acquires an
        advisory lock during DDL — safe under concurrent invocation, but should
        only run once per deploy in practice.
        """
        try:
            db_url = os.environ["SUPABASE_POSTGRES_URL"]
        except KeyError:
            print(
                "ERROR: SUPABASE_POSTGRES_URL is not set. "
                "See packages/pipeline/.env.example for the session pooler format.",
                file=sys.stderr,
            )
            sys.exit(2)

        async with AsyncPostgresSaver.from_conn_string(db_url) as cp:
            await cp.setup()
            print("Checkpointer tables created / verified.")


    def main() -> None:
        if len(sys.argv) < 2 or sys.argv[1] != "setup-checkpointer":
            print(
                "Usage: python -m eisenbalm_pipeline.cli setup-checkpointer",
                file=sys.stderr,
            )
            sys.exit(1)
        asyncio.run(setup_checkpointer())


    if __name__ == "__main__":
        main()
    ```

    Smoke test (without hitting Supabase): the module must be importable AND `python -m eisenbalm_pipeline.cli` without args must exit 1 with the usage message.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.cli import setup_checkpointer, main; import inspect; src = inspect.getsource(setup_checkpointer); assert 'AsyncPostgresSaver.from_conn_string' in src; assert 'cp.setup()' in src; assert 'SUPABASE_POSTGRES_URL' in src; print('OK')" && cd packages/pipeline && uv run python -m eisenbalm_pipeline.cli 2>&1 | head -1 | grep -F "Usage: python -m eisenbalm_pipeline.cli setup-checkpointer"</automated>
  </verify>
  <done>
    - `cli.py` exports `setup_checkpointer()` async function and `main()` synchronous entrypoint
    - `setup_checkpointer` uses `AsyncPostgresSaver.from_conn_string(db_url)` (the from_conn_string form is correct here per research Pitfall 3 — single-use, async-with for the one-time setup; lifespan uses the pool variant)
    - `python -m eisenbalm_pipeline.cli` without args exits 1 with usage message
    - `python -m eisenbalm_pipeline.cli setup-checkpointer` calls `asyncio.run(setup_checkpointer())`
  </done>
</task>

</tasks>

<verification>
After all four tasks:

1. `cd packages/pipeline && uv run python -c "
from eisenbalm_pipeline.graph.checkpointer import create_pool, create_checkpointer, assert_tables_exist
from eisenbalm_pipeline.graph.builder import build_graph
from eisenbalm_pipeline.agents.validate import validate_sections, REQUIRED_FIELDS
from eisenbalm_pipeline.cli import setup_checkpointer
print('all 4 module imports OK')
"` succeeds.

2. `grep -F "prepare_threshold" packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py` (Pitfall 1 evidence).

3. `grep -F "builder.compile(checkpointer=checkpointer)" packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` succeeds.

4. `grep -F "partial-failure: missing sections" packages/pipeline/src/eisenbalm_pipeline/agents/validate.py` succeeds (CONTEXT D-26).

5. `cd packages/pipeline && uv run python -m eisenbalm_pipeline.cli 2>&1 | grep "Usage"` succeeds.

6. `cd packages/pipeline && uv run pytest -v` still exits 0 (no regression).

Without Supabase env vars set, `python -m eisenbalm_pipeline.cli setup-checkpointer` will fail with "SUPABASE_POSTGRES_URL is not set." — that's expected behavior. Plan 12 (Andrew's smoke test) runs the real DDL against the live Supabase instance.
</verification>

<success_criteria>
- PIP-09 evidence: AsyncPostgresSaver + AsyncConnectionPool factory exists; setup() is in a CLI subcommand (not in lifespan).
- Defensive `prepare_threshold=None` set (research Pitfall 1) — degrades gracefully if env points at the transaction pooler instead of the session pooler.
- Fail-fast assertion lives in `graph/checkpointer.py:assert_tables_exist` for Plan 09's lifespan to call.
- Graph builder wires all 14 agents in the brief's exact sequence with a 7-way parallel fan-out (research §4 Pattern A) and the validate_sections join (CONTEXT D-14).
- CLI is the canonical entry point for one-time migrations (CONTEXT D-12).
</success_criteria>

<output>
Create `.planning/phases/04-pipeline-skeleton/04-08-graph-builder-and-checkpointer-SUMMARY.md` recording:
- Confirmation that `SECTION_WRITERS` (7 entries) aligns with `validate.REQUIRED_FIELDS`
- The decision to use `AsyncPostgresSaver.from_conn_string` in cli.py (one-time) vs `AsyncConnectionPool + AsyncPostgresSaver(pool)` in graph/checkpointer.py (long-lived) — both patterns coexist per research §1
- Forward link to Plan 09 (FastAPI lifespan composes `create_pool` + `create_checkpointer` + `assert_tables_exist` + `build_graph`)
</output>
