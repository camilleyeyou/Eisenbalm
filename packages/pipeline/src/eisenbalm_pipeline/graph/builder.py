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
from eisenbalm_pipeline.agents.validate import validate_sections
from eisenbalm_pipeline.agents.verify import verify_research
from eisenbalm_pipeline.graph.state import DispatchState


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


def build_graph(checkpointer: Any) -> Any:
    """Compile the StateGraph with the given checkpointer (Plan 09 calls this).

    Args:
        checkpointer: AsyncPostgresSaver instance (from graph/checkpointer.py).

    Returns:
        A CompiledStateGraph ready for `await graph.ainvoke(state, config=...)`.
    """
    builder = StateGraph(DispatchState)

    # Sequential pre-fan-out agents.
    builder.add_node("calibrator", calibrator)
    builder.add_node("scout", scout)
    builder.add_node("advocate", advocate)
    builder.add_node("editor_gate_1", editor_gate_1)
    builder.add_node("researcher", researcher)

    # Phase 5 D-11: standalone non-LLM verification step between Researcher
    # and the parallel section-writer fan-out. Sets *Verified booleans on
    # state['research'] so downstream writers can branch on verification.
    builder.add_node("verify_research", verify_research)

    # 7 parallel section writers.
    builder.add_node("origin_story", origin_story)
    builder.add_node("problem", problem)
    builder.add_node("founder_bio", founder_bio)
    builder.add_node("case_study", case_study)
    builder.add_node("game", game)
    builder.add_node("bonus", bonus)
    if not _SUPPRESSED:
        builder.add_node("design", design)

    # Join + post-parallel sequential.
    builder.add_node("validate_sections", validate_sections)
    builder.add_node("qa", qa)
    builder.add_node("editor_final", editor_final)
    builder.add_node("publisher", publisher)

    # Sequential pre-fan-out edges.
    builder.add_edge(START, "calibrator")
    builder.add_edge("calibrator", "scout")
    builder.add_edge("scout", "advocate")
    builder.add_edge("advocate", "editor_gate_1")
    builder.add_edge("editor_gate_1", "researcher")

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
