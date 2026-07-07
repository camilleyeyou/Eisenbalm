"""Phase 31 — warn-only structural-floor counter for operator content edits.

Mirrors the COUNT logic of the raise-based Pydantic `_enforce_structural_floor`
validators in agents/{origin_story,problem,founder_bio,case_study,bonus}.py
(>=2 h2/h3 sub-headers + >=1 blockquote), but NEVER raises. Operator edits are
allowed to violate the editorial structural floor — the content-patch
endpoints surface these as `warnings: [...]` in a 200 response, not a 4xx
(D-08). Distinct mechanism, same count.

Do NOT modify the existing agent-side Pydantic validators to use this helper
— they must stay byte-unchanged (raise-based, at LLM-response-parse time).

Source: docs/API_CONTRACTS.md §31.5.
"""
from __future__ import annotations


def structural_floor_warnings(blocks: list[dict]) -> list[str]:
    """WARN-only floor check for operator edits (D-08). Never raises.

    blocks: [{type, text}].
    """
    heading = sum(1 for b in blocks if b.get("type") in ("h2", "h3"))
    quote = sum(1 for b in blocks if b.get("type") == "blockquote")
    warnings: list[str] = []
    if heading < 2:
        warnings.append(f"structural-floor: {heading}/2 sub-headers (h2/h3)")
    if quote < 1:
        warnings.append(f"structural-floor: {quote}/1 blockquote")
    return warnings
