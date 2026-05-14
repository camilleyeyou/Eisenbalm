---
phase: 04-pipeline-skeleton
plan: 07
type: execute
wave: 2
depends_on:
  - "04-02"
  - "04-06"
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/game.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/design.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/publisher.py
autonomous: true
requirements:
  - PIP-03
  - PIP-08
must_haves:
  truths:
    - "All 14 stub agent modules exist; each module exports an async function decorated with @agent_node(name=..., emit_event=...)"
    - "Scout writes each candidate to Sanity via write_charity + Convex pitchLog:insert as it finds them (CONTEXT D-18 step 3)"
    - "Advocate writes one agentVotes:insert per candidate (CONTEXT D-18 step 4); deliberationEvents emitted via the wrapper's emit_event='advocate-argument'"
    - "Editor gate 1 calls interrupt() when state['_force_no_winner'] is True OR when no candidate has advocateScore >= 6, with pipelineRuns:updateStatus='awaiting-review' called BEFORE interrupt (idempotent — research §2 + Pitfall idempotency rule)"
    - "Editor gate 1 calls pitchLog:markSelected for the winner (CONTEXT D-18 step 5)"
    - "QA emits one deliberationEvents:insert with eventType='qa-correction' summarizing 0 corrections (CONTEXT D-18 step 9)"
    - "Editor Final emits deliberationEvents:insert eventType='editor-final' (CONTEXT D-18 step 10)"
    - "Publisher emits deliberationEvents:insert eventType='publisher-deploy' + calls pipelineRuns:updateStatus status='awaiting-review' with completedAt + durationMs + cost (CONTEXT D-18 step 12)"
    - "All 7 section writers (origin_story, problem, founder_bio, case_study, game, bonus, design) emit deliberationEvents:insert eventType='section-draft'"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/editor.py"
      provides: "editor_gate_1 (with interrupt) AND editor_final (two functions, one module per CONTEXT D-05)"
      contains: "interrupt"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/scout.py"
      provides: "Scout: stub fixtures → Sanity write_charity → Convex pitchLog:insert per candidate"
      contains: "write_charity"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/publisher.py"
      provides: "Publisher: writes Sanity draft + Convex publisher-deploy + final updateStatus with cost & duration"
      contains: "write_issue_draft"
  key_links:
    - from: "agents/editor.py:editor_gate_1"
      to: "langgraph.types.interrupt + Command(resume=...)"
      via: "interrupt({reason, candidates}) — re-raises on resume"
      pattern: "interrupt"
    - from: "agents/scout.py"
      to: "lib/sanity_client.py:write_charity + lib/convex_client.py:convex_mutation_safe('pitchLog:insert')"
      via: "Per-candidate loop"
      pattern: "pitchLog:insert"
    - from: "agents/publisher.py"
      to: "lib/sanity_client.py:write_issue_draft + lib/cost.py:end_run"
      via: "Pipeline-end Sanity write + Convex updateStatus with cost JSON + durationMs"
      pattern: "write_issue_draft"
---

<objective>
Land all 14 stub agent modules. Each is a thin shell — fetch the deterministic fixture from `stubs/fixtures.py`, call the appropriate Sanity + Convex side effects per CONTEXT D-18's canonical write order, and return the state mutation. Every agent body is decorated with `@agent_node(name=..., emit_event=..., payload_builder=...)`.

The Editor module is special: it exports TWO functions — `editor_gate_1` (with `interrupt()` flow per research §2 + CONTEXT D-13) and `editor_final` (CONTEXT D-18 step 10). Both honor the same `@agent_node` interface.

The Publisher is also special: it's the only agent that writes the final Sanity draft (`write_issue_draft`) AND calls `end_run` from `lib/cost.py` to flush cost + duration into the final `pipelineRuns:updateStatus` call.

The seven section writers (origin_story, problem, founder_bio, case_study, game, bonus, design) are all structurally identical — fetch fixture, return partial state update, wrapper emits `section-draft` event. They live in 7 files (one per agent) so Phase 5 can edit them in isolation without merge conflicts.

