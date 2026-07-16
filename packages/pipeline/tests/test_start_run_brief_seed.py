"""Phase 48 Wave 0 — `_start_run` brief-mode seeding scaffold (ENT-02, §48.3).

Unit tests for `_start_run`'s four new OPTIONAL params (`entry_mode`,
`winning_charity`, `brief`, `source_material`, `agent_keys_override`,
§48.3). Skip-guarded via `inspect.signature(_start_run)` — the symbol
already exists (Phase 25), only its signature is incomplete pre-48-03, so
this is a signature-introspection guard rather than an ImportError guard
(mirrors test_builder_entry_mode_wiring.py's source-scan idiom, adapted for
a live Python callable instead of a text file).

Stubs `_cc.convex_mutation` / `load_run_config` / `snapshot_config` /
`_execute_run` directly (module-qualified — `api/runs.py` does
`import eisenbalm_pipeline.lib.convex_client as _cc`, so patching the
`convex_client` module's own attributes reaches every caller, mirroring
tests/test_leads_endpoints.py's `_wire()` idiom) so no real Convex network
call or LangGraph execution happens. `_execute_run` is replaced with an
AsyncMock so this file asserts on the `initial_state` dict `_start_run`
built, without needing a real compiled graph.
"""
from __future__ import annotations

import inspect
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI

import eisenbalm_pipeline.api.runs as runs_mod
import eisenbalm_pipeline.lib.convex_client as cc_mod
from eisenbalm_pipeline.api.runs import _start_run
from eisenbalm_pipeline.lib.config_loader import RunConfig


def _entry_mode_wired() -> bool:
    """True only once _start_run's signature carries entry_mode (Plan 48-03)."""
    return "entry_mode" in inspect.signature(_start_run).parameters


pytestmark = pytest.mark.skipif(
    not _entry_mode_wired(),
    reason="Wave 2 not yet wired: _start_run has no entry_mode param yet (Plan 48-03).",
)


# ── Fixture data ─────────────────────────────────────────────────────────

FULL_AGENT_KEYS = [
    "calibrator", "signal_editor", "scout", "verify_candidates", "advocate",
    "editor_gate_1", "chronicler",
    "researcher", "verify_research",
    "origin_story", "problem", "founder_bio", "case_study", "game", "bonus", "design",
    "validate_sections", "qa", "editor_final", "publisher",
]

REDUCED_BRIEF_AGENT_KEYS = [
    "calibrator", "verify_candidates", "researcher", "verify_research",
    "origin_story", "problem", "founder_bio", "case_study", "game", "bonus", "design",
    "validate_sections", "qa", "editor_final", "publisher",
]

ORGANIZATION: dict = {
    "name": "Quiet Harvest Food Bank",
    "location": "",
    "website": "https://quiet-harvest.example.org",
    "charityNavigatorUrl": None,
    "guidestarUrl": None,
    "foundingYear": None,
    "assetRange": "",
    "focusArea": "",
    "missionStatement": "",
    "scoutSummary": "",
    "whyOverlooked": "",
    "advocateArgument": None,
    "advocateScore": None,
}

BRIEF: dict = {
    "premise": "A quiet food bank quietly feeds a third of the county.",
    "currentPeg": "Their annual harvest drive starts next Tuesday.",
    "centralClaim": "",
    "readerEffect": "",
    "knownRisks": "",
    "voiceIntention": "",
}


def _build_app() -> FastAPI:
    return FastAPI()


def _wire(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, dict]]:
    """Stub the Convex + config-loader surface `_start_run` touches so this
    file exercises ONLY its own seeding logic — no real network, no real
    graph. Returns the list every convex_mutation call is recorded into."""
    calls: list[tuple[str, dict]] = []

    async def mock_convex_mutation(http, path, args):
        calls.append((path, dict(args)))
        return {"status": "success"}

    async def mock_load_run_config(http):
        return RunConfig(
            workspace_id="eisenbalm",
            agents={},
            require_review=False,
            auto_publish=False,
            schedule_enabled=False,
        )

    async def mock_snapshot_config(http, run_id, config):
        return None

    monkeypatch.setattr(cc_mod, "convex_mutation", mock_convex_mutation)
    monkeypatch.setattr(runs_mod, "load_run_config", mock_load_run_config)
    monkeypatch.setattr(runs_mod, "snapshot_config", mock_snapshot_config)
    monkeypatch.setattr(runs_mod, "_execute_run", AsyncMock())
    return calls


# ── Existing-caller regression ──────────────────────────────────────────


