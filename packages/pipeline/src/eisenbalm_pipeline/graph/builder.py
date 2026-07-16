"""LangGraph StateGraph builder (CONTEXT D-14 + research §4 Pattern A).

Wires the 14 agents in the brief's exact sequence:

    Calibrator
        |
    Scout
        |
    Advocate
        |
    Editor (gate 1, with interrupt())
        |
    Researcher
        |
    +-- origin_story --+
    +-- problem -------+
    +-- founder_bio ---+
    +-- case_study ----+-- fan-out (7 parallel writers)
    +-- game ----------+
    +-- bonus ---------+
    +-- design --------+
        |
    validate_sections (join — CONTEXT D-14)
        |
    QA
        |
    Editor Final
        |
    Publisher
        |
    END

Source: 04-RESEARCH.md §4 Pattern A + Pattern 1 (lifespan-owned compile).

Imports at module top reference the 14 agent modules from Plan 07. If this
module is imported before Plan 07 lands, those imports will fail — by design.
Plan 09's FastAPI lifespan is the actual caller and only runs after both
Plan 07 and Plan 08 are merged.
"""
from __future__ import annotations

import os
from typing import Any

from langgraph.graph import END, START, StateGraph

from eisenbalm_pipeline.agents.advocate import advocate
from eisenbalm_pipeline.agents.bonus import bonus
from eisenbalm_pipeline.agents.calibrator import calibrator
from eisenbalm_pipeline.agents.case_study import case_study
from eisenbalm_pipeline.agents.chronicler import chronicler
from eisenbalm_pipeline.agents.design import design
from eisenbalm_pipeline.agents.editor import editor_final, editor_gate_1
from eisenbalm_pipeline.agents.founder_bio import founder_bio
from eisenbalm_pipeline.agents.game import game
from eisenbalm_pipeline.agents.origin_story import origin_story
from eisenbalm_pipeline.agents.problem import problem
from eisenbalm_pipeline.agents.publisher import publisher
from eisenbalm_pipeline.agents.qa import qa
from eisenbalm_pipeline.agents.researcher import researcher
from eisenbalm_pipeline.agents.scout import scout
from eisenbalm_pipeline.agents.signal_editor import signal_editor
from eisenbalm_pipeline.agents.validate import validate_sections
from eisenbalm_pipeline.agents.verify import verify_research
from eisenbalm_pipeline.agents.verify_candidates import verify_candidates
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.agent_wrapper import wrap_agent_node


# MED-02: reversible suppression flag. Read at module-import time so flipping
# DESIGNAGENT_SUPPRESSED in the Railway dashboard + restart takes effect with
# no code change. Must stay in lockstep with validate.REQUIRED_FIELDS.
_SUPPRESSED = os.environ.get("DESIGNAGENT_SUPPRESSED", "").lower() in ("1", "true", "yes")

# 7 parallel section writers — Pattern A multi-target edges. Each writer
# mutates a DISTINCT DispatchState field (origin_story, problem_statement,
# founder_bio, case_study, game, bonus, theme — Design writes `theme`),
# so LangGraph's default TypedDict reducer ("last writer wins per field")
# merges them cleanly with no race and no Annotated[..., operator.add].
# See 04-RESEARCH.md §4 "Why this works without reducers."
SECTION_WRITERS: tuple[str, ...] = (
    "origin_story",
    "problem",
    "founder_bio",
    "case_study",
    "game",
    "bonus",
    *(() if _SUPPRESSED else ("design",)),
)


# Phase 48 D-01 / RESEARCH Pattern 1 (§48.1): the brief-entry fork.
#
# CONTEXT D-01's prose says "conditional edge at START", but both discovery
# and brief runs begin identically at calibrator (D-02 — calibrator still
# sets style_brief + resolves the narrator in brief mode). A conditional
# edge literally at START would map every entry_mode to the same node, a
# no-op branch. The REAL fork is TWO add_conditional_edges calls sharing
# this one router, placed AFTER calibrator and AFTER verify_candidates:
#   - calibrator -> {discovery: signal_editor, brief: verify_candidates}
#   - verify_candidates -> {discovery: advocate, brief: researcher}
# `add_edge(START, "calibrator")` stays a single UNCONDITIONAL edge — do not
# touch it. Discovery's execution ORDER is byte-identical to before; only
# the edge-declaration mechanism for these two hops changes from add_edge to
# add_conditional_edges. Every other edge in the discovery chain (
# signal_editor->scout, scout->verify_candidates, advocate->editor_gate_1,
# editor_gate_1->chronicler, chronicler->researcher, the fan-out/fan-in) is
# untouched. verify_candidates.py itself is NOT edited by this fork — it is
# already advisory-safe (D-11): it persists every VerificationRecord before
# any kill decision, and it never touches state['winning_charity'], so an
# emptied/killed `candidates` list on the brief path has zero effect on
# `researcher` (which reads only `winning_charity`, never `candidates`).
def route_by_entry_mode(state: DispatchState) -> str:
    """Route on DispatchState['entry_mode']. Absent/None -> 'discovery' —
    back-compat with every pre-Phase-48 DispatchState test fixture and every
    existing _start_run caller, which never sets entry_mode explicitly."""
    return state.get("entry_mode") or "discovery"


