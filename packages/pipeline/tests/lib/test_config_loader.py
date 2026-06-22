"""Phase 22 Wave 0 scaffold — CFG-01 / CFG-03 / CFG-04 config_loader test seams.

Source: .planning/phases/22-config-externalization/22-RESEARCH.md
        (Validation Architecture → Test Map; Patterns 1/2/3) + 22-VALIDATION.md.

These tests name the not-yet-existing `eisenbalm_pipeline.lib.config_loader`
symbols (`load_run_config`, `RunConfig`, `AgentConfig`, `AGENT_KEY_TO_PROMPT_FILE`,
`WORKSPACE_ID`). Each is marked `xfail(strict=False)` so the suite stays GREEN at
Wave 0 — Plan 22-03 implements `config_loader` and removes these marks.

The `config_loader` import is guarded INSIDE each test body (not at module top)
so the file collects cleanly even before the module exists: an ImportError inside
an xfail test is reported as an expected failure, not a collection error.

`load_prompt` (the byte oracle) IS importable today — imported at module top.
"""
from __future__ import annotations

import dataclasses
import json
import logging

import pytest

# The byte oracle — exists today (lib/prompts.py). Used to assert fallback parity.
from eisenbalm_pipeline.lib.prompts import load_prompt


# ── Canonical 15 llm_config agent keys (source: lib/llm_config.MODEL_BY_AGENT) ──
# Inlined for Wave 0; Plan 22-03 may import MODEL_BY_AGENT directly.
LLM_CONFIG_AGENT_KEYS = (
    "calibrator", "chronicler", "editor_gate1", "editor_final", "qa",
    "researcher", "origin_story", "problem", "founder_bio", "case_study",
    "bonus", "game", "scout", "advocate", "design",
)

# ── The 11 canonical agentKey → prompt-file pairs (RESEARCH Pattern 7) ──────────
AGENT_KEY_TO_PROMPT_FILE_EXPECTED = {
    "scout": "scout",
    "advocate": "advocate",
    "editor_gate1": "editor",
    "editor_final": "editor-final",
    "calibrator": "calibrator",
    "researcher": "researcher",
    "design": "design",
    "game": "game",
    "bonus_big_budget": "bonus-big-budget",
    "bonus_jingle": "bonus-jingle",
    "bonus_spec_ad": "bonus-spec-ad",
}


_XFAIL = pytest.mark.xfail(
    reason="Phase 22 Plan 03 implements config_loader",
    strict=False,
)


@_XFAIL
async def test_load_run_config_from_convex(monkeypatch) -> None:
    """CFG-01: load_run_config() returns a RunConfig hydrated from Convex.

    Mocks convex_query to return agents + pipeline_config rows + active prompt
    versions; asserts every llm_config agent key is present and each AgentConfig
    carries model/temperature/top_p/max_tokens/enabled/system_prompt.
    """
    from eisenbalm_pipeline.lib import config_loader  # guarded import

    async def fake_query(http, path, args):
        if path == "agents:listForWorkspace":
            return [
                {
                    "agentKey": key,
                    "enabled": True,
                    "model": "anthropic/claude-opus-4-7",
                    "temperature": 0.2,
                    "top_p": 1.0,
                    "max_tokens": None,
                }
                for key in LLM_CONFIG_AGENT_KEYS
            ]
        if path == "pipelineConfig:getAll":
            return [
                {"key": "require_review", "value": json.dumps(True)},
                {"key": "auto_publish", "value": json.dumps(False)},
                {"key": "schedule_enabled", "value": json.dumps(False)},
            ]
        if path == "promptVersions:getActive":
            agent_key = args["agentKey"]
            prompt_file = AGENT_KEY_TO_PROMPT_FILE_EXPECTED.get(agent_key)
            if prompt_file is None:
                return None
            return {"content": load_prompt(prompt_file)}
        raise AssertionError(f"unexpected query path: {path}")

    monkeypatch.setattr(config_loader, "convex_query", fake_query)

    config = await config_loader.load_run_config(http=None)

    assert isinstance(config, config_loader.RunConfig)
    for key in LLM_CONFIG_AGENT_KEYS:
        assert key in config.agents, f"missing agent: {key}"
        ac = config.agents[key]
        assert isinstance(ac, config_loader.AgentConfig)
        assert ac.model
        assert ac.temperature is not None
        assert ac.top_p is not None
        assert ac.enabled in (True, False)
        assert hasattr(ac, "max_tokens")
        assert isinstance(ac.system_prompt, str)


