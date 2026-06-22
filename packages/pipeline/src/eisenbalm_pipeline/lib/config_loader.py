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
