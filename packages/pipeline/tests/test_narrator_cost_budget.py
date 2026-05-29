"""Phase 16 Wave 0 — Cost delta budget (NRR-10 criterion 7).

≤10% cost delta vs Jesse-default per CONTEXT D-12 + 16-RESEARCH §H.

Approximation: assert that the assembled voice string for any seeded
non-Jesse narrator is at most 1.10x the length of VOICE_CONSTRAINTS. This is
not a perfect cost measurement (token counting would require a tokenizer
dependency) but it is a tight upper bound on the prompt-prefix contribution
to per-call cost, which is what the narrator surface controls.

RED until Plan 16-04 (lib/voice.py) + Plan 16-08 (narrators.json seed) both
land.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest


try:
    from eisenbalm_pipeline.lib.voice import (  # noqa: F401
        VOICE_CONSTRAINTS,
        assemble_voice,
    )
    VOICE_AVAILABLE = True
except ImportError:
    VOICE_AVAILABLE = False


_REPO_ROOT = Path(__file__).resolve().parents[3]
_NARRATORS_JSON = _REPO_ROOT / "apps" / "studio" / "seeds" / "narrators.json"


def _seed_entries() -> list[dict]:
    if not _NARRATORS_JSON.exists():
        return []
    data = json.loads(_NARRATORS_JSON.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return list(data.values())
    return []


@pytest.mark.skipif(not VOICE_AVAILABLE, reason="Plan 16-04 not yet landed")
@pytest.mark.skipif(not _NARRATORS_JSON.exists(), reason="Plan 16-08 not yet landed")
@pytest.mark.parametrize(
    "narrator_slug",
    ["jesse", "maya-rudolph", "werner-herzog"],
)
def test_cost_delta_within_10_percent(narrator_slug: str):
    """assemble_voice(narrator).length must be ≤ 1.10 * VOICE_CONSTRAINTS.length for each seeded narrator."""
    from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, assemble_voice

    entries = _seed_entries()
    entry = next((e for e in entries if e.get("slug") == narrator_slug), None)
    if entry is None:
        pytest.skip(f"narrator '{narrator_slug}' not in seed file yet")

    baseline = len(VOICE_CONSTRAINTS)
    assembled = len(assemble_voice(entry))
    ratio = assembled / baseline if baseline else float("inf")
    assert ratio <= 1.10, (
        f"narrator '{narrator_slug}' assembled voice is {ratio:.2%} of Jesse baseline "
        f"({assembled} chars vs {baseline}); exceeds 10% budget (NRR-10 criterion 7)"
    )