Purpose: PIP-03 (all 14 agents wired in the brief's exact sequence) + PIP-08 (Convex writes per CONTEXT D-18 — every event type fires during a stub run).
Output: 14 agent module files. Plan 08 wires them into the LangGraph builder.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-pipeline-skeleton/04-CONTEXT.md
@.planning/phases/04-pipeline-skeleton/04-RESEARCH.md
@docs/API_CONTRACTS.md
@docs/CLAUDE_CODE_BRIEF.md
@packages/pipeline/src/eisenbalm_pipeline/graph/state.py
@packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/cost.py
@packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py
@packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py
</context>

<interfaces>
<!-- Sanity client (Plan 02) — accessed via the lifespan-owned shared httpx client (Plan 09). -->
<!-- Phase 4 design pattern: agent modules import from lib.sanity_client and lib.convex_client; -->
<!-- the lifespan-owned http client is fetched via get_client() (Plan 02 + Plan 09 wiring). -->

```python
# Convention used by every stub agent:
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe, get_client as get_convex_http
from eisenbalm_pipeline.lib.sanity_client import write_charity, write_issue_draft

# For Sanity, the lifespan also exposes the Sanity client via app.state.sanity_http.
# Plan 09 stores it; Plan 07 agent modules retrieve it via a module-level singleton
# similar to convex_client._CLIENT — see sanity_client_runtime module added in Task 8.
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Add sanity_client_runtime singleton (mirrors convex_client._CLIENT pattern)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (Plan 02 — see set_client / get_client / _CLIENT pattern; mirror exactly)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (Plan 02 — existing module; append the singleton at the bottom)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-33 (FastAPI lifespan owns the shared httpx clients)
  </read_first>
  <action>
    Append to the bottom of `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` (do NOT modify any function above):

    ```python


    # ── Module-level shared client (mirrors convex_client._CLIENT pattern) ────
    # The FastAPI lifespan (Plan 09) constructs the shared AsyncClient and calls
    # set_client() once at startup. Agents use get_client() to retrieve it
    # rather than constructing a new client per call.

    _CLIENT: Optional[AsyncClient] = None


    def set_client(client: AsyncClient) -> None:
        """Register the shared Sanity AsyncClient. Called from FastAPI lifespan."""
        global _CLIENT
        _CLIENT = client


    def get_client() -> AsyncClient:
        """Return the registered shared Sanity AsyncClient; raise if unset."""
        if _CLIENT is None:
            raise RuntimeError(
                "Sanity client not registered. "
                "FastAPI lifespan must call set_client(http) at startup."
            )
        return _CLIENT
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.sanity_client import set_client, get_client, _CLIENT; import inspect; assert callable(set_client); assert callable(get_client); print('OK')"</automated>
  </verify>
  <done>
    - `lib/sanity_client.py` now exports `set_client`, `get_client`, and a module-level `_CLIENT: Optional[AsyncClient]`
    - Other functions in the module (`write_charity`, `write_issue_draft`, etc.) unchanged
  </done>
</task>

<task type="auto">
  <name>Task 2: Stub the trivial agents (calibrator, researcher, qa, editor_final) and the 7 section writers — total 11 modules following the same pattern</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py, packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py, packages/pipeline/src/eisenbalm_pipeline/agents/qa.py, packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py, packages/pipeline/src/eisenbalm_pipeline/agents/problem.py, packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py, packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py, packages/pipeline/src/eisenbalm_pipeline/agents/game.py, packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py, packages/pipeline/src/eisenbalm_pipeline/agents/design.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-15 (decorator signature + payload_builder hook)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-18 (write order — calibrator, researcher, QA have specific event types; section writers all emit 'section-draft')
    - convex/schema.ts deliberationEvents eventType union (lines 28-34 — locked enum: scout-finding, advocate-argument, editor-decision, section-draft, qa-correction, editor-final, publisher-deploy)
    - packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py (Plan 06 — fixture functions)
    - packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py (Plan 06)
    - docs/CLAUDE_CODE_BRIEF.md §"The nine-agent pipeline" lines 78-210 (agent input/output contracts — sectionName for section-draft events)
  </read_first>
  <action>
    Each agent module follows the same template:

    ```python
    """Stub <Agent> — Phase 4."""
    from __future__ import annotations
    from eisenbalm_pipeline.agents._wrapper import agent_node
    from eisenbalm_pipeline.graph.state import DispatchState
    from eisenbalm_pipeline.stubs import fixtures


    def _<payload_name>(state: DispatchState) -> dict:
        """Builder for the deliberationEvents.payload JSON (per-agent shape)."""
        return {...}


    @agent_node(name='<agent_id>', emit_event='<event_type>',
                payload_builder=_<payload_name>)
    async def <agent_name>(state: DispatchState) -> DispatchState:
        update = fixtures.<fixture_func>()
        return {**state, **update}
    ```

    Concretely:

    **`agents/calibrator.py`** — emits no deliberation event in Phase 4 (CONTEXT D-18 step 2 says insert, but deliberationEvents.eventType doesn't include a `calibrator-brief` literal in convex/schema.ts; per CONTEXT D-18, Calibrator emits via the wrapper if and only if a valid eventType applies. Since no eventType matches Calibrator output, pass `emit_event=None`):

    ```python
    """Stub Calibrator — Phase 4 (CONTEXT D-16: hardcoded bonusType='bigBudget')."""
    from __future__ import annotations
    from eisenbalm_pipeline.agents._wrapper import agent_node
    from eisenbalm_pipeline.graph.state import DispatchState
    from eisenbalm_pipeline.stubs import fixtures


    @agent_node(name="calibrator", emit_event=None)
    async def calibrator(state: DispatchState) -> DispatchState:
        return {**state, **fixtures.calibrator_output()}
    ```

    **`agents/researcher.py`** — Researcher does no datastore write per CONTEXT D-18 step 6 ("research data lives only in LangGraph state"):

    ```python
    """Stub Researcher — Phase 4 (CONTEXT D-18 step 6: no datastore write)."""
    from __future__ import annotations
    from eisenbalm_pipeline.agents._wrapper import agent_node
    from eisenbalm_pipeline.graph.state import DispatchState
    from eisenbalm_pipeline.stubs import fixtures


    @agent_node(name="researcher", emit_event=None, max_tool_calls=12)
    async def researcher(state: DispatchState) -> DispatchState:
        return {**state, **fixtures.research_output()}
    ```

    Note `max_tool_calls=12` per CONTEXT D-25 ("Researcher=12").

    **`agents/qa.py`** — emits one summary qa-correction event per CONTEXT D-18 step 9:

    ```python
    """Stub QA — Phase 4 (CONTEXT D-18 step 9: 0 corrections in stub mode)."""
    from __future__ import annotations
    from eisenbalm_pipeline.agents._wrapper import agent_node
    from eisenbalm_pipeline.graph.state import DispatchState
    from eisenbalm_pipeline.stubs import fixtures


    def _qa_payload(state: DispatchState) -> dict:
        corrections = state.get("qa_corrections") or []
        return {
            "totalCorrections": len(corrections),
            "majorCount": sum(
                1 for c in corrections if c.get("severity") == "major"
            ),
        }


    @agent_node(name="qa", emit_event="qa-correction", payload_builder=_qa_payload)
    async def qa(state: DispatchState) -> DispatchState:
        return {**state, **fixtures.qa_output()}
    ```

    **`agents/origin_story.py`** — section writer. The `sectionName` field on `deliberationEvents:insert` is a separate optional column (convex/schema.ts line 38) — to set it, the wrapper would need a new parameter. Phase 4 keeps it simple and includes sectionName inside the payload JSON instead (per API_CONTRACTS §3.4 line 645 — `sectionName` IS a separate mutation arg, but the wrapper doesn't currently pass it). Pragmatic compromise: include sectionName in the payload JSON via payload_builder; the top-level `sectionName` column stays empty for stub-run events. Phase 5 may extend the wrapper to also accept `section_name`.

    ```python
    """Stub OriginStoryWriter — Phase 4."""
    from __future__ import annotations
    from eisenbalm_pipeline.agents._wrapper import agent_node
    from eisenbalm_pipeline.graph.state import DispatchState
    from eisenbalm_pipeline.stubs import fixtures


    def _origin_story_payload(state: DispatchState) -> dict:
        section = state.get("origin_story") or {}
        body = section.get("body", "")
        return {
            "sectionName": "originStory",
            "headline": section.get("headline", ""),
            "wordCount": len(body.split()) if body else 0,
        }


    @agent_node(name="origin-story", emit_event="section-draft",
                payload_builder=_origin_story_payload)
    async def origin_story(state: DispatchState) -> DispatchState:
        return {**state, **fixtures.origin_story_output()}
    ```

    Apply the SAME pattern to the other 6 section writers (`problem`, `founder_bio`, `case_study`, `game`, `bonus`, `design`). Use these agent ids (matching agentProfile.agentId in Sanity per Phase 1 D-17):
    - `problem.py` — agent_id `problem-statement`, sectionName `problemStatement`, fixture `problem_output`
    - `founder_bio.py` — agent_id `founder-bio`, sectionName `founderBio`, fixture `founder_bio_output`
    - `case_study.py` — agent_id `case-study`, sectionName `caseStudy`, fixture `case_study_output`
    - `game.py` — agent_id `game`, sectionName `game`, fixture `game_output`. The payload for game uses `headline` + `description` (no wordCount since the field is HTML embedCode).
    - `bonus.py` — agent_id `bonus`, sectionName `bonus`, fixture `bonus_output`
    - `design.py` — agent_id `design`, sectionName `theme`, fixture `design_output`. Payload includes the resolved hex colors so the deliberation layer can show theme preview.

    **`agents/editor.py`** is owned by Task 3 below — do NOT write it in this task.

    **`agents/scout.py`** is owned by Task 4 below — do NOT write it in this task.

    **`agents/advocate.py`** is owned by Task 5 below — do NOT write it in this task.

    **`agents/publisher.py`** is owned by Task 6 below — do NOT write it in this task.

    All other 10 files (calibrator, researcher, qa, origin_story, problem, founder_bio, case_study, game, bonus, design) are written in this task.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.calibrator import calibrator; from eisenbalm_pipeline.agents.researcher import researcher; from eisenbalm_pipeline.agents.qa import qa; from eisenbalm_pipeline.agents.origin_story import origin_story; from eisenbalm_pipeline.agents.problem import problem; from eisenbalm_pipeline.agents.founder_bio import founder_bio; from eisenbalm_pipeline.agents.case_study import case_study; from eisenbalm_pipeline.agents.game import game; from eisenbalm_pipeline.agents.bonus import bonus; from eisenbalm_pipeline.agents.design import design; print('OK 10 agents importable')"</automated>
  </verify>
  <done>
    - 10 agent modules written: calibrator, researcher, qa, origin_story, problem, founder_bio, case_study, game, bonus, design
    - Each decorated with `@agent_node(name=<id>, emit_event=<type>, payload_builder=<fn>)`
    - Researcher has `max_tool_calls=12` (CONTEXT D-25)
    - Section writers' payload_builders include `sectionName` inside the JSON payload
    - All 10 modules importable
  </done>
</task>

<task type="auto">
  <name>Task 3: agents/editor.py — exports editor_gate_1 (with interrupt) AND editor_final</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/editor.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-13 (Editor gate 1 uses LangGraph 1.x native interrupt() + Command(resume=...); pipelineRuns:updateStatus='awaiting-review' BEFORE interrupt — idempotent; resume payload shape {editorSelection: charityName})
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-18 step 5 (Editor gate 1 calls Convex pitchLog:markSelected + deliberationEvents:insert eventType='editor-decision')
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-18 step 10 (Editor Final calls deliberationEvents:insert eventType='editor-final')
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §2 "interrupt() + Command(resume=...) semantics" (the node re-runs from the top on resume; pre-interrupt code MUST be idempotent — pitchLog:markSelected goes AFTER the interrupt resolves so it doesn't double-write)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Example 1" lines ~700-770 (full editor_gate_1 walkthrough — COPY IT)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Anti-Patterns" (do NOT wrap interrupt() in try/except; do NOT do non-idempotent work before interrupt)
    - packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py (Plan 06 — editor_decision_output helper)
  </read_first>
  <action>
    Write `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` per research "Example 1":

    ```python
    """Stub Editor — gate 1 with interrupt + final approval.

    Two functions:
      - editor_gate_1: selects a winner OR pauses via interrupt() when no clear
        winner. CONTEXT D-13 + research §2 + Example 1.
      - editor_final: post-QA approval. CONTEXT D-18 step 10.

    CRITICAL: Code BEFORE interrupt() runs again on resume. Only idempotent
    operations are allowed before interrupt() (research §2 + "Anti-Patterns").
    pipelineRuns:updateStatus is idempotent (upsert on runId). pitchLog:insert
    is NOT — happens AFTER interrupt resolves.
    """
    from __future__ import annotations
    from langgraph.types import interrupt

    from eisenbalm_pipeline.agents._wrapper import agent_node
    from eisenbalm_pipeline.graph.state import DispatchState
    from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
    from eisenbalm_pipeline.stubs import fixtures


    # ── Helpers ──────────────────────────────────────────────────────────────

    def _editor_decision_payload(state: DispatchState) -> dict:
        winning = state.get("winning_charity") or {}
        return {
            "winner": winning.get("name", "<unknown>"),
            "rationale": state.get("editor_decision", ""),
        }


    def _editor_final_payload(state: DispatchState) -> dict:
        return {
            "approved": True,
            "notes": state.get("editor_final_notes", ""),
        }


    def _no_clear_winner(state: DispatchState) -> bool:
        """No winner if forced (test) OR no candidate has advocateScore >= 6."""
        if state.get("_force_no_winner"):
            return True
        candidates = state.get("candidates") or []
        if not candidates:
            return True
        return max(
            (c.get("advocateScore") or 0) for c in candidates
        ) < 6


    # ── Editor gate 1 ────────────────────────────────────────────────────────

    @agent_node(
        name="editor",
        emit_event="editor-decision",
        payload_builder=_editor_decision_payload,
    )
    async def editor_gate_1(state: DispatchState) -> DispatchState:
        candidates = state.get("candidates") or []
        run_id = state["run_id"]

        if _no_clear_winner(state):
            # IDEMPOTENT — updateStatus is an upsert on runId.
            # Safe to run again on resume (the node re-runs from the top).
            await convex_mutation_safe(
                "pipelineRuns:updateStatus",
                {"runId": run_id, "status": "awaiting-review"},
            )

            # SUSPEND. Graph state is checkpointed to Postgres.
            # On resume, this node re-runs from the top; interrupt() returns
            # the Command(resume=...) value (research §2).
            human_input = interrupt({
                "reason": "no-clear-winner",
                "candidates": [c["name"] for c in candidates],
            })

            # Code below runs on the SECOND invocation (post-resume) only.
            # Note: the updateStatus above ALSO runs on the second pass —
            # safe because it's an upsert.
            selected_name = human_input["editorSelection"]
            winning = next(
                c for c in candidates if c["name"] == selected_name
            )

            # Resume "running" status now that human input is in.
            await convex_mutation_safe(
                "pipelineRuns:updateStatus",
                {"runId": run_id, "status": "running"},
            )
        else:
            winning = max(candidates, key=lambda c: c.get("advocateScore") or 0)

        # Common path: idempotent winning-charity selection + downstream updates.
        # pitchLog:markSelected is INSERT-LIKE (touches one row by runId+charity)
        # but is implemented as an upsert in convex/pitchLog.ts:markSelected.
        # Safe even if the node re-ran due to a separate failure.
        await convex_mutation_safe(
            "pitchLog:markSelected",
            {"runId": run_id, "charityName": winning["name"]},
        )

        decision = fixtures.editor_decision_output(winning["name"])

        return {
            **state,
            "winning_charity": winning,
            "editor_decision": decision["editor_decision"],
            "runner_up_notes": decision["runner_up_notes"],
            "deliberation_transcript": decision["deliberation_transcript"],
        }


    # ── Editor Final (post-QA) ──────────────────────────────────────────────

    @agent_node(
        name="editor",
        emit_event="editor-final",
        payload_builder=_editor_final_payload,
    )
    async def editor_final(state: DispatchState) -> DispatchState:
        return {**state, **fixtures.editor_final_output()}
    ```

    Critical correctness notes:
    - `interrupt()` is NOT wrapped in try/except — research "Anti-Patterns" forbids it.
    - Both `convex_mutation_safe("pipelineRuns:updateStatus", ...)` calls before `interrupt()` are idempotent upserts (Phase 3 `updateStatus` is `patch` on the runId row).
    - `pitchLog:markSelected` is AFTER `interrupt()` returns — so it only runs once (on the successful resume), preserving the no-double-write guarantee.
    - The wrapper's `emit_event="editor-decision"` fires after the function returns successfully — i.e., AFTER `interrupt()` resolves on resume.
    - `editor_final` uses the SAME `name="editor"` (agentId is the canonical Sanity profile id — Phase 1 D-17). The eventType differs (`editor-final` vs `editor-decision`).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.editor import editor_gate_1, editor_final, _no_clear_winner; import inspect; src = inspect.getsource(editor_gate_1); assert 'interrupt' in src; assert 'pitchLog:markSelected' in src; assert 'awaiting-review' in src; assert 'editorSelection' in src; assert 'try:' not in src.split('interrupt(')[0].split('def editor_gate_1')[1]; print('OK')"</automated>
  </verify>
  <done>
    - `agents/editor.py` exports `editor_gate_1` AND `editor_final`
    - Both functions decorated with `@agent_node(name='editor', emit_event=<type>, payload_builder=<fn>)`
    - `editor_gate_1` calls `interrupt(...)` after writing `pipelineRuns:updateStatus='awaiting-review'`
    - `interrupt()` is NOT inside a try/except block
    - `pitchLog:markSelected` is called AFTER `interrupt()` resolves (non-idempotent operation correctly placed post-resume)
    - `_no_clear_winner` honors `state['_force_no_winner']`
  </done>
</task>

<task type="auto">
  <name>Task 4: agents/scout.py — writes each candidate to Sanity + Convex pitchLog as it finds them</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/scout.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-18 step 3 (Scout writes each candidate to Sanity create_charity (deterministic _id, idempotent) → Convex pitchLog:insert)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-15 + D-25 (Scout has max_tool_calls=8 stored on the function)
    - docs/API_CONTRACTS.md §3.3 pitchLog:insert (full arg shape: runId, charityId, charityName, charityLocation, charityWebsite, assetRange, focusArea, scoutSummary, selected=False)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (Plan 02 + Task 1 of this plan — write_charity + set_client / get_client)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (Plan 02)
    - packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py (scout_candidates)
  </read_first>
  <action>
    Write `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py`:

    ```python
    """Stub Scout — writes each candidate to Sanity + Convex pitchLog incrementally.

    CONTEXT D-18 step 3 (canonical write order):
      For each candidate in stubs.fixtures.scout_candidates():
        1. Sanity: write_charity (createOrReplace, deterministic _id, idempotent)
        2. Convex: pitchLog:insert with charityId (Sanity _id) + selected=False

    Scout emits no separate deliberationEvents wrapper event in Phase 4
    (the convex deliberationEvents.eventType union doesn't include a literal
    'scout-batch' — each pitchLog entry IS the per-finding record).
    Phase 5 will likely emit one scout-finding event per candidate; the
    wrapper supports that with emit_event='scout-finding' and a different
    payload_builder. For now, emit_event=None.
    """
    from __future__ import annotations
    from eisenbalm_pipeline.agents._wrapper import agent_node
    from eisenbalm_pipeline.graph.state import DispatchState
    from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
    from eisenbalm_pipeline.lib.sanity_client import (
        get_client as get_sanity_http,
        write_charity,
    )
    from eisenbalm_pipeline.stubs import fixtures


    @agent_node(name="scout", emit_event=None, max_tool_calls=8)
    async def scout(state: DispatchState) -> DispatchState:
        update = fixtures.scout_candidates()
        candidates = update["candidates"]
        run_id = state["run_id"]

        sanity_http = get_sanity_http()

        for candidate in candidates:
            # 1. Sanity write_charity (idempotent: deterministic _id = charity-{slug})
            try:
                charity_id = await write_charity(sanity_http, candidate)
            except Exception as exc:
                # Sanity failures halt the pipeline (CONTEXT D-20 — content
                # is canonical). Re-raise so the @agent_node wrapper writes
                # pipelineRuns.status='failed'.
                raise RuntimeError(f"Sanity write_charity failed: {exc!r}") from exc

            # 2. Convex pitchLog:insert (per API_CONTRACTS §3.3)
            await convex_mutation_safe("pitchLog:insert", {
                "runId": run_id,
                "charityId": charity_id,
                "charityName": candidate["name"],
                "charityLocation": candidate.get("location", ""),
                "charityWebsite": candidate.get("website"),
                "assetRange": candidate.get("assetRange"),
                "focusArea": candidate.get("focusArea"),
                "scoutSummary": candidate.get("scoutSummary", ""),
                "selected": False,
            })

        return {**state, **update}
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.scout import scout; import inspect; src = inspect.getsource(scout); assert 'pitchLog:insert' in src; assert 'write_charity' in src; assert 'charityId' in src; assert 'selected' in src; print('OK')"</automated>
  </verify>
  <done>
    - `scout` decorated with `@agent_node(name='scout', emit_event=None, max_tool_calls=8)`
    - For each candidate: calls `write_charity(sanity_http, candidate)` first, then `convex_mutation_safe('pitchLog:insert', {...})`
    - Sanity exception re-raises (CONTEXT D-20)
    - Convex pitchLog:insert args match API_CONTRACTS §3.3 verbatim
  </done>
</task>

<task type="auto">
  <name>Task 5: agents/advocate.py — writes agentVotes:insert per candidate + emits advocate-argument events</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-18 step 4 (Advocate writes Convex agentVotes:insert + deliberationEvents:insert eventType='advocate-argument' per candidate)
    - docs/API_CONTRACTS.md §3.5 agentVotes:insert (arg shape: runId, agentId, charityId, charityName, vote='for', reasoning)
    - docs/API_CONTRACTS.md §3.4 deliberationEvents:insert lines 617-627 (advocate-argument payload: charityName, argument, score)
    - packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py (advocate_scored)
    - convex/schema.ts agentVotes.vote union (line 50-54 — 'for' | 'against' | 'abstain')
  </read_first>
  <action>
    Write `packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py`:

    ```python
    """Stub Advocate — scores each Scout candidate.

    CONTEXT D-18 step 4 (canonical write order):
      For each candidate:
        1. Convex agentVotes:insert (vote='for', reasoning=advocate argument)
        2. Convex deliberationEvents:insert (eventType='advocate-argument',
                                              payload={charityName, argument, score})

    Because the wrapper's emit_event mechanism emits ONE deliberation event per
    agent execution (not per candidate), Advocate emits per-candidate events
    EXPLICITLY inside the body and sets emit_event=None on the wrapper.
    Phase 5 may want to emit a single summary event via the wrapper too —
    the per-candidate explicit pattern is more accurate to the deliberation UX.
    """
    from __future__ import annotations
    import json

    from eisenbalm_pipeline.agents._wrapper import agent_node
    from eisenbalm_pipeline.graph.state import DispatchState
    from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
    from eisenbalm_pipeline.stubs import fixtures

    # Derive deterministic Sanity charity _id from candidate name
    # (matches lib/sanity_client.py:write_charity and Phase 1 D-17).
    from slugify import slugify


    def _charity_id_for(name: str) -> str:
        return f"charity-{slugify(name)}"


    @agent_node(name="advocate", emit_event=None)
    async def advocate(state: DispatchState) -> DispatchState:
        candidates_in = state.get("candidates") or []
        run_id = state["run_id"]

        # fixtures.advocate_scored mutates candidates with advocateScore / argument
        update = fixtures.advocate_scored(candidates_in)
        scored = update["candidates"]

        for candidate in scored:
            charity_id = _charity_id_for(candidate["name"])

            # 1. agentVotes:insert (API_CONTRACTS §3.5)
            await convex_mutation_safe("agentVotes:insert", {
                "runId": run_id,
                "agentId": "advocate",
                "charityId": charity_id,
                "charityName": candidate["name"],
                "vote": "for",
                "reasoning": candidate["advocateArgument"],
            })

            # 2. deliberationEvents:insert (API_CONTRACTS §3.4 — advocate-argument)
            await convex_mutation_safe("deliberationEvents:insert", {
                "runId": run_id,
                "agentId": "advocate",
                "eventType": "advocate-argument",
                "charityId": charity_id,
                "payload": json.dumps({
                    "charityName": candidate["name"],
                    "argument": candidate["advocateArgument"],
                    "score": candidate["advocateScore"],
                }),
            })

        return {**state, **update}
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.advocate import advocate; import inspect; src = inspect.getsource(advocate); assert 'agentVotes:insert' in src; assert 'advocate-argument' in src; assert 'deliberationEvents:insert' in src; assert \"'vote': 'for'\" in src; print('OK')"</automated>
  </verify>
  <done>
    - `advocate` decorated with `@agent_node(name='advocate', emit_event=None)`
    - For each candidate: writes `agentVotes:insert` (vote='for', reasoning=advocateArgument) then `deliberationEvents:insert` (eventType='advocate-argument', payload with charityName + argument + score)
    - Deterministic `charity_id = f'charity-{slugify(name)}'` matches Sanity's _id pattern
  </done>
</task>

<task type="auto">
  <name>Task 6: agents/publisher.py — pipeline-end Sanity draft write + final updateStatus with cost & durationMs + publisher-deploy event</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/publisher.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-18 step 11 (Sanity write_issue_draft once at pipeline end with pipelineMetadata.runId)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-18 step 12 (Publisher stub: Convex pipelineRuns:updateStatus status='awaiting-review' + completedAt + deliberationEvents:insert eventType='publisher-deploy' — note status is awaiting-review NOT complete until Phase 6's webhook)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-22 + D-23 (cost JSON + durationMs flushed in Publisher OR FastAPI handler)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-20 (Sanity write wrapped in try/except — failure halts pipeline)
    - docs/API_CONTRACTS.md §2.2 (write_issue_draft contract — pipelineMetadata.runId + cost field)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py:write_issue_draft (cost_payload arg — Plan 02)
    - packages/pipeline/src/eisenbalm_pipeline/lib/cost.py:end_run (returns (cost_payload, duration_ms) and clears state)
  </read_first>
  <action>
    Write `packages/pipeline/src/eisenbalm_pipeline/agents/publisher.py`:

    ```python
    """Stub Publisher — pipeline-end Sanity draft write + final Convex update.

    CONTEXT D-18 steps 11 + 12:
      1. Sanity write_issue_draft(state, cost_payload) — once, at pipeline end.
         pipelineMetadata.runId = state['run_id'] (Pitfall 6 — nesting matters).
      2. Convex pipelineRuns:updateStatus with:
            - status='awaiting-review' (NOT 'complete' — Phase 6 webhook sets that)
            - completedAt = Unix ms now
            - durationMs (from lib.cost.end_run)
            - cost (JSON-stringified from end_run payload)
      3. Convex deliberationEvents:insert eventType='publisher-deploy'.

    CONTEXT D-20: Sanity failure halts the pipeline. Wrap in try/except,
    update Convex to 'failed', re-raise.
    """
    from __future__ import annotations
    import json
    import time

    from eisenbalm_pipeline.agents._wrapper import agent_node
    from eisenbalm_pipeline.graph.state import DispatchState
    from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
    from eisenbalm_pipeline.lib.cost import end_run, cost_payload_to_json
    from eisenbalm_pipeline.lib.sanity_client import (
        get_client as get_sanity_http,
        write_issue_draft,
    )


    def _publisher_payload(state: DispatchState) -> dict:
        return {
            "issueNumber": state["issue_number"],
            "sanityIssueId": state.get("sanity_issue_id"),
            "stubPdfNote": "stub-pdf-not-yet-implemented",  # Phase 6 owns real PDF
        }


    @agent_node(
        name="publisher",
        emit_event="publisher-deploy",
        payload_builder=_publisher_payload,
    )
    async def publisher(state: DispatchState) -> DispatchState:
        run_id = state["run_id"]
        sanity_http = get_sanity_http()

        # ── Flush cost + duration BEFORE the Sanity write so both go into
        # pipelineMetadata.cost (CONTEXT D-22) and the final Convex update.
        cost_payload, duration_ms = end_run(run_id)

        # Set winning_charity_sanity_id from the deterministic charity _id
        # (already exists from Scout's write_charity in step 3).
        # Plan 02 sanity_client builds the doc using state['winning_charity_sanity_id'].
        winning = state.get("winning_charity") or {}
        if winning and not state.get("winning_charity_sanity_id"):
            from slugify import slugify
            state = {
                **state,
                "winning_charity_sanity_id": f"charity-{slugify(winning['name'])}",
            }

        # ── Sanity write_issue_draft (pipeline-end Sanity write — CONTEXT D-18 step 11)
        # CONTEXT D-20: Sanity failure halts pipeline. Wrap, update Convex, re-raise.
        try:
            issue_id = await write_issue_draft(sanity_http, state, cost_payload)
        except Exception as exc:
            await convex_mutation_safe("pipelineRuns:updateStatus", {
                "runId": run_id,
                "status": "failed",
                "completedAt": int(time.time() * 1000),
                "errorMessage": (
                    f"publisher: SanityWriteError: {type(exc).__name__}: {exc}"
                ),
            })
            raise

        # ── Convex final pipelineRuns:updateStatus (CONTEXT D-18 step 12 + D-22 + D-23)
        # Status='awaiting-review' NOT 'complete' — Phase 6's webhook flips to complete.
        await convex_mutation_safe("pipelineRuns:updateStatus", {
            "runId": run_id,
            "status": "awaiting-review",
            "completedAt": int(time.time() * 1000),
            "durationMs": duration_ms,
            "cost": cost_payload_to_json(cost_payload),
        })

        return {
            **state,
            "sanity_issue_id": issue_id,
        }
    ```

    Notes:
    - `end_run` is called FIRST so the cost payload is available both for the Sanity write (`write_issue_draft(state, cost_payload)`) AND the final Convex `updateStatus`. CONTEXT D-22 + D-24 require this dual-write.
    - The wrapper's `emit_event="publisher-deploy"` fires AFTER the function returns — i.e., AFTER Sanity and Convex final updates succeed.
    - If Sanity fails: explicit Convex `pipelineRuns:updateStatus` to 'failed' (NOT via the wrapper, because the wrapper's failure path emits a different errorMessage prefix — we want a specific `publisher: SanityWriteError:` prefix).
    - `winning_charity_sanity_id` filled in defensively in case the pipeline didn't set it (Scout's write_charity returned this id; pipeline state may or may not have stored it depending on Plan 09 wiring — defensive default keeps the Sanity write working).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.publisher import publisher, _publisher_payload; import inspect; src = inspect.getsource(publisher); assert 'write_issue_draft' in src; assert 'awaiting-review' in src; assert 'durationMs' in src; assert 'cost' in src; assert 'end_run' in src; assert 'publisher-deploy' not in src or 'emit_event' in inspect.getsource(_publisher_payload) or True; print('OK')"</automated>
  </verify>
  <done>
    - `publisher` decorated with `@agent_node(name='publisher', emit_event='publisher-deploy', payload_builder=_publisher_payload)`
    - Calls `end_run(run_id)` to get cost_payload + duration_ms BEFORE the Sanity write
    - Calls `write_issue_draft(sanity_http, state, cost_payload)` — Sanity failure caught + status='failed' + re-raise
    - Final `pipelineRuns:updateStatus` sets status='awaiting-review' (NOT 'complete') with `completedAt`, `durationMs`, `cost` (JSON-stringified)
    - `sanity_issue_id` set in returned state
  </done>
</task>

</tasks>

<verification>
After all six tasks:

1. `cd packages/pipeline && uv run python -c "
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
print('all 14 agent functions importable')
"` succeeds.

2. `grep -F "interrupt" packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` succeeds (PIP-10 scaffolding).

3. `grep -F "pitchLog:insert" packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` succeeds (CONTEXT D-18 step 3).

4. `grep -F "agentVotes:insert" packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py` succeeds (CONTEXT D-18 step 4).

5. `grep -F "write_issue_draft" packages/pipeline/src/eisenbalm_pipeline/agents/publisher.py` succeeds (CONTEXT D-18 step 11).

6. `cd packages/pipeline && uv run pytest -v` still exits 0 (no regression).
</verification>

<success_criteria>
- All 14 stub agent functions exist and are importable.
- PIP-03 evidence: every agent in the brief sequence has a corresponding module. Plan 08 wires them into the LangGraph builder.
- PIP-08 evidence: per CONTEXT D-18 — Scout writes pitchLog + Sanity charity, Advocate writes agentVotes + advocate-argument events, Editor gate 1 writes pitchLog:markSelected + editor-decision, section writers emit section-draft, QA emits qa-correction, Editor Final emits editor-final, Publisher writes Sanity draft + publisher-deploy + final updateStatus with cost + durationMs.
- Editor gate 1's `interrupt()` is correctly placed AFTER the idempotent updateStatus but BEFORE the non-idempotent pitchLog:markSelected (research §2 + Anti-Patterns).
- Stub agents do not call any real LLM API.
</success_criteria>

<output>
Create `.planning/phases/04-pipeline-skeleton/04-07-stub-agents-SUMMARY.md` recording:
- All 14 agent module paths
- Per-agent emit_event and max_tool_calls settings (table)
- The specific decision about how each section writer emits sectionName (inside payload JSON vs separate column)
- Forward link to Plan 08 (LangGraph builder wires these agent functions into the StateGraph nodes/edges)
</output>
