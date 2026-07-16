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
from dataclasses import dataclass, field
from typing import Any, Optional

import eisenbalm_pipeline.lib.convex_client as _cc
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
    # ── Phase 25 (RUN-06) budget cap fields ──────────────────────────────────
    per_run_cap_usd: float = 10.0
    monthly_cap_usd: float = 0.0        # 0 = unset/disabled
    alert_threshold_pct: float = 80.0
    # ── Phase 24 (PRM-01 / PRM-06) newly-externalized assets ────────────────
    # Each hydrated at run start from the active prompt_versions row for the
    # matching agentKey, with per-key disk/code fallback (CFG-03). None / empty
    # when the seed .md is absent (Plans 04/05/06 land the content).
    voice_constraints: Optional[str] = None
    user_templates: dict[str, str] = field(default_factory=dict)
    section_guidance: dict[str, str] = field(default_factory=dict)
    rubric: Optional[str] = None


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
    # ── Phase 24 newly-externalized assets (file stems match agentKeys, with
    # the section-guidance variants prefixed `section_guidance_`). The .md seed
    # files land in Plans 04/05/06; until then _hydrate_asset() yields None when
    # the file is absent (FileNotFoundError is swallowed). ──────────────────
    # User-message templates (one per agent _build_messages call site).
    "scout_user":               "scout_user",
    "advocate_user":            "advocate_user",
    "calibrator_user":          "calibrator_user",
    "editor_gate1_user":        "editor_gate1_user",
    "editor_final_user":        "editor_final_user",
    "researcher_user":          "researcher_user",
    "game_user":                "game_user",
    "design_user":              "design_user",
    "bonus_big_budget_user":    "bonus_big_budget_user",
    "bonus_jingle_user":        "bonus_jingle_user",
    "bonus_spec_ad_user":       "bonus_spec_ad_user",
    # Section guidance (origin/problem + the verified/anonymous bio + case-study).
    "section_guidance_origin":  "section_guidance_origin",
    "section_guidance_problem": "section_guidance_problem",
    "founder_bio_verified":     "section_guidance_founder_bio_verified",
    "founder_bio_anonymous":    "section_guidance_founder_bio_anonymous",
    "case_study_verified":      "section_guidance_case_study_verified",
    "case_study_anonymous":     "section_guidance_case_study_anonymous",
    # Singleton assets.
    "rubric":                   "rubric",
    "voice_constraints":        "voice_constraints",
    # ── Phase 46 (SGE-01/D-18): Signal Editor's two prompts. NOT part of the
    # frozen Phase-22 SYSTEM_PROMPT_KEYS 11 (RESEARCH Pitfall 7) — this
    # superset map + ALL_AGENT_KEYS/USER_TEMPLATE_KEYS are what
    # load_run_config() and the Phase 46 seed iterate. ────────────────────
    "signal_editor":            "signal_editor",
    "signal_editor_user":       "signal_editor_user",
}

# ── Canonical Phase 22 system-prompt keys (the original 11) ─────────────────
# Frozen subset of AGENT_KEY_TO_PROMPT_FILE that the Phase 22 seed owns. Phase 24
# extended AGENT_KEY_TO_PROMPT_FILE with new asset keys; consumers that mean "the
# 11 migrated system prompts" (e.g. scripts/seed_phase22) MUST iterate this tuple
# rather than the now-larger mapping. The new asset keys are seeded by the
# Plan 04/05/06 migration seeds, not by the Phase 22 seed.
SYSTEM_PROMPT_KEYS: tuple[str, ...] = (
    "scout", "advocate", "editor_gate1", "editor_final", "calibrator",
    "researcher", "design", "game",
    "bonus_big_budget", "bonus_jingle", "bonus_spec_ad",
)


# ── Phase 24: canonical new-asset key registries (data only) ────────────────
# Migration plans 04/05/06 add a .md file + swap a call site; they must NOT
# re-edit config_loader internals. These three tuples are the single source of
# truth for which agentKeys each new RunConfig asset field hydrates.
USER_TEMPLATE_KEYS: tuple[str, ...] = (
    "scout_user", "advocate_user", "calibrator_user", "editor_gate1_user",
    "editor_final_user", "researcher_user", "game_user", "design_user",
    "bonus_big_budget_user", "bonus_jingle_user", "bonus_spec_ad_user",
    # Phase 46 (SGE-01/D-18).
    "signal_editor_user",
)
SECTION_GUIDANCE_KEYS: tuple[str, ...] = (
    "section_guidance_origin", "section_guidance_problem",
    "founder_bio_verified", "founder_bio_anonymous",
    "case_study_verified", "case_study_anonymous",
)
SINGLETON_ASSET_KEYS: tuple[str, ...] = ("rubric", "voice_constraints")

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
    await _cc.convex_mutation(
        http,
        "runs:setConfigSnapshot",
        {"runId": run_id, "configSnapshot": snapshot},
    )


