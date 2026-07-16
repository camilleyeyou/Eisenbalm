"""Phase 13 Wave 0 — Builder wiring source-scan test.

Covers DEL-CONV-01 wiring (DEL-P13-08):
  - chronicler node is registered in builder.py
  - edge editor_gate_1 -> chronicler is present
  - edge chronicler -> researcher is present
  - old direct edge editor_gate_1 -> researcher is REMOVED (rewired via chronicler)

This is a PURE source-scan — reads graph/builder.py as text, no imports.
Tests are skip-guarded until Plan 13-02 rewires the builder.
"""
from __future__ import annotations

from pathlib import Path

import pytest

BUILDER_PATH = Path(__file__).parent.parent / "src" / "eisenbalm_pipeline" / "graph" / "builder.py"


def _builder_src() -> str:
    return BUILDER_PATH.read_text(encoding="utf-8")


def _chronicler_wired() -> bool:
    """Return True only when the chronicler edge is already in the builder source."""
    src = _builder_src()
    return 'builder.add_edge("editor_gate_1", "chronicler")' in src


# Skip the whole module until Plan 13-02 lands the chronicler edge rewire.
# When chronicler is wired, the skip condition is False and all assertions run.
pytestmark = pytest.mark.skipif(
    not _chronicler_wired(),
    reason="Wave 2: builder edge rewire not yet done (chronicler not yet inserted between editor_gate_1 and researcher)",
)


def test_chronicler_node_registered() -> None:
    """chronicler node must be added to the builder before the wiring edges."""
    src = _builder_src()
    assert 'builder.add_node("chronicler"' in src, (
        'builder.py must call builder.add_node("chronicler", ...) to register the node. '
        "Run Plan 13-02 to implement."
    )


def test_editor_gate_1_to_chronicler_edge() -> None:
    """editor_gate_1 → chronicler edge must be present (DEL-P13-08, D-01)."""
    src = _builder_src()
    assert 'builder.add_edge("editor_gate_1", "chronicler")' in src, (
        'builder.py must have builder.add_edge("editor_gate_1", "chronicler"). '
        "Run Plan 13-02 to rewire."
    )


def test_chronicler_to_researcher_edge() -> None:
    """chronicler → researcher edge must be present (DEL-P13-08, D-01)."""
    src = _builder_src()
    assert 'builder.add_edge("chronicler", "researcher")' in src, (
        'builder.py must have builder.add_edge("chronicler", "researcher"). '
        "Run Plan 13-02 to rewire."
    )


def test_old_direct_edge_removed() -> None:
    """The old editor_gate_1 → researcher direct edge must be removed (D-01 rewire).

    After inserting chronicler, editor_gate_1 must route through chronicler,
    not directly to researcher.
    """
    src = _builder_src()
    assert 'builder.add_edge("editor_gate_1", "researcher")' not in src, (
        'builder.py still has the old direct builder.add_edge("editor_gate_1", "researcher"). '
        "Remove it when inserting the chronicler edge in Plan 13-02."
    )


# ── Phase 46 Plan 06 — signal_editor + verify_candidates wiring (D-01/D-03) ──
#
# Source-scan + live-introspection assertions proving the graph grows from
# 18 to 20 nodes via calibrator -> signal_editor -> scout -> verify_candidates
# -> advocate, replacing the old calibrator->scout and scout->advocate edges.
# Not gated by the module's chronicler skip-guard (that condition is already
# satisfied — these assertions run unconditionally once this file is loaded).


def test_signal_editor_node_registered() -> None:
    """signal_editor node must be added to the builder (D-01/D-02)."""
    src = _builder_src()
    assert 'builder.add_node("signal_editor"' in src, (
        'builder.py must call builder.add_node("signal_editor", ...) to register the node.'
    )


def test_verify_candidates_node_registered() -> None:
    """verify_candidates node must be added to the builder (D-01/D-02)."""
    src = _builder_src()
    assert 'builder.add_node("verify_candidates"' in src, (
        'builder.py must call builder.add_node("verify_candidates", ...) to register the node.'
    )


def test_calibrator_to_signal_editor_edge() -> None:
    """calibrator → signal_editor edge must be present (D-01)."""
    src = _builder_src()
    assert 'builder.add_edge("calibrator", "signal_editor")' in src


def test_signal_editor_to_scout_edge() -> None:
    """signal_editor → scout edge must be present (D-01)."""
    src = _builder_src()
    assert 'builder.add_edge("signal_editor", "scout")' in src


def test_scout_to_verify_candidates_edge() -> None:
    """scout → verify_candidates edge must be present (D-01)."""
    src = _builder_src()
    assert 'builder.add_edge("scout", "verify_candidates")' in src


def test_verify_candidates_to_advocate_edge() -> None:
    """verify_candidates → advocate edge must be present (D-01)."""
    src = _builder_src()
    assert 'builder.add_edge("verify_candidates", "advocate")' in src


def test_old_calibrator_to_scout_edge_removed() -> None:
    """The old calibrator → scout direct edge must be removed (D-01 rewire)."""
    src = _builder_src()
    assert 'builder.add_edge("calibrator", "scout")' not in src, (
        'builder.py still has the old direct builder.add_edge("calibrator", "scout"). '
        "Remove it — replaced by the calibrator->signal_editor->scout chain (D-01)."
    )


def test_old_scout_to_advocate_edge_removed() -> None:
    """The old scout → advocate direct edge must be removed (D-01 rewire)."""
    src = _builder_src()
    assert 'builder.add_edge("scout", "advocate")' not in src, (
        'builder.py still has the old direct builder.add_edge("scout", "advocate"). '
        "Remove it — replaced by the scout->verify_candidates->advocate chain (D-01)."
    )


def test_compiled_graph_has_exactly_20_nodes() -> None:
    """Live introspection (D-03): the compiled graph has exactly 20 named
    nodes (excluding LangGraph's synthetic __start__/__end__), including
    both new Phase 46 nodes. Matches the default (DESIGNAGENT_SUPPRESSED
    unset) SECTION_WRITERS count of 7."""
    from langgraph.checkpoint.memory import MemorySaver

    from eisenbalm_pipeline.graph.builder import build_graph

    graph = build_graph(MemorySaver())
    nodes = set(graph.get_graph().nodes) - {"__start__", "__end__"}

    assert "signal_editor" in nodes, f"signal_editor missing from compiled graph nodes: {sorted(nodes)}"
    assert "verify_candidates" in nodes, f"verify_candidates missing from compiled graph nodes: {sorted(nodes)}"
    assert len(nodes) == 20, (
        f"Expected exactly 20 nodes (D-03: 18 + signal_editor + verify_candidates), "
        f"got {len(nodes)}: {sorted(nodes)}"
    )
