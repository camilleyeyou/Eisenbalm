"""Phase 5 Editor Final unit tests — Plan 05-13. Validation: AGT-16.

Editor Final reviews QA output, writes an advisory memo (100-300 words)
for Andrew, and emits the editor-final event. It NEVER rewrites any
section and NEVER rejects the draft.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.editor import (
    EditorFinalOutput,
    _build_editor_final_messages,
    editor_final,
)


def test_editor_final_prompt_is_advisory() -> None:
    """AGT-16 / D-02: prompt contains explicit 'Do NOT rewrite' + 'Do NOT reject'."""
    messages = _build_editor_final_messages({
        "qa_corrections": [
            {
                "sectionName": "problem",
                "severity": "error",
                "reason": "exclamation mark",
            },
        ],
        "origin_story": {"headline": "O"},
        "problem_statement": {"headline": "P"},
    })
    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"
    system = messages[0]["content"]
    assert "Do NOT rewrite" in system
    assert "Do NOT reject" in system


def test_editor_final_prompt_includes_qa_corrections() -> None:
    """User prompt must surface the QA findings to the Editor."""
    messages = _build_editor_final_messages({
        "qa_corrections": [
            {
                "sectionName": "problem",
                "severity": "error",
                "reason": "passion is forbidden",
            },
        ],
    })
    user = messages[1]["content"]
    assert "passion is forbidden" in user
    assert "problem" in user


def test_editor_final_output_pydantic_field() -> None:
    """EditorFinalOutput has exactly one field: editorFinalNotes."""
    out = EditorFinalOutput(editorFinalNotes="X" * 150)
    assert out.editorFinalNotes == "X" * 150
    # Pydantic should not allow extra fields by default (BaseModel default).
    assert hasattr(out, "editorFinalNotes")


@pytest.mark.asyncio
async def test_editor_final_emits_notes(sample_dispatch_state) -> None:
    """AGT-16: Editor Final writes editor_final_notes; doesn't mutate sections."""
    sample_dispatch_state["qa_corrections"] = []
    sample_dispatch_state["origin_story"] = {"headline": "O", "body": "obody"}

    out = EditorFinalOutput(editorFinalNotes="X" * 150)
    with patch(
        "eisenbalm_pipeline.agents.editor.acomplete",
        AsyncMock(
            return_value=(
                out,
                {
                    "tokens_in": 0,
                    "tokens_out": 0,
                    "usd": 0.0,
                    "resolved_model": "anthropic/claude-opus-4-7-20251101",
                },
            )
        ),
    ), patch(
        "eisenbalm_pipeline.agents.editor.convex_mutation_safe",
        AsyncMock(),
    ):
        result = await editor_final(sample_dispatch_state)

    assert "editor_final_notes" in result
    assert len(result["editor_final_notes"]) == 150
    # Section state unchanged — D-02 / AGT-16 (Editor Final never rewrites).
    assert result["origin_story"]["body"] == "obody"
    # AGT-17: modelVersions['editor_final'] populated.
    assert result["model_versions"]["editor_final"] == (
        "anthropic/claude-opus-4-7-20251101"
    )


@pytest.mark.asyncio
async def test_editor_final_with_findings_does_not_block(sample_dispatch_state) -> None:
    """AGT-16 / D-04: Editor Final never blocks the draft even with error findings."""
    sample_dispatch_state["qa_corrections"] = [
        {
            "sectionName": "problem",
            "severity": "error",
            "axis": "gravity",
            "reason": "exclamation mark detected",
            "suggestedFix": "remove",
            "quotedSpan": "Wow!",
            "accepted": False,
        },
    ]
    out = EditorFinalOutput(
        editorFinalNotes="Andrew: please review the problem section for tone."
    )
    with patch(
        "eisenbalm_pipeline.agents.editor.acomplete",
        AsyncMock(
            return_value=(
                out,
                {
                    "tokens_in": 0,
                    "tokens_out": 0,
                    "usd": 0.0,
                    "resolved_model": "anthropic/claude-opus-4-7",
                },
            )
        ),
    ), patch(
        "eisenbalm_pipeline.agents.editor.convex_mutation_safe",
        AsyncMock(),
    ):
        result = await editor_final(sample_dispatch_state)

    # No exception raised; success state returned with notes populated.
    assert "editor_final_notes" in result
    assert "review the problem section" in result["editor_final_notes"]
