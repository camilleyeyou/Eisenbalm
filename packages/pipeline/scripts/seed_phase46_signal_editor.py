#!/usr/bin/env python
"""Phase 46 (SGE-01/D-18) — idempotent, byte-verified seed for the Signal
Editor's two externalized prompts.

Thin wrapper around ``scripts.seed_phase24_assets.seed_assets`` (RESEARCH
"Don't Hand-Roll" — reuse the already-generic, already-idempotent,
already-byte-verified seed helper rather than reimplementing the upsert).

Requires NEXT_PUBLIC_CONVEX_URL + CONVEX_DEPLOY_KEY in the environment (same
two vars seed_phase22.py / seed_phase24_assets.py use).

Run:

    cd packages/pipeline && uv run python scripts/seed_phase46_signal_editor.py
"""
from __future__ import annotations

import asyncio

from seed_phase24_assets import _build_client, seed_assets


async def main() -> None:
    http = _build_client()
    try:
        print("Seeding Phase 46 Signal Editor prompts (2 keys) …")
        count = await seed_assets(
            http,
            ("signal_editor", "signal_editor_user"),
            note="Phase 46 v1 seed — Signal Editor",
        )
    finally:
        await http.aclose()

    print(f"\nSeed complete — {count} prompt_versions rows (active v1; idempotent; re-runnable).")


if __name__ == "__main__":
    asyncio.run(main())
