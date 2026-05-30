"""Phase 18 MEL-08 — Bonus structural-floor applies ONLY to specAd branch.

Asserts:
  1. SpecAdBonus has the _enforce_structural_floor validator on its body field
  2. BigBudgetBonus does NOT have the validator (body stays str — D-04)
  3. JingleBonus does NOT have the validator (body stays str — D-04)

SpecAd assertion is RED at commit (Wave 0); turns GREEN after Plan 18-04.
BigBudget/Jingle assertions are GREEN at commit and STAY GREEN — they assert
an ABSENCE, which is the pre-Phase-18 state and the post-Phase-18 state.

Source: CONTEXT.md D-04; RESEARCH §phase_requirements MEL-08.
"""
from __future__ import annotations

from eisenbalm_pipeline.agents.bonus import (
    BigBudgetBonus,
    JingleBonus,
    SpecAdBonus,
)


def _has_body_field_validator(cls) -> bool:
    """Return True iff the Pydantic class has a validator named '_enforce_structural_floor'
    registered on the 'body' field (Pydantic v2 decorator info lives in
    __pydantic_decorators__.field_validators)."""
    decorators = getattr(cls, "__pydantic_decorators__", None)
    if decorators is None:
        return False
    field_validators = getattr(decorators, "field_validators", {})
    for name, info in field_validators.items():
        # name is the function name; info.info.fields is the tuple of field names
        if name == "_enforce_structural_floor":
            fields = getattr(info.info, "fields", ())
            if "body" in fields:
                return True
    return False


def test_specad_bonus_has_structural_floor_validator():
    """MEL-08 (positive): SpecAdBonus enforces the structural floor on body."""
    assert _has_body_field_validator(SpecAdBonus), (
        "SpecAdBonus.body MUST have @field_validator('body') named "
        "_enforce_structural_floor (CONTEXT D-02 + D-04)"
    )


def test_big_budget_bonus_has_no_structural_floor():
    """MEL-08 (negative): BigBudgetBonus body stays str — D-04 carve-out."""
    assert not _has_body_field_validator(BigBudgetBonus), (
        "BigBudgetBonus must NOT carry the structural-floor validator — "
        "its body remains str; visual variety comes from storyboards[] (D-04)"
    )


def test_jingle_bonus_has_no_structural_floor():
    """MEL-08 (negative): JingleBonus body stays str — D-04 carve-out."""
    assert not _has_body_field_validator(JingleBonus), (
        "JingleBonus must NOT carry the structural-floor validator — "
        "its body remains str; visual variety comes from lyrics + sunoPrompt (D-04)"
    )
