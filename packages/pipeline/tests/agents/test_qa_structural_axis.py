"""Phase 18 MEL-04 — QA judge structural-variety axis RED test.

Asserts:
  1. JudgeFinding.axis Literal includes "structural-variety"
  2. rubric.md contains a "structural-variety" axis section

RED at commit (Wave 0); turns GREEN after Plan 18-05 extends the Literal
and appends the axis to rubric.md.

Source: CONTEXT.md D-05; RESEARCH §Pattern 5.
"""
from __future__ import annotations

from pathlib import Path
from typing import get_args, get_type_hints

from eisenbalm_pipeline.agents.qa.judge import JudgeFinding


def test_judge_finding_axis_includes_structural_variety():
    """MEL-04: 'structural-variety' is a permitted JudgeFinding.axis value."""
    hints = get_type_hints(JudgeFinding)
    axis_type = hints["axis"]
    permitted = set(get_args(axis_type))
    assert "structural-variety" in permitted, (
        f"Expected 'structural-variety' in JudgeFinding.axis Literal, "
        f"got {sorted(permitted)}"
    )


def test_rubric_md_documents_structural_variety_axis():
    """MEL-04: rubric.md has a 'structural-variety' axis section under Evaluation Axes."""
    rubric_path = (
        Path(__file__).resolve().parents[2]
        / "src" / "eisenbalm_pipeline" / "agents" / "qa" / "rubric.md"
    )
    text = rubric_path.read_text(encoding="utf-8")
    assert "structural-variety" in text, (
        "rubric.md must document the 'structural-variety' axis"
    )
    # Severity guidance: this axis uses 'warning' (not 'error') per CONTEXT D-05
    # — confirm a warning-severity reference appears in the axis section.
    # Find the section header and check the following ~10 lines mention 'warning'.
    idx = text.find("structural-variety")
    nearby = text[idx:idx + 600]
    assert "warning" in nearby.lower(), (
        "rubric.md must indicate severity='warning' for structural-variety axis "
        "(per CONTEXT D-05 — Phase 5 D-02 keeps QA annotation-only)"
    )
