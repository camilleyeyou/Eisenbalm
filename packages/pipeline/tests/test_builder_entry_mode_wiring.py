"""Phase 48 Wave 0 — Builder entry-mode-fork source-scan test (ENT-02).

Covers §48.1 (docs/API_CONTRACTS.md): the graph fork keyed on
``DispatchState['entry_mode']``. Both discovery and brief runs begin
identically — ``START -> calibrator`` stays a single UNCONDITIONAL edge (the
calibrator sets ``style_brief`` + resolves the narrator in both modes, D-02).
The fork happens at the two points where the two chains diverge:

  - ``calibrator -> {signal_editor|verify_candidates}`` (REPLACES the old
    static ``calibrator -> signal_editor`` edge)
  - ``verify_candidates -> {advocate|researcher}`` (REPLACES the old static
    ``verify_candidates -> advocate`` edge)

This is a PURE source-scan — reads graph/builder.py as text, no imports.
Mirrors tests/test_builder_wiring.py's skip-guard idiom exactly. Tests are
skip-guarded until Plan 48-03 rewires the builder (Wave 2).
"""
from __future__ import annotations

from pathlib import Path

import pytest

BUILDER_PATH = Path(__file__).parent.parent / "src" / "eisenbalm_pipeline" / "graph" / "builder.py"


def _builder_src() -> str:
    return BUILDER_PATH.read_text(encoding="utf-8")


def _fork_wired() -> bool:
    """Return True only when the calibrator conditional-edge fork is already
    in the builder source (Plan 48-03's entry seam)."""
    src = _builder_src()
    return 'builder.add_conditional_edges("calibrator"' in src


# Skip the whole module until Plan 48-03 lands the entry-mode conditional-edge
# fork. When wired, the skip condition is False and every assertion runs.
pytestmark = pytest.mark.skipif(
    not _fork_wired(),
    reason=(
        "Wave 2 not yet wired: entry-mode conditional-edge fork not yet added "
        "to builder.py (Plan 48-03)."
    ),
)


def test_start_to_calibrator_edge_unconditional_and_unchanged() -> None:
    """START -> calibrator stays a single unconditional edge in both modes
    (D-02, §48.1) — both chains begin identically at calibrator."""
    src = _builder_src()
    assert 'builder.add_edge(START, "calibrator")' in src, (
        'builder.py must keep builder.add_edge(START, "calibrator") '
        "unconditional — both discovery and brief runs begin identically at "
        "calibrator (D-02)."
    )


def test_calibrator_conditional_edges_path_map() -> None:
    """calibrator -> {signal_editor|verify_candidates}, a conditional edge
    keyed on entry_mode (§48.1)."""
    src = _builder_src()
    assert 'builder.add_conditional_edges("calibrator"' in src, (
        'builder.py must call builder.add_conditional_edges("calibrator", '
        "route_by_entry_mode, {...}). Run Plan 48-03 to implement."
    )
    assert '"discovery": "signal_editor"' in src, (
        "calibrator's conditional path_map must route entry_mode='discovery' "
        "to signal_editor."
    )
    assert '"brief": "verify_candidates"' in src, (
        "calibrator's conditional path_map must route entry_mode='brief' to "
        "verify_candidates."
    )


def test_verify_candidates_conditional_edges_path_map() -> None:
    """verify_candidates -> {advocate|researcher}, a conditional edge keyed on
    entry_mode (§48.1)."""
    src = _builder_src()
    assert 'builder.add_conditional_edges("verify_candidates"' in src, (
        'builder.py must call builder.add_conditional_edges("verify_candidates", '
        "route_by_entry_mode, {...}). Run Plan 48-03 to implement."
    )
    assert '"discovery": "advocate"' in src, (
        "verify_candidates's conditional path_map must route entry_mode='discovery' "
        "to advocate."
    )
    assert '"brief": "researcher"' in src, (
        "verify_candidates's conditional path_map must route entry_mode='brief' "
        "to researcher."
    )


def test_old_calibrator_to_signal_editor_static_edge_removed() -> None:
    """The old static calibrator -> signal_editor edge must be REPLACED by
    the conditional fork (§48.1 — 'REPLACES the existing static edge')."""
    src = _builder_src()
    assert 'builder.add_edge("calibrator", "signal_editor")' not in src, (
        'builder.py still has the old direct builder.add_edge("calibrator", '
        '"signal_editor"). Remove it — replaced by the calibrator '
        "conditional-edges fork (§48.1)."
    )


def test_old_verify_candidates_to_advocate_static_edge_removed() -> None:
    """The old static verify_candidates -> advocate edge must be REPLACED by
    the conditional fork (§48.1)."""
    src = _builder_src()
    assert 'builder.add_edge("verify_candidates", "advocate")' not in src, (
        'builder.py still has the old direct builder.add_edge('
        '"verify_candidates", "advocate"). Remove it — replaced by the '
        "verify_candidates conditional-edges fork (§48.1)."
    )


def test_route_by_entry_mode_router_defined() -> None:
    """A single router function, route_by_entry_mode, is defined and reused
    at both conditional-edge call sites (§48.1)."""
    src = _builder_src()
    assert "def route_by_entry_mode(" in src, (
        "builder.py must define def route_by_entry_mode(state: DispatchState) "
        "-> str, reused at both conditional-edge call sites. Run Plan 48-03 "
        "to implement."
    )


def test_every_other_edge_untouched() -> None:
    """Every OTHER edge in the discovery chain — the parts §48.1 says stay
    byte-unchanged — is still present after the fork lands (regression guard
    against an over-eager rewrite)."""
    src = _builder_src()
    for edge in (
        'builder.add_edge("signal_editor", "scout")',
        'builder.add_edge("scout", "verify_candidates")',
        'builder.add_edge("advocate", "editor_gate_1")',
        'builder.add_edge("editor_gate_1", "chronicler")',
        'builder.add_edge("chronicler", "researcher")',
        'builder.add_edge("researcher", "verify_research")',
    ):
        assert edge in src, (
            f"{edge} must remain untouched — only the two calibrator/"
            "verify_candidates hops become conditional (§48.1)."
        )
