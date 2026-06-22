#!/usr/bin/env python
"""Phase 22 (CFG-02) — live-Convex byte-parity verifier for the seeded prompts.

Standalone companion to ``seed_phase22.py``. For each of the 11 canonical
``(agentKey, prompt_file)`` pairs it:

  1. Computes ``expected = load_prompt(prompt_file)`` (the byte oracle — same
     source the seed wrote from).
  2. Reads the live active row via ``promptVersions:getActive``.
  3. Asserts ``row["content"] == expected`` byte-for-byte, AND
     ``row["version"] == 1`` / ``row["isActive"] is True``.

On ANY missing row or byte diff it prints a FAIL line (with the first differing
line index) and exits non-zero (``sys.exit(1)``). On full success it prints
"11/11 byte-identical" and exits 0. This is the post-deploy manual gate from
22-VALIDATION.md (Manual-Only Verifications).

Run AFTER ``seed_phase22.py``:

    cd packages/pipeline && uv run python scripts/verify_prompt_seed.py

Requires NEXT_PUBLIC_CONVEX_URL + CONVEX_DEPLOY_KEY in the environment.

Source: 22-04-PLAN.md Task 2; 22-RESEARCH.md Pattern 10 (verification script).
"""
from __future__ import annotations

import asyncio
import os
import sys

from httpx import AsyncClient

from eisenbalm_pipeline.lib.config_loader import (
    AGENT_KEY_TO_PROMPT_FILE,
    WORKSPACE_ID,
)
from eisenbalm_pipeline.lib.convex_client import convex_query
from eisenbalm_pipeline.lib.prompts import load_prompt


def _build_client() -> AsyncClient:
    """Construct a standalone Convex AsyncClient (mirrors seed_phase22.py)."""
    return AsyncClient(
        base_url=os.environ["NEXT_PUBLIC_CONVEX_URL"].rstrip("/"),
        timeout=30.0,
    )


def _first_diff_line(expected: str, actual: str) -> int:
    """Return the 1-based index of the first differing line (0 if none)."""
    exp_lines = expected.splitlines()
    act_lines = actual.splitlines()
    for i in range(max(len(exp_lines), len(act_lines))):
        e = exp_lines[i] if i < len(exp_lines) else None
        a = act_lines[i] if i < len(act_lines) else None
        if e != a:
            return i + 1
    return 0


async def main() -> None:
    """Verify every seeded prompt row is byte-identical to load_prompt()."""
    http = _build_client()
    failures = 0
    total = len(AGENT_KEY_TO_PROMPT_FILE)
    try:
        for agent_key, prompt_file in AGENT_KEY_TO_PROMPT_FILE.items():
            expected = load_prompt(prompt_file)
            row = await convex_query(
                http,
                "promptVersions:getActive",
                {"workspace_id": WORKSPACE_ID, "agentKey": agent_key},
            )

            if row is None:
                failures += 1
                print(f"  FAIL {agent_key:18s} — no active prompt_version row (missing)")
                continue

            content = row.get("content")
            if content != expected:
                failures += 1
                line = _first_diff_line(expected, content or "")
                print(
                    f"  FAIL {agent_key:18s} — byte mismatch vs {prompt_file}.md "
                    f"(first diff at line {line})"
                )
                continue

            if row.get("version") != 1:
                failures += 1
                print(
                    f"  FAIL {agent_key:18s} — version={row.get('version')} "
                    f"(expected 1)"
                )
                continue

            if row.get("isActive") is not True:
                failures += 1
                print(
                    f"  FAIL {agent_key:18s} — isActive={row.get('isActive')} "
                    f"(expected True)"
                )
                continue

            print(f"  OK   {agent_key:18s} <- {prompt_file}.md (v1, active, byte-identical)")
    finally:
        await http.aclose()

    if failures:
        print(f"\n{total - failures}/{total} byte-identical — {failures} FAILED.")
        sys.exit(1)

    print(f"\n{total}/{total} byte-identical — all v1/active. PASS.")
    sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
