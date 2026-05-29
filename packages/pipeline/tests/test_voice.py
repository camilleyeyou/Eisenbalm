"""Phase 16 Wave 0 — Voice byte-equivalence invariants (NRR-03, NRR-10).

These tests are the byte-equivalence gate for the lib/voice.py two-tier
split. They are RED until Plan 16-04 lands UNIVERSAL_CORE + JESSE_PERSONA_BLOCK
+ assemble_voice() such that:

    assemble_voice(None) == VOICE_CONSTRAINTS  (byte-equal to the current Jesse default)
    assemble_voice({'voiceConstraints': JESSE_PERSONA_BLOCK, 'active': True}) == VOICE_CONSTRAINTS

Pitfall A-1/A-2 (16-RESEARCH §A): the separator between UNIVERSAL_CORE and
JESSE_PERSONA_BLOCK and any trailing whitespace must produce byte-identical
output. Plan 16-04 ships an import-time assertion in lib/voice.py; this file
is the pytest-side guardian.
"""
from __future__ import annotations

import pytest

try:
    from eisenbalm_pipeline.lib.voice import (  # noqa: F401
        UNIVERSAL_CORE,
        JESSE_PERSONA_BLOCK,
        VOICE_CONSTRAINTS,
        assemble_voice,
    )
    PHASE_16_VOICE_AVAILABLE = True
except ImportError:
    PHASE_16_VOICE_AVAILABLE = False


pytestmark = pytest.mark.skipif(
    not PHASE_16_VOICE_AVAILABLE,
    reason="Phase 16 Plan 16-04 not yet landed — lib/voice.py two-tier split missing",
)


def test_voice_constants_byte_equivalence():
    """assemble_voice(None) MUST equal VOICE_CONSTRAINTS exactly (NRR-03, NRR-10)."""
    from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, assemble_voice
    assert assemble_voice(None) == VOICE_CONSTRAINTS, (
        "assemble_voice(None) diverged from VOICE_CONSTRAINTS. "
        "The UNIVERSAL_CORE + JESSE_PERSONA_BLOCK split has broken byte-equivalence. "
        "Inspect the separator and trailing whitespace per 16-RESEARCH Pitfall A-1/A-2."
    )


def test_jesse_explicit_narrator_byte_equivalence():
    """A narrator dict carrying JESSE_PERSONA_BLOCK as voiceConstraints MUST produce VOICE_CONSTRAINTS (D-13)."""
    from eisenbalm_pipeline.lib.voice import (
        VOICE_CONSTRAINTS,
        JESSE_PERSONA_BLOCK,
        assemble_voice,
    )
    jesse_explicit = {
        "name": "Jesse Eisenbalm",
        "slug": "jesse",
        "voiceConstraints": JESSE_PERSONA_BLOCK,
        "voiceRubric": "",
        "exampleSamples": [],
        "active": True,
    }
    assert assemble_voice(jesse_explicit) == VOICE_CONSTRAINTS, (
        "assemble_voice(jesse_explicit) diverged from VOICE_CONSTRAINTS. "
        "The seed sentinel (D-10) and the assembly function disagree."
    )


def test_universal_core_contains_dem_04_rule():
    """UNIVERSAL_CORE must include the no-AI-reference rule (DEL-04, CONTEXT D-02)."""
    from eisenbalm_pipeline.lib.voice import UNIVERSAL_CORE
    # The Phase 13 deliberation-no-model-names tripwire depends on this rule
    # surviving every narrator override.
    assert "AI" in UNIVERSAL_CORE or "language model" in UNIVERSAL_CORE.lower(), (
        "UNIVERSAL_CORE missing the DEL-04 no-AI-reference rule"
    )


def test_universal_core_contains_no_exclamation_rule():
    """UNIVERSAL_CORE must forbid exclamation marks (CONTEXT D-02 rule 4)."""
    from eisenbalm_pipeline.lib.voice import UNIVERSAL_CORE
    assert "exclamation" in UNIVERSAL_CORE.lower(), (
        "UNIVERSAL_CORE missing the no-exclamation-marks rule (D-02 rule 4)"
    )
