"""Phase 46 Wave 0 — verify_candidates scaffold (SGE-03).

Guarded by ``pytest.importorskip`` so the WHOLE module SKIPS cleanly (not a
collection error, not a failure) until
``eisenbalm_pipeline.agents.verify_candidates`` exists. Mirrors
``test_verify.py``'s (verify_research) shape — the precedent this node mirrors.

Plan 46-05 replaces every ``pytest.skip(...)`` body below with a real
assertion — the test names are locked by 46-VALIDATION.md's requirement→test
map and must not be renamed.
"""
from __future__ import annotations

import pytest

pytest.importorskip("eisenbalm_pipeline.agents.verify_candidates")


def test_kills_definitive_failure() -> None:
    """SGE-03 / D-12: a candidate is killed only on a DEFINITIVE failure
    (domain does not resolve, no registration found, clearly not-obscure)."""
    pytest.skip("filled by 46-05")


def test_keeps_on_transient_error() -> None:
    """SGE-03 / D-12: a transient/ambiguous error (timeout, 5xx, SSL/DNS blip,
    rate-limit) marks the check 'unverified' and KEEPS the candidate — never a
    kill on a blip."""
    pytest.skip("filled by 46-05")


def test_killed_record_has_reason() -> None:
    """SGE-03 / D-13: a killed candidate's VerificationRecord carries a
    non-empty killReason — never silently dropped."""
    pytest.skip("filled by 46-05")
