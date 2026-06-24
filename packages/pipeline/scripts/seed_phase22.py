#!/usr/bin/env python
"""Phase 22 (CFG-02) — idempotent live-Convex seed for the config control plane.

Writes three things into the workspace's Convex tables, all idempotent by virtue
of the Plan-02 upsert guards (re-running leaves no duplicate rows, keeps prompt
``version == 1`` / ``isActive == true``):

  1. ``agents`` — one row per key in ``ALL_AGENT_KEYS`` (the 15 llm_config keys
     PLUS the 3 bonus variants; bonus_* all point at the single ``bonus``
     llm_config row for model/temp/max_tokens, per D-04/RESEARCH). Model,
     temperature, top_p, max_tokens sourced from ``llm_config``.
  2. ``prompt_versions`` — the 11 active v1 prompts. **Content is sourced
     EXCLUSIVELY through ``load_prompt(file)``** (the byte oracle), NEVER a raw
     file read — this is the byte-mismatch guard (RESEARCH Pitfall 2): the
     seeded bytes must equal the loader's disk fallback exactly so the Plan-05
     call-site swap keeps the voice tripwire tests green.
  3. ``pipeline_config`` — require_review / auto_publish / schedule_enabled
     defaults (JSON-encoded string values).

Run AFTER the Convex functions are deployed and the env is populated:

    cd packages/pipeline && uv run python scripts/seed_phase22.py

Requires NEXT_PUBLIC_CONVEX_URL + CONVEX_DEPLOY_KEY in the environment (the same
two vars the FastAPI lifespan uses to build its Convex client).

Source: 22-04-PLAN.md Task 1; 22-RESEARCH.md Pattern 9 (idempotent seed),
Pitfall 2 (byte mismatch → load_prompt), Pitfall 3 (editor_gate1 agentKey).
"""
from __future__ import annotations

import asyncio
import json
import os

from httpx import AsyncClient

from eisenbalm_pipeline.lib.config_loader import (
    AGENT_KEY_TO_PROMPT_FILE,
    ALL_AGENT_KEYS,
    SYSTEM_PROMPT_KEYS,
    WORKSPACE_ID,
    _llm_key_for,
)
from eisenbalm_pipeline.lib.convex_client import convex_mutation
from eisenbalm_pipeline.lib.llm_config import (
    MAX_TOKENS_BY_AGENT,
    MODEL_BY_AGENT,
    SAMPLING_BY_AGENT,
)
from eisenbalm_pipeline.lib.prompts import load_prompt

# pipeline_config defaults (CFG-04). Values are JSON-encoded strings to match
# the pipelineConfig:upsert ``value: v.string()`` contract + the loader's
# ``json.loads(r["value"])`` read.
_PIPELINE_CONFIG_DEFAULTS: dict[str, object] = {
    "require_review": True,
    "auto_publish": False,
    "schedule_enabled": False,
}


def _build_client() -> AsyncClient:
    """Construct a standalone Convex AsyncClient (mirrors the FastAPI lifespan).

    Uses the same NEXT_PUBLIC_CONVEX_URL base_url + rstrip("/") the lifespan
    applies; ``convex_mutation`` adds the ``Authorization: Convex {key}`` header
    from CONVEX_DEPLOY_KEY per call.
    """
    return AsyncClient(
        base_url=os.environ["NEXT_PUBLIC_CONVEX_URL"].rstrip("/"),
        timeout=30.0,
    )


async def _seed_agents(http: AsyncClient) -> int:
    """Upsert one ``agents`` row per ALL_AGENT_KEYS. Returns the count seeded."""
    count = 0
    for agent_key in ALL_AGENT_KEYS:
        llm_key = _llm_key_for(agent_key)
        sampling = SAMPLING_BY_AGENT.get(llm_key, {})
        args = {
            "workspace_id": WORKSPACE_ID,
            "agentKey": agent_key,
            "enabled": True,
            "model": MODEL_BY_AGENT[llm_key],
            "temperature": sampling.get("temperature", 0.3),
            "top_p": sampling.get("top_p", 1.0),
            "max_tokens": MAX_TOKENS_BY_AGENT.get(llm_key),
            "description": f"{agent_key} agent",
        }
        # Drop None-valued optionals: the agents:upsert validator uses
        # v.optional(v.number()), which accepts an ABSENT key but rejects an
        # explicit null. max_tokens is None for agents with no token cap.
        args = {k: v for k, v in args.items() if v is not None}
        await convex_mutation(http, "agents:upsert", args)
        count += 1
        print(f"  OK agents:upsert        {agent_key:18s} model={args['model']}")
    return count


async def _seed_prompts(http: AsyncClient) -> int:
    """Upsert the 11 active v1 prompts; content via load_prompt() (byte oracle).

    Scoped to the canonical Phase 22 SYSTEM_PROMPT_KEYS — the Phase 24 asset keys
    that also live in AGENT_KEY_TO_PROMPT_FILE are seeded by the Plan 04/05/06
    migration seeds, not here.
    """
    count = 0
    for agent_key in SYSTEM_PROMPT_KEYS:
        prompt_file = AGENT_KEY_TO_PROMPT_FILE[agent_key]
        content = load_prompt(prompt_file)  # byte oracle, never a raw read (Pitfall 2)
        await convex_mutation(
            http,
            "promptVersions:upsertActive",
            {
                "workspace_id": WORKSPACE_ID,
                "agentKey": agent_key,
                "content": content,
                "note": "Phase 22 v1 seed",
            },
        )
        count += 1
        print(
            f"  OK promptVersions:upsert {agent_key:18s} <- {prompt_file}.md "
            f"({len(content)} bytes)"
        )
    return count


async def _seed_pipeline_config(http: AsyncClient) -> int:
    """Upsert the global pipeline_config defaults (JSON-encoded values)."""
    count = 0
    for key, value in _PIPELINE_CONFIG_DEFAULTS.items():
        await convex_mutation(
            http,
            "pipelineConfig:upsert",
            {
                "workspace_id": WORKSPACE_ID,
                "key": key,
                "value": json.dumps(value),
            },
        )
        count += 1
        print(f"  OK pipelineConfig:upsert {key:18s} = {value}")
    return count


async def main() -> None:
    """Seed agents + prompts + pipeline_config into live Convex (idempotent)."""
    http = _build_client()
    try:
        print(f"Seeding Phase 22 config for workspace={WORKSPACE_ID!r} …")
        print("agents:")
        n_agents = await _seed_agents(http)
        print("prompt_versions:")
        n_prompts = await _seed_prompts(http)
        print("pipeline_config:")
        n_config = await _seed_pipeline_config(http)
    finally:
        await http.aclose()

    print(
        f"\nSeed complete — {n_agents} agents, {n_prompts} prompts, "
        f"{n_config} pipeline_config keys (idempotent; re-runnable)."
    )


if __name__ == "__main__":
    asyncio.run(main())
