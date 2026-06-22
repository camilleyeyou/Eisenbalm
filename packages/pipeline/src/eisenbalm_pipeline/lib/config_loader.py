"""Phase 22 (CFG-01/CFG-03/CFG-04) — run-start config loader + snapshot.

Loaded ONCE at run start (in the HTTP handler, BEFORE graph.ainvoke) by
``load_run_config()``; the resolved ``RunConfig`` is snapshotted to
``runs.configSnapshot`` via ``snapshot_config()`` and threaded into
``DispatchState.config`` for the 11 prompt call sites (Plan 05).

Two-tier fallback (D-06 / D-07):
  - Hard Convex failure → full disk/code fallback for the whole run, single
    WARNING, never raises (D-06).
  - Per-key gap (one missing prompt/agent row) → only that agent falls back to
    its on-disk default + per-agent WARNING; the rest use Convex values (D-07).

The fallback oracle is ``lib.prompts.load_prompt`` + ``lib.llm_config`` — the
fallback ``system_prompt`` bytes are byte-identical to ``load_prompt(name)`` so
the Plan 05 call-site swap keeps the voice tripwire tests green.

Source: docs/API_CONTRACTS.md §4A + §7; 22-RESEARCH.md Patterns 1/2/3/7.
"""
from __future__ import annotations

import dataclasses
import json
import logging
from dataclasses import dataclass
from typing import Any, Optional

from eisenbalm_pipeline.lib.convex_client import convex_mutation, convex_query
from eisenbalm_pipeline.lib.llm_config import (
    MAX_TOKENS_BY_AGENT,
    MODEL_BY_AGENT,
    SAMPLING_BY_AGENT,
)
from eisenbalm_pipeline.lib.prompts import load_prompt

log = logging.getLogger(__name__)

# ── Workspace constant ──────────────────────────────────────────────────────
WORKSPACE_ID = "eisenbalm"


# ── Dataclasses (asdict-serializable for runs.configSnapshot) ───────────────
@dataclass
class AgentConfig:
    """Per-agent resolved config (Convex-hydrated or disk/code fallback)."""

    model: str
    temperature: float
    top_p: float
    max_tokens: Optional[int]
    enabled: bool
    system_prompt: str


@dataclass
class RunConfig:
    """The full in-memory config object for one run.

    Loaded once at run start; snapshotted to runs.configSnapshot; never mutated
    mid-run. ``agents`` is keyed by canonical agentKey (llm_config key + the
    three bonus-variant keys).
    """

    workspace_id: str
    agents: dict[str, AgentConfig]
    require_review: bool
    auto_publish: bool
    schedule_enabled: bool


# ── Canonical agentKey → prompt-file mapping (RESEARCH Pattern 7) ───────────
# EXACTLY 11 entries. ``editor.md`` → key ``editor_gate1``; three bonus variants
# each map to their own .md. chronicler/qa/origin_story/problem/founder_bio/
# case_study deliberately ABSENT — no .md migrated this phase (D-02).
AGENT_KEY_TO_PROMPT_FILE: dict[str, str] = {
    "scout":            "scout",
    "advocate":         "advocate",
    "editor_gate1":     "editor",          # file is editor.md, key is editor_gate1
    "editor_final":     "editor-final",
    "calibrator":       "calibrator",
    "researcher":       "researcher",
    "design":           "design",
    "game":             "game",
    "bonus_big_budget": "bonus-big-budget",
    "bonus_jingle":     "bonus-jingle",
    "bonus_spec_ad":    "bonus-spec-ad",
}

# ── All resolvable agent keys ───────────────────────────────────────────────
# The 15 llm_config keys PLUS the three bonus-variant prompt keys. The three
# bonus variants share MODEL_BY_AGENT["bonus"]/SAMPLING_BY_AGENT["bonus"]/
# MAX_TOKENS_BY_AGENT for model/temp/cap; only their prompts differ.
_BONUS_VARIANT_KEYS = ("bonus_big_budget", "bonus_jingle", "bonus_spec_ad")
ALL_AGENT_KEYS: tuple[str, ...] = tuple(MODEL_BY_AGENT) + _BONUS_VARIANT_KEYS


def _llm_key_for(agent_key: str) -> str:
    """Map a bonus-variant key → the single ``bonus`` llm_config row.

    All other keys return unchanged, so model/temp/max_tokens resolution joins
    the right ``llm_config`` row.
    """
    if agent_key in _BONUS_VARIANT_KEYS:
        return "bonus"
    return agent_key


# ── Snapshot ────────────────────────────────────────────────────────────────
async def snapshot_config(http, run_id: str, config: RunConfig) -> None:
    """Write the full resolved RunConfig to ``runs.configSnapshot`` as JSON.

    MUST be called BEFORE ``asyncio.create_task(_execute_run(...))`` and MUST be
    awaited (not fire-and-forget) — otherwise the snapshot races the run.
    """
    snapshot = json.dumps(dataclasses.asdict(config))
    await convex_mutation(
        http,
        "runs:setConfigSnapshot",
        {"runId": run_id, "configSnapshot": snapshot},
    )


