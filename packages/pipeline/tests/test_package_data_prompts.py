"""Phase 22 Wave 0 — wheel-safe prompt-resolution guard (MUST PASS now).

Source: .planning/phases/22-config-externalization/22-RESEARCH.md
        (Runtime State Inventory → "CRITICAL: .md files in package data";
        Environment Availability → package-data row).

`load_prompt()` is the production FALLBACK path (used when Convex is
unavailable — CFG-03). It resolves the 11 prompt `.md` files via
`importlib.resources.files("eisenbalm_pipeline")`. If those `.md` files are not
bundled into the Railway wheel (hatchling package-data), `load_prompt()` raises
`FileNotFoundError` in production and the fallback path is dead.

This test parametrizes over all 11 prompt stems and asserts each resolves to a
non-empty string — proving the bundled package data is present and the
`importlib.resources` resolution works. It is NOT xfail — it guards a property
that holds today and must keep holding.
"""
from __future__ import annotations

import pytest

from eisenbalm_pipeline.lib.prompts import load_prompt


# The 11 migrated prompt file stems (RESEARCH D-01; excludes editorial README.md).
PROMPT_FILE_STEMS = [
    "scout",
    "advocate",
    "editor",
    "editor-final",
    "calibrator",
    "researcher",
    "design",
    "game",
    "bonus-big-budget",
    "bonus-jingle",
    "bonus-spec-ad",
]

assert len(PROMPT_FILE_STEMS) == 11, "the canonical migration set is exactly 11 prompts"


@pytest.mark.parametrize("stem", PROMPT_FILE_STEMS)
def test_prompt_resolves_from_package_data(stem: str) -> None:
    """load_prompt(stem) returns a non-empty string from the bundled .md (importlib.resources)."""
    content = load_prompt(stem)
    assert isinstance(content, str)
    assert content.strip(), f"prompts/{stem}.md resolved empty — package-data / extraction broken"
