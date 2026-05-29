"""Phase 16 Wave 0 — Cross-language seed sentinel (NRR-09).

The Jesse narratorProfile seeded in Sanity carries voiceConstraints as a
string. The Python pipeline carries JESSE_PERSONA_BLOCK as a string in
lib/voice.py. Both MUST match or the seed (D-10) and the code diverge.

This test reads apps/studio/seeds/narrators.json and asserts the jesse entry's
voiceConstraints equals JESSE_PERSONA_BLOCK after whitespace normalization.

RED until Plan 16-04 (JESSE_PERSONA_BLOCK) + Plan 16-08 (narrators.json) both
land.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest


try:
    from eisenbalm_pipeline.lib.voice import JESSE_PERSONA_BLOCK  # noqa: F401
    JESSE_PERSONA_AVAILABLE = True
except ImportError:
    JESSE_PERSONA_AVAILABLE = False


# Resolve seed file path relative to repo root.
# packages/pipeline/tests/test_narrator_seed_sentinel.py -> repo root is parents[3]
_REPO_ROOT = Path(__file__).resolve().parents[3]
_NARRATORS_JSON = _REPO_ROOT / "apps" / "studio" / "seeds" / "narrators.json"


@pytest.mark.skipif(
    not JESSE_PERSONA_AVAILABLE,
    reason="Plan 16-04 not yet landed — JESSE_PERSONA_BLOCK missing",
)
@pytest.mark.skipif(
    not _NARRATORS_JSON.exists(),
    reason="Plan 16-08 not yet landed — apps/studio/seeds/narrators.json missing",
)
def test_jesse_seed_matches_persona_block():
    """apps/studio/seeds/narrators.json[jesse].voiceConstraints MUST equal lib.voice.JESSE_PERSONA_BLOCK."""
    from eisenbalm_pipeline.lib.voice import JESSE_PERSONA_BLOCK

    data = json.loads(_NARRATORS_JSON.read_text(encoding="utf-8"))
    # Tolerant lookup: data may be a list of dicts (slug-keyed) or a dict keyed by slug.
    jesse_entry = None
    if isinstance(data, list):
        for entry in data:
            if isinstance(entry, dict) and entry.get("slug") == "jesse":
                jesse_entry = entry
                break
    elif isinstance(data, dict):
        jesse_entry = data.get("jesse")
    assert jesse_entry is not None, (
        f"No 'jesse' entry found in {_NARRATORS_JSON} — seed file must include the explicit default profile (D-10)"
    )

    seeded_voice = (jesse_entry.get("voiceConstraints") or "").strip()
    persona_block = JESSE_PERSONA_BLOCK.strip()
    assert seeded_voice == persona_block, (
        "narrators.json[jesse].voiceConstraints diverged from lib/voice.JESSE_PERSONA_BLOCK. "
        "Update narrators.json OR JESSE_PERSONA_BLOCK so they match (D-10 seed sentinel)."
    )
