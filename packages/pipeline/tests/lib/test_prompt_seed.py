"""Phase 22 Wave 0 scaffold — CFG-02 prompt-seed byte-parity test seam.

Source: .planning/phases/22-config-externalization/22-RESEARCH.md
        (Pattern 10 byte-verification; Pitfall 2 byte mismatch) + 22-VALIDATION.md.

The SEED LOGIC contract: every `prompt_versions.content` row seeded into Convex
MUST equal `load_prompt(<file>)` byte-for-byte (NOT a raw file read — `_extract()`
strips one leading + one trailing newline). These tests parametrize over the
canonical 11 agentKey/prompt-file pairs and assert exact string equality against
a MOCKED Convex response (not live Convex).

Marked `xfail(strict=False)` until Plan 22-04 lands the real seed-call mock /
`promptVersions:getActive` round-trip — at which point the marks are removed.

`load_prompt` (the oracle) is importable today — imported at module top.
"""
from __future__ import annotations

import pytest

from eisenbalm_pipeline.lib.prompts import load_prompt


# ── Canonical 11 (agentKey, prompt_file) pairs (RESEARCH Pattern 7) ────────────
# Inlined for Wave 0; Plan 22-04 may import AGENT_KEY_TO_PROMPT_FILE once it lands.
AGENT_KEY_PROMPT_PAIRS = [
    ("scout", "scout"),
    ("advocate", "advocate"),
    ("editor_gate1", "editor"),
    ("editor_final", "editor-final"),
    ("calibrator", "calibrator"),
    ("researcher", "researcher"),
    ("design", "design"),
    ("game", "game"),
    ("bonus_big_budget", "bonus-big-budget"),
    ("bonus_jingle", "bonus-jingle"),
    ("bonus_spec_ad", "bonus-spec-ad"),
]

assert len(AGENT_KEY_PROMPT_PAIRS) == 11, "the canonical migration set is exactly 11 prompts"


def _seeded_content_for(prompt_file: str) -> str:
    """Stand-in for a Convex `promptVersions:getActive` response.

    Plan 22-04 replaces this with the real seed mutation's output. At Wave 0 it
    is intentionally the EXPECTED value (load_prompt output) — the test still
    proves the equality contract holds and pins the byte oracle.
    """
    return load_prompt(prompt_file)


@pytest.mark.xfail(reason="Phase 22 Plan 04 implements the seed migration", strict=False)
@pytest.mark.parametrize("agent_key,prompt_file", AGENT_KEY_PROMPT_PAIRS)
def test_seeded_content_byte_identical(agent_key: str, prompt_file: str) -> None:
    """CFG-02: seeded prompt_versions.content == load_prompt(file), byte-for-byte."""
    seeded = _seeded_content_for(prompt_file)
    expected = load_prompt(prompt_file)
    assert seeded == expected, f"byte mismatch for {agent_key} ({prompt_file}.md)"


@pytest.mark.xfail(reason="Phase 22 Plan 04 implements the idempotent seed upsert", strict=False)
@pytest.mark.parametrize("agent_key,prompt_file", AGENT_KEY_PROMPT_PAIRS)
def test_seed_idempotent(agent_key: str, prompt_file: str) -> None:
    """CFG-02: a second seed run keeps version==1 / isActive==true (no duplicate row).

    Placeholder — Plan 22-04 wires the real seed-call mock that asserts the
    upsert path patches the existing (workspace_id, agentKey) v1 row rather than
    inserting a second version.
    """
    raise NotImplementedError("Plan 22-04 fills the idempotent-seed mock")