async def test_existing_caller_regression_no_entry_mode_key(monkeypatch) -> None:
    """§48.3: an existing caller (no new params) is byte-unchanged — no
    entryMode key on runs:create, the full 20-key agentRuns:queueForRun list,
    and NO briefs:insert call."""
    calls = _wire(monkeypatch)
    app = _build_app()

    await _start_run(app, issue_number=42, trigger_source="manual")

    create_calls = [a for p, a in calls if p == "runs:create"]
    assert len(create_calls) == 1
    assert "entryMode" not in create_calls[0], (
        "Existing callers must NOT carry an entryMode key on runs:create "
        "(byte-unchanged behavior, §48.3)."
    )

    queue_calls = [a for p, a in calls if p == "agentRuns:queueForRun"]
    assert len(queue_calls) == 1
    assert queue_calls[0]["agentKeys"] == FULL_AGENT_KEYS, (
        "Existing callers must get the full 20-step agentKeys list, unchanged."
    )

    briefs_calls = [a for p, a in calls if p == "briefs:insert"]
    assert briefs_calls == [], "briefs:insert must NOT be called when brief is None."


# ── Brief-mode seeding ───────────────────────────────────────────────────


async def test_brief_mode_seeds_initial_state(monkeypatch) -> None:
    """§48.3: entry_mode='brief' seeds entry_mode/winning_charity/candidates/
    brief/source_material into initial_state, passed through to
    _execute_run — and runs:create/agentRuns:queueForRun carry the brief-mode
    shapes."""
    calls = _wire(monkeypatch)
    mock_execute = runs_mod._execute_run  # the AsyncMock installed by _wire
    app = _build_app()

    run_id = await _start_run(
        app,
        issue_number=42,
        trigger_source="manual",
        entry_mode="brief",
        winning_charity=ORGANIZATION,
        brief=BRIEF,
        source_material="https://example.org/notes",
        agent_keys_override=REDUCED_BRIEF_AGENT_KEYS,
    )

    assert mock_execute.call_count == 1
    call = mock_execute.call_args
    _app_arg, _run_id_arg, initial_state, _config = call.args
    assert initial_state["entry_mode"] == "brief"
    assert initial_state["winning_charity"] == ORGANIZATION
    assert initial_state["candidates"] == [ORGANIZATION], (
        "D-05: candidates must be seeded with the single human org so "
        "verify_candidates has its input."
    )
    assert initial_state["brief"] == BRIEF
    assert initial_state["source_material"] == "https://example.org/notes"

    create_calls = [a for p, a in calls if p == "runs:create"]
    assert len(create_calls) == 1
    assert create_calls[0]["entryMode"] == "brief"

    queue_calls = [a for p, a in calls if p == "agentRuns:queueForRun"]
    assert len(queue_calls) == 1
    assert queue_calls[0]["agentKeys"] == REDUCED_BRIEF_AGENT_KEYS
    for excluded in ("signal_editor", "scout", "advocate", "editor_gate_1", "chronicler"):
        assert excluded not in queue_calls[0]["agentKeys"], (
            f"D-16: the brief-mode agentRuns:queueForRun list must exclude {excluded!r}."
        )

    briefs_calls = [a for p, a in calls if p == "briefs:insert"]
    assert len(briefs_calls) == 1, (
        "briefs:insert must be called exactly once when brief is not None (§48.3)."
    )
    assert briefs_calls[0]["runId"] == run_id
    for key, value in BRIEF.items():
        assert briefs_calls[0][key] == value


async def test_briefs_insert_not_called_when_brief_none(monkeypatch) -> None:
    """§48.3: briefs:insert is skipped whenever brief is None — even in brief
    mode — since the write is gated on `brief is not None`, not on
    entry_mode alone."""
    calls = _wire(monkeypatch)
    app = _build_app()

    await _start_run(
        app,
        issue_number=42,
        trigger_source="manual",
        entry_mode="brief",
        winning_charity=ORGANIZATION,
        brief=None,
    )

    briefs_calls = [a for p, a in calls if p == "briefs:insert"]
    assert briefs_calls == [], "briefs:insert must NOT be called when brief is None."


async def test_discovery_mode_still_seeds_entry_mode_explicitly(monkeypatch) -> None:
    """§48.3: 'entry_mode' is ALWAYS set on initial_state, even for a plain
    discovery-mode call — discovery runs get 'discovery' explicitly rather
    than relying solely on the router's `or "discovery"` fallback."""
    calls = _wire(monkeypatch)
    mock_execute = runs_mod._execute_run
    app = _build_app()

    await _start_run(app, issue_number=42, trigger_source="manual")

    call = mock_execute.call_args
    _app_arg, _run_id_arg, initial_state, _config = call.args
    assert initial_state["entry_mode"] == "discovery"
    assert "winning_charity" not in initial_state
    assert "brief" not in initial_state