@_XFAIL
async def test_hard_failure_fallback(monkeypatch, caplog) -> None:
    """CFG-03 (D-06): Convex raises → full disk/code fallback, single WARNING, no raise."""
    from eisenbalm_pipeline.lib import config_loader  # guarded import

    async def boom(http, path, args):
        raise RuntimeError("Convex unreachable")

    monkeypatch.setattr(config_loader, "convex_query", boom)

    with caplog.at_level(logging.WARNING):
        config = await config_loader.load_run_config(http=None)

    assert isinstance(config, config_loader.RunConfig)
    # Every migrated agent resolves to its on-disk prompt byte-for-byte.
    for agent_key, prompt_file in AGENT_KEY_TO_PROMPT_FILE_EXPECTED.items():
        assert config.agents[agent_key].system_prompt == load_prompt(prompt_file)
    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warnings) == 1, f"expected exactly one WARNING, got {len(warnings)}"


@_XFAIL
async def test_partial_fallback_per_key(monkeypatch, caplog) -> None:
    """CFG-03 (D-07): one missing prompt row → that agent file-falls-back + per-agent WARNING."""
    from eisenbalm_pipeline.lib import config_loader  # guarded import

    missing_key = "scout"

    async def fake_query(http, path, args):
        if path == "agents:listForWorkspace":
            return [
                {"agentKey": key, "enabled": True, "model": "anthropic/claude-opus-4-7",
                 "temperature": 0.2, "top_p": 1.0, "max_tokens": None}
                for key in LLM_CONFIG_AGENT_KEYS
            ]
        if path == "pipelineConfig:getAll":
            return []
        if path == "promptVersions:getActive":
            if args["agentKey"] == missing_key:
                return None  # the gap
            prompt_file = AGENT_KEY_TO_PROMPT_FILE_EXPECTED.get(args["agentKey"])
            return {"content": load_prompt(prompt_file)} if prompt_file else None
        raise AssertionError(f"unexpected query path: {path}")

    monkeypatch.setattr(config_loader, "convex_query", fake_query)

    with caplog.at_level(logging.WARNING):
        config = await config_loader.load_run_config(http=None)

    # The missing agent fell back to disk; others used Convex content.
    assert config.agents[missing_key].system_prompt == load_prompt(
        AGENT_KEY_TO_PROMPT_FILE_EXPECTED[missing_key]
    )
    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warnings) >= 1
    assert any(missing_key in r.getMessage() for r in warnings)


@_XFAIL
def test_fallback_bytes_match_load_prompt() -> None:
    """CFG-03: the all-or-nothing fallback config is byte-identical to load_prompt() per key."""
    from eisenbalm_pipeline.lib import config_loader  # guarded import

    config = config_loader._build_fallback_config()
    for agent_key, prompt_file in AGENT_KEY_TO_PROMPT_FILE_EXPECTED.items():
        assert config.agents[agent_key].system_prompt == load_prompt(prompt_file)


@_XFAIL
def test_snapshot_roundtrip() -> None:
    """CFG-04: json.loads(json.dumps(dataclasses.asdict(config))) preserves per-agent values."""
    from eisenbalm_pipeline.lib import config_loader  # guarded import

    config = config_loader._build_fallback_config()
    roundtripped = json.loads(json.dumps(dataclasses.asdict(config)))

    assert roundtripped["workspace_id"] == config.workspace_id
    for agent_key in AGENT_KEY_TO_PROMPT_FILE_EXPECTED:
        rt = roundtripped["agents"][agent_key]
        original = config.agents[agent_key]
        assert rt["model"] == original.model
        assert rt["system_prompt"] == original.system_prompt
        assert rt["temperature"] == original.temperature
        assert rt["enabled"] == original.enabled