def build_graph(checkpointer: Any) -> Any:
    """Compile the StateGraph with the given checkpointer (Plan 09 calls this).

    Args:
        checkpointer: AsyncPostgresSaver instance (from graph/checkpointer.py).

    Returns:
        A CompiledStateGraph ready for `await graph.ainvoke(state, config=...)`.
    """
    builder = StateGraph(DispatchState)

    # Sequential pre-fan-out agents.
    builder.add_node("calibrator", wrap_agent_node("calibrator", calibrator))

    # Phase 46 D-01/D-02: signal_editor is an LLM @agent_node inserted between
    # calibrator and scout (Stage 1 "Find story leads").
    builder.add_node("signal_editor", wrap_agent_node("signal_editor", signal_editor))

    builder.add_node("scout", wrap_agent_node("scout", scout))

    # Phase 46 D-01/D-02: verify_candidates is a bare non-LLM bottleneck
    # inserted between scout and advocate, mirroring verify_research below.
    builder.add_node("verify_candidates", wrap_agent_node("verify_candidates", verify_candidates))

    builder.add_node("advocate", wrap_agent_node("advocate", advocate))
    builder.add_node("editor_gate_1", wrap_agent_node("editor_gate_1", editor_gate_1))
    builder.add_node("chronicler", wrap_agent_node("chronicler", chronicler))
    builder.add_node("researcher", wrap_agent_node("researcher", researcher))

    # Phase 5 D-11: standalone non-LLM verification step between Researcher
    # and the parallel section-writer fan-out. Sets *Verified booleans on
    # state['research'] so downstream writers can branch on verification.
    builder.add_node("verify_research", wrap_agent_node("verify_research", verify_research))

    # 7 parallel section writers.
    builder.add_node("origin_story", wrap_agent_node("origin_story", origin_story))
    builder.add_node("problem", wrap_agent_node("problem", problem))
    builder.add_node("founder_bio", wrap_agent_node("founder_bio", founder_bio))
    builder.add_node("case_study", wrap_agent_node("case_study", case_study))
    builder.add_node("game", wrap_agent_node("game", game))
    builder.add_node("bonus", wrap_agent_node("bonus", bonus))
    if not _SUPPRESSED:
        builder.add_node("design", wrap_agent_node("design", design))

    # Join + post-parallel sequential.
    builder.add_node("validate_sections", wrap_agent_node("validate_sections", validate_sections))
    builder.add_node("qa", wrap_agent_node("qa", qa))
    builder.add_node("editor_final", wrap_agent_node("editor_final", editor_final))
    builder.add_node("publisher", wrap_agent_node("publisher", publisher))

    # Sequential pre-fan-out edges.
    builder.add_edge(START, "calibrator")  # unconditional in both modes (D-02)

    # Phase 46 D-01: calibrator -> signal_editor -> scout -> verify_candidates
    # -> advocate (discovery chain, byte-identical to before Phase 48).
    #
    # Phase 48 D-01/§48.1: the calibrator->signal_editor and
    # verify_candidates->advocate static edges are REPLACED by two
    # conditional edges sharing route_by_entry_mode, so a brief run instead
    # routes calibrator -> verify_candidates -> researcher (skipping
    # signal_editor/scout/advocate/editor_gate_1/chronicler).
    builder.add_conditional_edges("calibrator", route_by_entry_mode, {
        "discovery": "signal_editor", "brief": "verify_candidates",
    })
    builder.add_edge("signal_editor", "scout")
    builder.add_edge("scout", "verify_candidates")
    builder.add_conditional_edges("verify_candidates", route_by_entry_mode, {
        "discovery": "advocate", "brief": "researcher",
    })

    builder.add_edge("advocate", "editor_gate_1")
    builder.add_edge("editor_gate_1", "chronicler")
    builder.add_edge("chronicler", "researcher")

    # Phase 5 D-11: insert verify_research between Researcher and the fan-out.
    # verify_research fetches founderNameSourceUrl / subjectNameSourceUrl,
    # sets *Verified bools, and is a single bottleneck before the parallel
    # section writers consume state['research'].
    builder.add_edge("researcher", "verify_research")

    # Fan-out: 7 parallel writers — Pattern A (plain multi-target edges,
    # no reducer needed because each writer mutates a distinct field).
    for writer in SECTION_WRITERS:
        builder.add_edge("verify_research", writer)
        builder.add_edge(writer, "validate_sections")

    # Sequential post-fan-in edges.
    builder.add_edge("validate_sections", "qa")
    builder.add_edge("qa", "editor_final")
    builder.add_edge("editor_final", "publisher")
    builder.add_edge("publisher", END)

    # Compile once with checkpointer attached. Plan 09 lifespan calls
    # build_graph(checkpointer) exactly once and stores result in
    # app.state.graph for the process lifetime.
    return builder.compile(checkpointer=checkpointer)
