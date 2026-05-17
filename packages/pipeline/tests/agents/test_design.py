"""Phase 5 DesignAgent unit tests — Plan 05-12. Validation: AGT-13, AGT-14.

Asserts:
  - Hex regex validation via lib/wcag.validate_theme
  - Font whitelist enforcement via agents/design/font_whitelist.FONT_WHITELIST
  - Regenerate-once on first failure
  - Fallback to SAFE_THEME + qaCorrections severity='warning' on second failure
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.design import (
    ThemeOutput,
    _validate_full,
    design,
)
from eisenbalm_pipeline.agents.design.font_whitelist import FONT_WHITELIST
from eisenbalm_pipeline.lib.wcag import SAFE_THEME


def _valid_theme() -> ThemeOutput:
    return ThemeOutput(
        primaryColor="#2D5016",
        accentColor="#8B1A1A",
        backgroundColor="#FAFAF8",
        textColor="#1A1A18",
        fontDisplay="Playfair Display",
        fontBody="Source Serif Pro",
    )


def _invalid_hex_theme() -> ThemeOutput:
    return ThemeOutput(
        primaryColor="#XYZXYZ",
        accentColor="#8B1A1A",
        backgroundColor="#FAFAF8",
        textColor="#1A1A18",
        fontDisplay="Playfair Display",
        fontBody="Source Serif Pro",
    )


def _bad_font_theme() -> ThemeOutput:
    return ThemeOutput(
        primaryColor="#2D5016",
        accentColor="#8B1A1A",
        backgroundColor="#FAFAF8",
        textColor="#1A1A18",
        fontDisplay="Comic Sans",
        fontBody="Source Serif Pro",
    )


# ── Pure validator unit tests ─────────────────────────────────────────────


def test_hex_validation_passes() -> None:
    """AGT-13: a fully-valid SAFE_THEME-shaped dict passes _validate_full."""
    errs = _validate_full({**SAFE_THEME})
    assert errs == []


def test_hex_validation_fails_on_bad_color() -> None:
    """AGT-13: invalid hex in any color slot surfaces an error."""
    bad = {**SAFE_THEME, "primaryColor": "#GGGGGG"}
    errs = _validate_full(bad)
    assert any("primaryColor" in e for e in errs)


def test_font_whitelist_enforced() -> None:
    """AGT-14: fontDisplay not in whitelist surfaces a whitelist error."""
    bad = {**SAFE_THEME, "fontDisplay": "Comic Sans"}
    errs = _validate_full(bad)
    assert any("fontDisplay" in e and "whitelist" in e for e in errs)


def test_font_whitelist_enforced_body() -> None:
    """AGT-14: fontBody not in whitelist surfaces a whitelist error."""
    bad = {**SAFE_THEME, "fontBody": "Comic Sans"}
    errs = _validate_full(bad)
    assert any("fontBody" in e and "whitelist" in e for e in errs)


def test_wcag_failure_surfaces_contrast_error() -> None:
    """AGT-13: low-contrast bg+text pair is detected via lib/wcag."""
    bad = {**SAFE_THEME, "backgroundColor": "#FFFFFF", "textColor": "#EEEEEE"}
    errs = _validate_full(bad)
    assert any("contrast" in e.lower() for e in errs)


def test_safe_theme_fonts_in_whitelist() -> None:
    """Sanity: lib/wcag.SAFE_THEME fonts must be in the font whitelist.

    Guards against drift between the two modules — if either changes
    in a way that breaks this, DesignAgent's fallback path would itself
    fail validation (catastrophic).
    """
    assert SAFE_THEME["fontDisplay"] in FONT_WHITELIST
    assert SAFE_THEME["fontBody"] in FONT_WHITELIST


# ── End-to-end agent behavior tests ──────────────────────────────────────


@pytest.mark.asyncio
async def test_valid_theme_passes_first_try(sample_dispatch_state) -> None:
    """AGT-13/14: valid theme on first attempt — no qaCorrections written."""
    sample_dispatch_state["winning_charity"] = {"name": "Foo"}
    sample_dispatch_state["style_brief"] = {"visualDirection": "warm"}

    mock_acomplete = AsyncMock(return_value=(_valid_theme(), {
        "tokens_in": 0,
        "tokens_out": 0,
        "usd": 0.0,
        "resolved_model": "anthropic/claude-haiku-4-5",
    }))
    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.agents.design.acomplete", mock_acomplete,
    ), patch(
        "eisenbalm_pipeline.agents.design.convex_mutation_safe", mock_convex,
    ):
        result = await design(sample_dispatch_state)

    assert result["theme"]["primaryColor"] == "#2D5016"
    assert mock_acomplete.call_count == 1
    qa_calls = [
        c for c in mock_convex.call_args_list
        if c.args and c.args[0] == "qaCorrections:insert"
    ]
    assert len(qa_calls) == 0
    # AGT-17: model_versions populated.
    assert result["model_versions"]["design"] == "anthropic/claude-haiku-4-5"


@pytest.mark.asyncio
async def test_invalid_then_valid_regenerates(sample_dispatch_state) -> None:
    """AGT-13: first attempt invalid → second attempt valid → no fallback."""
    sample_dispatch_state["winning_charity"] = {"name": "Foo"}
    sample_dispatch_state["style_brief"] = {"visualDirection": "warm"}

    call_count = 0

    def side_effect(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        theme = _invalid_hex_theme() if call_count == 1 else _valid_theme()
        return (theme, {
            "tokens_in": 0,
            "tokens_out": 0,
            "usd": 0.0,
            "resolved_model": "anthropic/claude-haiku-4-5",
        })

    mock_acomplete = AsyncMock(side_effect=side_effect)
    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.agents.design.acomplete", mock_acomplete,
    ), patch(
        "eisenbalm_pipeline.agents.design.convex_mutation_safe", mock_convex,
    ):
        result = await design(sample_dispatch_state)

    assert mock_acomplete.call_count == 2
    assert result["theme"]["primaryColor"] == "#2D5016"
    qa_calls = [
        c for c in mock_convex.call_args_list
        if c.args and c.args[0] == "qaCorrections:insert"
    ]
    assert len(qa_calls) == 0  # second attempt succeeded; no fallback warn


@pytest.mark.asyncio
async def test_font_failure_regenerates(sample_dispatch_state) -> None:
    """AGT-14: bad font on first attempt → regenerate → valid → no fallback."""
    sample_dispatch_state["winning_charity"] = {"name": "Foo"}
    sample_dispatch_state["style_brief"] = {"visualDirection": "warm"}

    call_count = 0

    def side_effect(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        theme = _bad_font_theme() if call_count == 1 else _valid_theme()
        return (theme, {
            "tokens_in": 0,
            "tokens_out": 0,
            "usd": 0.0,
            "resolved_model": "anthropic/claude-haiku-4-5",
        })

    mock_acomplete = AsyncMock(side_effect=side_effect)
    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.agents.design.acomplete", mock_acomplete,
    ), patch(
        "eisenbalm_pipeline.agents.design.convex_mutation_safe", mock_convex,
    ):
        result = await design(sample_dispatch_state)

    assert mock_acomplete.call_count == 2
    assert result["theme"]["fontDisplay"] == "Playfair Display"


@pytest.mark.asyncio
async def test_double_failure_falls_back_to_safe_theme(
    sample_dispatch_state,
) -> None:
    """AGT-13/14: both attempts invalid → fallback to SAFE_THEME + warning."""
    sample_dispatch_state["winning_charity"] = {"name": "Foo"}
    sample_dispatch_state["style_brief"] = {"visualDirection": "warm"}

    mock_acomplete = AsyncMock(return_value=(_bad_font_theme(), {
        "tokens_in": 0,
        "tokens_out": 0,
        "usd": 0.0,
        "resolved_model": "anthropic/claude-haiku-4-5",
    }))
    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.agents.design.acomplete", mock_acomplete,
    ), patch(
        "eisenbalm_pipeline.agents.design.convex_mutation_safe", mock_convex,
    ):
        result = await design(sample_dispatch_state)

    # Fallback fonts come from agents/design/font_whitelist.FALLBACK_*.
    assert result["theme"]["fontDisplay"] == "Playfair Display"
    assert result["theme"]["fontBody"] == "Source Serif Pro"
    # 2 acomplete calls (regenerate-once already used).
    assert mock_acomplete.call_count == 2
    # One qaCorrections:insert with severity='warning'.
    qa_calls = [
        c for c in mock_convex.call_args_list
        if c.args and c.args[0] == "qaCorrections:insert"
    ]
    assert len(qa_calls) == 1
    args = qa_calls[0].args[1]
    assert args["severity"] == "warning"
    assert args["runId"] == sample_dispatch_state["run_id"]
    assert args["agentId"] == "design"
