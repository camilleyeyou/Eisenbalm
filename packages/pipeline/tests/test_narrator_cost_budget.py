"""Phase 16 Wave 0 — Cost delta budget (NRR-10 criterion 7).

≤10% cost delta vs Jesse-default per CONTEXT D-12 + 16-RESEARCH §H.

What CONTEXT D-12 actually budgets: per-narrator persona block + exampleSamples
≤ ~600 tokens (~2400 chars at 4 chars/token). Per 16-RESEARCH §H, 1,800
additional tokens at $0.003-0.015/1K = $0.03-0.07 against a $3-6 baseline,
well under the 10% cap.

This test asserts the per-narrator voiceConstraints + exampleSamples total
stays within the D-12 character budget. This is the surface the narrator
profile actually controls — UNIVERSAL_CORE is fixed across all narrators
so it does NOT contribute to the per-narrator delta.

History: Phase 16 Plan 16-09 corrected the earlier Wave-0 proxy
(``assemble_voice(narrator)`` length ≤ 1.10× ``VOICE_CONSTRAINTS``) which
double-counted the fixed UNIVERSAL_CORE block and produced false-positive
failures for legitimate non-Jesse profiles. The current threshold (2400
chars) is the documented D-12 budget surface.

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
    # Plan 16-08a canonical shape: {"narrators": [...]}.
    if isinstance(data, dict) and isinstance(data.get("narrators"), list):
        return [e for e in data["narrators"] if isinstance(e, dict)]
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return list(data.values())
    return []


# CONTEXT D-12: per-narrator persona + samples budget = ~600 tokens ≈ ~2400 chars
# at the conservative 4-chars/token estimate. UNIVERSAL_CORE is fixed across
# all narrators and does NOT contribute to the per-narrator delta.
_PER_NARRATOR_CHAR_BUDGET = 2400


@pytest.mark.skipif(not VOICE_AVAILABLE, reason="Plan 16-04 not yet landed")
@pytest.mark.skipif(not _NARRATORS_JSON.exists(), reason="Plan 16-08 not yet landed")
@pytest.mark.parametrize(
    "narrator_slug",
    ["jesse", "maya-rudolph", "werner-herzog"],
)
def test_cost_delta_within_10_percent(narrator_slug: str):
    """Per-narrator voiceConstraints + exampleSamples must fit the CONTEXT D-12 budget."""
    entries = _seed_entries()
    entry = next((e for e in entries if e.get("slug") == narrator_slug), None)
    if entry is None:
        pytest.skip(f"narrator '{narrator_slug}' not in seed file yet")

    voice_chars = len(entry.get("voiceConstraints") or "")
    samples_chars = sum(len(s) for s in (entry.get("exampleSamples") or []) if isinstance(s, str))
    total_chars = voice_chars + samples_chars

    assert total_chars <= _PER_NARRATOR_CHAR_BUDGET, (
        f"narrator '{narrator_slug}' voiceConstraints+exampleSamples = "
        f"{total_chars} chars (voice={voice_chars}, samples={samples_chars}); "
        f"exceeds D-12 per-narrator budget of {_PER_NARRATOR_CHAR_BUDGET} chars "
        f"(~600 tokens, NRR-10 criterion 7)."
    )
