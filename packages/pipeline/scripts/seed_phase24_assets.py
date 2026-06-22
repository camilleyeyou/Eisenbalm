#!/usr/bin/env python
"""Phase 24 (PRM-01) — idempotent, byte-verified seed for externalized assets.

Upserts the active v1 ``prompt_versions`` rows for the Phase 24 newly-externalized
assets. For THIS plan (04b) it seeds ``USER_TEMPLATE_KEYS`` (the 11 ``*_user.md``
user-message templates). Plans 05b / 06 extend the seed by passing their own key
tuples (section guidance, rubric, voice constraints) into ``seed_assets()``.

Idempotency + byte-verification (the two non-negotiables):

  1. **Content via ``load_prompt(file)``** — the byte oracle, NEVER a raw file
     read (RESEARCH Pitfall 2). The seeded bytes must equal the loader's disk
     fallback exactly so the Plan 04a byte-equivalence test + the voice
     tripwires stay green after the Plan 04b call-site swap.
  2. **``promptVersions:upsertActive``** — the Plan-02 upsert guard makes this
     idempotent: re-running refreshes content, keeps ``version == 1`` and
     ``isActive == true`` (no version increment, no duplicate rows).

Per-key byte-verification asserts before each upsert:
  - the loaded content is non-empty, and
  - it round-trips through ``prompts._extract`` cleanly (re-wrapping the content
    between the PROMPT START/END markers and re-extracting yields the same bytes
    — proving the file's marker convention is intact and the content carries no
    stray sentinel lines).

Run AFTER the Convex functions are deployed and the env is populated:

    cd packages/pipeline && uv run python scripts/seed_phase24_assets.py

Requires NEXT_PUBLIC_CONVEX_URL + CONVEX_DEPLOY_KEY in the environment (the same
two vars seed_phase22.py + the FastAPI lifespan use).

Source: 24-04b-PLAN.md Task 2; 22-RESEARCH.md Pattern 9 (idempotent seed),
Pitfall 2 (byte mismatch → load_prompt).
"""
from __future__ import annotations

import asyncio
import os
from typing import Iterable

from httpx import AsyncClient

from eisenbalm_pipeline.lib.config_loader import (
    AGENT_KEY_TO_PROMPT_FILE,
    SECTION_GUIDANCE_KEYS,
    USER_TEMPLATE_KEYS,
    WORKSPACE_ID,
)
from eisenbalm_pipeline.lib.convex_client import convex_mutation
from eisenbalm_pipeline.lib.prompts import _END, _START, _extract, load_prompt


def _build_client() -> AsyncClient:
    """Construct a standalone Convex AsyncClient (mirrors seed_phase22.py)."""
    return AsyncClient(
        base_url=os.environ["NEXT_PUBLIC_CONVEX_URL"].rstrip("/"),
        timeout=30.0,
    )


def _byte_verify(agent_key: str, content: str) -> None:
    """Assert the loaded asset content is non-empty + round-trips through _extract.

    Raises AssertionError (fail-loud) if the byte oracle would seed garbage.
    """
    assert content, (
        f"byte-verify: empty content for {agent_key} — refusing to seed an "
        f"empty prompt_versions row"
    )
    # Re-wrap the content between the sentinel markers exactly as the .md file
    # does (load_prompt strips one leading + one trailing newline), then re-run
    # the loader's extractor. The result MUST equal the original content — this
    # proves the content carries no stray PROMPT START/END markers and the
    # marker convention is byte-stable.
    rewrapped = f"{_START}\n{content}\n{_END}"
    assert _extract(rewrapped, agent_key) == content, (
        f"byte-verify: {agent_key} content failed _extract round-trip — the "
        f"asset may contain a stray sentinel marker"
    )


async def seed_assets(
    http: AsyncClient,
    agent_keys: Iterable[str],
    *,
    note: str = "Phase 24 v1 seed — byte-verified user template",
) -> int:
    """Upsert one active v1 prompt_versions row per agent_key. Returns the count.

    Content is sourced through ``load_prompt`` (byte oracle) and byte-verified
    before each idempotent ``promptVersions:upsertActive`` call. ``note`` lets
    each key group carry an accurate provenance label.
    """
    count = 0
    for agent_key in agent_keys:
        prompt_file = AGENT_KEY_TO_PROMPT_FILE[agent_key]
        content = load_prompt(prompt_file)  # byte oracle, never a raw read
        _byte_verify(agent_key, content)
        await convex_mutation(
            http,
            "promptVersions:upsertActive",
            {
                "workspace_id": WORKSPACE_ID,
                "agentKey": agent_key,
                "content": content,
                "note": note,
            },
        )
        count += 1
        print(
            f"  OK promptVersions:upsertActive {agent_key:22s} <- {prompt_file}.md "
            f"({len(content)} bytes)"
        )
    return count


async def main() -> None:
    """Seed Phase 24 assets into live Convex (idempotent).

    Three key groups, each byte-verified against ``load_prompt`` before upsert:
      - USER_TEMPLATE_KEYS (Plan 04b) — the 11 ``*_user.md`` templates
      - SECTION_GUIDANCE_KEYS (Plan 05b) — origin/problem + bio/case-study
        verified/anonymous guidance (the anonymous variants keep their literal
        ``{role}`` placeholder UNFORMATTED — runtime ``.format(role=role)`` is a
        call-site concern, never a seed concern)
      - the singleton ``'rubric'`` key (Plan 05b)
    """
    http = _build_client()
    try:
        print(
            f"Seeding Phase 24 user templates for workspace={WORKSPACE_ID!r} "
            f"({len(USER_TEMPLATE_KEYS)} keys) …"
        )
        n_users = await seed_assets(http, USER_TEMPLATE_KEYS)

        print(
            f"\nSeeding Phase 24 section guidance "
            f"({len(SECTION_GUIDANCE_KEYS)} keys) …"
        )
        n_guidance = await seed_assets(
            http,
            SECTION_GUIDANCE_KEYS,
            note="Phase 24 v1 seed — byte-verified section guidance/rubric",
        )

        print("\nSeeding Phase 24 rubric (1 key) …")
        n_rubric = await seed_assets(
            http,
            ("rubric",),
            note="Phase 24 v1 seed — byte-verified section guidance/rubric",
        )
    finally:
        await http.aclose()

    total = n_users + n_guidance + n_rubric
    print(
        f"\nSeed complete — {total} prompt_versions rows "
        f"({n_users} user templates + {n_guidance} section guidance + "
        f"{n_rubric} rubric; active v1; idempotent; re-runnable)."
    )


if __name__ == "__main__":
    asyncio.run(main())