# ── Phase 24 asset hydration helpers (per-key disk fallback, missing-file safe) ─
def _load_prompt_or_none(agent_key: str) -> Optional[str]:
    """Disk-only read for a new asset key; None when the seed .md is absent.

    Mirrors the per-key prompt fallback but is FileNotFoundError-safe: between
    Wave 2 (this plan) and Wave 3 (Plans 04/05/06) the new asset .md files do
    not exist yet, so a missing file must yield None — not raise — to keep the
    pipeline bootable. Returns None when no file mapping exists for the key.
    """
    prompt_file = AGENT_KEY_TO_PROMPT_FILE.get(agent_key)
    if prompt_file is None:
        return None
    try:
        return load_prompt(prompt_file)
    except FileNotFoundError:
        # Missing seed file is an EXPECTED, benign state between Wave 2 (this
        # plan) and Wave 3 (Plans 04/05/06). Logged at DEBUG — not WARNING — so
        # it never breaks the D-06 single-WARNING-per-hard-failure contract.
        log.debug(
            "config_loader: asset seed file for %s not found yet — yielding None "
            "(Plans 04/05/06 land the content)",
            agent_key,
        )
        return None


async def _hydrate_asset(http, agent_key: str) -> Optional[str]:
    """Hydrate one new asset from its active prompt_versions row, disk-fallback.

    Mirrors load_run_config's per-key prompt fallback (D-07): try
    ``promptVersions:getActive``; on exception OR missing row, log a WARNING and
    fall back to the on-disk seed via ``_load_prompt_or_none`` (which is itself
    missing-file safe). Returns None when neither Convex nor disk yields content.
    """
    content: Optional[str] = None
    try:
        pv = await convex_query(
            http,
            "promptVersions:getActive",
            {"workspace_id": WORKSPACE_ID, "agentKey": agent_key},
        )
        content = pv["content"] if pv else None
    except Exception:
        log.warning(
            "config_loader: failed to fetch asset prompt for %s — using file "
            "fallback",
            agent_key,
        )
    if content is None:
        content = _load_prompt_or_none(agent_key)
    return content


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
    # Phase 24 new assets: disk-only, missing-file safe (no Convex in fallback).
    user_templates = {
        k: v for k in USER_TEMPLATE_KEYS if (v := _load_prompt_or_none(k)) is not None
    }
    section_guidance = {
        k: v for k in SECTION_GUIDANCE_KEYS if (v := _load_prompt_or_none(k)) is not None
    }
    return RunConfig(
        workspace_id=WORKSPACE_ID,
        agents=agents,
        require_review=True,
        auto_publish=False,
        schedule_enabled=False,
        per_run_cap_usd=10.0,
        monthly_cap_usd=0.0,
        alert_threshold_pct=80.0,
        voice_constraints=_load_prompt_or_none("voice_constraints"),
        user_templates=user_templates,
        section_guidance=section_guidance,
        rubric=_load_prompt_or_none("rubric"),
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

    # ── Phase 24 new assets: hydrate each from its active prompt_versions row
    # with per-key disk fallback (missing-file safe until Plans 04/05/06). ───
    user_templates: dict[str, str] = {}
    for k in USER_TEMPLATE_KEYS:
        v = await _hydrate_asset(http, k)
        if v is not None:
            user_templates[k] = v
    section_guidance: dict[str, str] = {}
    for k in SECTION_GUIDANCE_KEYS:
        v = await _hydrate_asset(http, k)
        if v is not None:
            section_guidance[k] = v
    rubric = await _hydrate_asset(http, "rubric")
    voice_constraints = await _hydrate_asset(http, "voice_constraints")

    return RunConfig(
        workspace_id=WORKSPACE_ID,
        agents=agents,
        require_review=pc.get("require_review", True),
        auto_publish=pc.get("auto_publish", False),
        schedule_enabled=pc.get("schedule_enabled", False),
        per_run_cap_usd=float(pc.get("per_run_cap_usd", 10.0)),
        monthly_cap_usd=float(pc.get("monthly_cap_usd", 0.0)),
        alert_threshold_pct=float(pc.get("alert_threshold_pct", 80.0)),
        voice_constraints=voice_constraints,
        user_templates=user_templates,
        section_guidance=section_guidance,
        rubric=rubric,
    )
