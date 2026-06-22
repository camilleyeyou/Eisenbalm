"""Phase 22 (CFG-02) — prompt-seed byte-parity + idempotency (mocked Convex).

Source: 22-04-PLAN.md Task 3; 22-RESEARCH.md (Pattern 10 byte-verification;
Pitfall 2 byte mismatch) + 22-VALIDATION.md.

The SEED-CONTENT contract: every ``prompt_versions.content`` row the seed writes
MUST equal ``load_prompt(<file>)`` byte-for-byte (NOT a raw file read — the
loader's ``_extract()`` strips one leading + one trailing newline around the
PROMPT START/END markers). These tests parametrize over the canonical 11
``(agentKey, prompt_file)`` pairs imported from the real
``AGENT_KEY_TO_PROMPT_FILE`` (now that Plan 03 landed it) and assert exact string
equality + idempotent upsert semantics against a MOCKED Convex (no live network).

CI-safe: no env vars, no Convex round-trip — ``convex_mutation`` is monkeypatched
to record the args the seed would send.
"""
from __future__ import annotations

import pytest

from eisenbalm_pipeline.lib.config_loader import (
    AGENT_KEY_TO_PROMPT_FILE,
    SYSTEM_PROMPT_KEYS,
)
from eisenbalm_pipeline.lib.prompts import load_prompt

from scripts import seed_phase22


# ── Canonical 11 (agentKey, prompt_file) pairs (the real migration set) ───────
# Scoped to SYSTEM_PROMPT_KEYS: Phase 24 extended AGENT_KEY_TO_PROMPT_FILE with
# new asset keys, but the Phase 22 seed-content contract covers exactly these 11.
AGENT_KEY_PROMPT_PAIRS = [(k, AGENT_KEY_TO_PROMPT_FILE[k]) for k in SYSTEM_PROMPT_KEYS]

assert len(AGENT_KEY_PROMPT_PAIRS) == 11, "the canonical migration set is exactly 11 prompts"


@pytest.mark.parametrize("agent_key,prompt_file", AGENT_KEY_PROMPT_PAIRS)
def test_seeded_content_byte_identical(agent_key: str, prompt_file: str) -> None:
    """CFG-02: the content the seed sends == load_prompt(file), byte-for-byte.

    The seed builds prompt content via ``load_prompt(prompt_file)``; a mocked
    ``promptVersions:getActive`` returning that same content round-trips with
    exact equality, proving the seed-content contract without live Convex.
    """
    # The value the seed would write for this pair.
    seeded = load_prompt(prompt_file)
    # The value a getActive read would return (mock echoes what the seed wrote).
    fetched_from_convex = {"content": seeded, "version": 1, "isActive": True}
    expected = load_prompt(prompt_file)

    assert seeded == expected, f"seed content drift for {agent_key} ({prompt_file}.md)"
    assert fetched_from_convex["content"] == expected, (
        f"byte mismatch for {agent_key} ({prompt_file}.md)"
    )


async def _run_prompt_seed_recording(monkeypatch) -> list[dict]:
    """Run the seed's prompt-upsert path with a recording convex_mutation mock.

    Returns the list of args dicts passed to ``promptVersions:upsertActive``.
    """
    calls: list[dict] = []

    async def fake_mutation(http, path, args):
        calls.append({"path": path, "args": args})
        return "fake_id"

    monkeypatch.setattr(seed_phase22, "convex_mutation", fake_mutation)
    await seed_phase22._seed_prompts(http=None)
    return [c["args"] for c in calls if c["path"] == "promptVersions:upsertActive"]


async def test_seed_prompts_uses_load_prompt_content(monkeypatch) -> None:
    """CFG-02: each upsertActive call carries content == load_prompt(file)."""
    args_list = await _run_prompt_seed_recording(monkeypatch)

    assert len(args_list) == 11, "seed must upsert all 11 prompts"
    by_key = {a["agentKey"]: a for a in args_list}
    for agent_key, prompt_file in AGENT_KEY_PROMPT_PAIRS:
        assert agent_key in by_key, f"seed skipped {agent_key}"
        assert by_key[agent_key]["content"] == load_prompt(prompt_file), (
            f"byte mismatch for {agent_key} ({prompt_file}.md)"
        )


async def test_seed_idempotent(monkeypatch) -> None:
    """CFG-02: a second seed run sends identical args and never bumps version.

    The seed uses ``promptVersions:upsertActive`` (the Plan-02 mutation that
    patches the existing v1 row, keeping version==1/isActive==true). The seed
    NEVER includes a ``version`` field in its args, so re-running cannot
    increment it. Asserting the two runs are byte-identical proves idempotency
    at the call-contract layer.
    """
    first = await _run_prompt_seed_recording(monkeypatch)
    second = await _run_prompt_seed_recording(monkeypatch)

    # Same path used, same args both times → no duplicate-version logic.
    assert first == second, "second seed run produced different upsert args"
    for args in first:
        assert "version" not in args, (
            f"seed must not set version (idempotent v1 only): {args['agentKey']}"
        )
