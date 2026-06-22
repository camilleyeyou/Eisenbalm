"""Phase 24 Wave 0 — RED tests for the assemble_voice db_voice_override codepath.

PRM-06: VOICE_CONSTRAINTS becomes editable + versioned. The active
``voice_constraints`` prompt_versions row is hydrated into
``RunConfig.voice_constraints`` at run start and threaded into
``assemble_voice(narrator, db_voice_override=...)``.

These tests are RED until Plan 06 adds the ``db_voice_override`` kwarg to
``lib/voice.assemble_voice``. The CRITICAL invariant they lock (24-RESEARCH
Pitfall 4): ``assemble_voice(None)`` WITHOUT an override stays byte-identical to
the code-constant ``VOICE_CONSTRAINTS`` — the import-time sentinel and the
existing ``test_voice.py`` invariants are preserved. Only the new
``db_voice_override`` codepath consults the DB value.

RED mechanism: ``assemble_voice`` does not yet accept ``db_voice_override``, so
the two override tests raise TypeError until Plan 06 lands. The file
import-executes cleanly so collection succeeds.
"""
from __future__ import annotations

from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, assemble_voice


def test_db_override_passthrough():
    """An override byte-equal to VOICE_CONSTRAINTS must pass through unchanged.

    RED until Plan 06 adds the db_voice_override kwarg.
    """
    assert (
        assemble_voice(None, db_voice_override=VOICE_CONSTRAINTS) == VOICE_CONSTRAINTS
    )


def test_db_override_used_when_provided():
    """A non-None override replaces the composed voice entirely (PRM-06).

    RED until Plan 06 adds the db_voice_override kwarg.
    """
    assert assemble_voice(None, db_voice_override="CUSTOM") == "CUSTOM"


def test_none_override_equals_code_constant():
    """The sentinel-preserving invariant: assemble_voice(None) with NO override
    stays byte-identical to the code-constant VOICE_CONSTRAINTS (Pitfall 4).

    This must remain GREEN even after Plan 06 — it guards the import-time
    sentinel + test_voice.py from regression.
    """
    assert assemble_voice(None) == VOICE_CONSTRAINTS
