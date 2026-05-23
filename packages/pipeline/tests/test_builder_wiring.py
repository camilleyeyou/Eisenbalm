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