# ── Disk/code fallback oracle (D-06: all-or-nothing) ────────────────────────
def _build_fallback_config() -> RunConfig:
    """Full disk+code fallback (D-06).

    Builds every key in ALL_AGENT_KEYS from ``llm_config`` defaults +
    ``load_prompt()``. ``system_prompt`` bytes are byte-identical to
    ``load_prompt(name)`` for all 11 prompted keys.
    """
    agents: dict[str, AgentConfig] = {}
    for agent_key in ALL_AGENT_KEYS:
        llm_key = _llm_key_for(agent_key)
        sampling = SAMPLING_BY_AGENT.get(llm_key, {})
        prompt_file = AGENT_KEY_TO_PROMPT_FILE.get(agent_key)
        agents[agent_key] = AgentConfig(
            model=MODEL_BY_AGENT[llm_key],
            temperature=sampling.get("temperature", 0.3),
            top_p=sampling.get("top_p", 1.0),
            max_tokens=MAX_TOKENS_BY_AGENT.get(llm_key),
            enabled=True,
            system_prompt=load_prompt(prompt_file) if prompt_file else "",
        )
    return RunConfig(
        workspace_id=WORKSPACE_ID,
        agents=agents,
        require_review=True,
        auto_publish=False,
        schedule_enabled=False,
    )


# ── Run-start loader (two-tier fallback) ────────────────────────────────────
async def load_run_config(http) -> RunConfig:
    """Resolve the full RunConfig for one run (Convex-first, disk/code fallback).

    Called ONCE at run start (in the HTTP handler, before graph.ainvoke).

    Two-tier fallback:
      - Hard Convex failure (D-06): on ANY exception fetching agents/pipeline
        config, log ONE WARNING and return the full disk/code fallback. Never
        raises.
      - Per-key gap (D-07): if Convex is reachable but a single prompt row is
        missing/errors, only that agent falls back to its on-disk prompt + a
        per-agent WARNING. Never raises on a single missing row.
    """
    # ── Single round-trip for agents + pipeline config (D-06 boundary) ──────
    try:
        agents_rows = await convex_query(
            http, "agents:listForWorkspace", {"workspace_id": WORKSPACE_ID}
        )
        pc_rows = await convex_query(
            http, "pipelineConfig:getAll", {"workspace_id": WORKSPACE_ID}
        )
        pc = {r["key"]: json.loads(r["value"]) for r in pc_rows}
    except Exception:
        log.warning(
            "load_run_config: Convex unreachable — using full disk/llm_config "
            "fallback for this run"
        )
        return _build_fallback_config()

    agents_by_key: dict[str, Any] = {r["agentKey"]: r for r in agents_rows}

    agents: dict[str, AgentConfig] = {}
    for agent_key in ALL_AGENT_KEYS:
        llm_key = _llm_key_for(agent_key)
        row = agents_by_key.get(agent_key)

        # Resolve model.
        model = (row.get("model") if row else None) or MODEL_BY_AGENT[llm_key]

        # Resolve sampling.
        sampling = SAMPLING_BY_AGENT.get(llm_key, {})
        temperature = row.get("temperature") if row else None
        if temperature is None:
            temperature = sampling.get("temperature", 0.3)
        top_p = row.get("top_p") if row else None
        if top_p is None:
            top_p = sampling.get("top_p", 1.0)

        max_tokens = (row.get("max_tokens") if row else None) or MAX_TOKENS_BY_AGENT.get(
            llm_key
        )
        enabled = row.get("enabled", True) if row else True

        # Resolve system_prompt (D-07 per-key fallback).
        prompt_file = AGENT_KEY_TO_PROMPT_FILE.get(agent_key)
        system_prompt: Optional[str] = None
        if prompt_file is not None:
            try:
                pv = await convex_query(
                    http,
                    "promptVersions:getActive",
                    {"workspace_id": WORKSPACE_ID, "agentKey": agent_key},
                )
                system_prompt = pv["content"] if pv else None
            except Exception:
                log.warning(
                    "load_run_config: failed to fetch prompt for %s — using "
                    "file fallback",
                    agent_key,
                )
            if system_prompt is None:
                log.warning(
                    "load_run_config: no active prompt_version for %s — using "
                    "file fallback",
                    agent_key,
                )
                system_prompt = load_prompt(prompt_file)
        # else: non-prompted key (e.g. chronicler/qa, D-02) → empty string.

        agents[agent_key] = AgentConfig(
            model=model,
            temperature=temperature,
            top_p=top_p,
            max_tokens=max_tokens,
            enabled=enabled,
            system_prompt=system_prompt or "",
        )

    return RunConfig(
        workspace_id=WORKSPACE_ID,
        agents=agents,
        require_review=pc.get("require_review", True),
        auto_publish=pc.get("auto_publish", False),
        schedule_enabled=pc.get("schedule_enabled", False),
    )
