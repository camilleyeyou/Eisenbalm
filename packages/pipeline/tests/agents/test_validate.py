"""Phase 12 Wave 0 — test_validate.py.

Asserts both modes of validate_sections:

  1. Non-suppressed (default): REQUIRED_FIELDS includes "theme"; missing
     theme raises RuntimeError("partial-failure: missing sections [...]").

  2. Suppressed (DESIGNAGENT_SUPPRESSED=true): REQUIRED_FIELDS drops "theme";
     validate_sections passes with all 6 non-theme fields present.

The suppressed mode is an xfail Wave-0 stub because validate.py does NOT yet
read DESIGNAGENT_SUPPRESSED at module import time — Plan 12-02 (Wave 1) adds
the _SUPPRESSED gate. Plan 12-02 removes the xfail decorator when it
implements the gate.

Pattern: set env var via monkeypatch BEFORE importing/reloading the module,
because validate.py reads DESIGNAGENT_SUPPRESSED at MODULE IMPORT TIME
(builder.py + validate.py have `_SUPPRESSED = os.environ.get(...)` at module
scope in Wave 1). See 12-RESEARCH.md Pattern 2 + Pitfall 2.
"""
from __future__ import annotations

import importlib

import pytest


# ── Module-level helper ───────────────────────────────────────────────────────


async def _noop_async(*a, **k):
    """No-op coroutine for patching convex_mutation_safe in failure path."""
    return None


def _build_complete_state_without_theme() -> dict:
    """Minimal DispatchState dict with all 6 non-theme section fields populated truthy.

    Notably absent: "theme" key — simulates the state produced when the
    design node was suppressed and never ran.
    """
    return {
        "run_id": "test-run-suppressed",
        "origin_story": {"body": "x"},
        "problem_statement": {"body": "x"},
        "founder_bio": {"body": "x"},
        "case_study": {"body": "x"},
        "game": {"description": "x"},
        "bonus": {"body": "x"},
        # NOTE: no "theme" key — design node was suppressed.
    }


# ── Tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_validate_sections_requires_theme_when_not_suppressed(monkeypatch):
    """validate_sections raises RuntimeError when theme is absent in non-suppressed mode.

    Non-suppressed is the current default (DESIGNAGENT_SUPPRESSED unset).
    REQUIRED_FIELDS includes "theme" — a state without it must fail.

    This test PASSES immediately (pre-Wave-1): the current REQUIRED_FIELDS
    tuple already includes "theme" unconditionally.
    """
    monkeypatch.delenv("DESIGNAGENT_SUPPRESSED", raising=False)
    import eisenbalm_pipeline.agents.validate as validate_mod
    importlib.reload(validate_mod)

    # Pre-Wave-1: REQUIRED_FIELDS always includes "theme".
    assert "theme" in validate_mod.REQUIRED_FIELDS

    state = _build_complete_state_without_theme()

    # Patch convex_mutation_safe so the failure path doesn't hit the network.
    monkeypatch.setattr(validate_mod, "convex_mutation_safe", _noop_async)

    with pytest.raises(RuntimeError, match="missing sections"):
        await validate_mod.validate_sections(state)


@pytest.mark.xfail(
    reason=(
        "REQUIRED_FIELDS env gate lands in Plan 12-02 (Wave 1). "
        "validate.py does not yet read DESIGNAGENT_SUPPRESSED at import time. "
        "Plan 12-02 removes this xfail decorator when it adds the _SUPPRESSED gate."
    ),
    strict=False,
)
@pytest.mark.asyncio
async def test_validate_sections_skips_theme_when_suppressed(monkeypatch):
    """validate_sections passes without theme when DESIGNAGENT_SUPPRESSED=true.

    Wave-0 xfail stub: Plan 12-02 adds
        _SUPPRESSED = os.environ.get("DESIGNAGENT_SUPPRESSED", "").lower() in ("1", "true", "yes")
        REQUIRED_FIELDS = (..., *(() if _SUPPRESSED else ("theme",)))
    to validate.py. Once that lands, this test turns GREEN and the xfail
    decorator is removed.
    """
    monkeypatch.setenv("DESIGNAGENT_SUPPRESSED", "true")
    import eisenbalm_pipeline.agents.validate as validate_mod
    importlib.reload(validate_mod)

    # Post-Wave-1: REQUIRED_FIELDS must NOT include "theme" when suppressed.
    assert "theme" not in validate_mod.REQUIRED_FIELDS

    state = _build_complete_state_without_theme()

    # Should pass through without raising — returns the state unchanged.
    result = await validate_mod.validate_sections(state)
    assert result is state  # pass-through, no RuntimeError
