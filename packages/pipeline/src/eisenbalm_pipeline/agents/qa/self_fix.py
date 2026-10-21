"""Quick 261021-7aw — QA self-fix: agents apply their own corrections.

Supersedes the Phase 5 D-02 "annotation-only" contract. After Layer-1 + Layer-2
findings are collected, ``apply_self_fixes`` applies every finding that can be
applied SAFELY to the section text held in pipeline state, BEFORE the Sanity
draft is written. Each finding resolves to one of:

  * ``agent-applied`` — the fix landed in state;
  * ``agent-skipped`` — it could not be applied (span missing/ambiguous, no
    fix available, or a step failed). Nothing was changed.

Safety rules:
  * Unique-substring rule (D-12: never guess) — a quotedSpan must occur
    exactly once across the section's text units, else the finding is skipped.
  * Copy-on-write — state dicts are never mutated; updates are returned.
  * Per-finding try/except — a failure becomes ``agent-skipped``; the run
    never fails because of self-fix.

Reviewed text sections (8): origin_story, problem, founder_bio, case_study,
game, bonus, deliberation_conversation, podcast (the deliberation transcript).
The 9th, ``theme``, is validated deterministically by ``correct_theme``.
"""
from __future__ import annotations

import copy
import logging
from typing import Any

from pydantic import BaseModel

from eisenbalm_pipeline.agents.qa.rules import QAFinding
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.theme_validation import validate_theme_fields
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS
from eisenbalm_pipeline.lib.wcag import SAFE_THEME

log = logging.getLogger(__name__)

# Axes that are voice "tells" — a missing suggestedFix is filled by an LLM
# house-voice rewrite (moved here from api/signoffs.py).
VOICE_AXES = {"gravity", "sentiment", "irony-signaling", "machine-tell"}

APPLIED = "agent-applied"
SKIPPED = "agent-skipped"

# QA section name -> DispatchState field holding that section's text.
SECTION_STATE_FIELD: dict[str, str] = {
    "origin_story": "origin_story",
    "problem": "problem_statement",
    "founder_bio": "founder_bio",
    "case_study": "case_study",
    "game": "game",
    "bonus": "bonus",
    "deliberation_conversation": "deliberation_conversation",
    "podcast": "deliberation_transcript",
}

_THEME_COLOR_FIELDS = ("primaryColor", "accentColor", "backgroundColor", "textColor")
_THEME_FONT_DEFAULTS = {"fontDisplay": "Playfair Display", "fontBody": "Lora"}


class _Rewrite(BaseModel):
    suggestedFix: str


async def generate_voice_rewrite(quoted_span: str, reason: str, run_id: str) -> str:
    """Generate a house-voice rewrite for one span (shared by the Voice Pass
    endpoint and the pipeline self-fix step)."""
    messages = [
        {
            "role": "system",
            "content": (
                f"{VOICE_CONSTRAINTS}\n\n"
                "Rewrite the QUOTED span into Jesse's dry, precise, "
                "Fortune-500 register. Return ONLY the rewritten span text. "
                "Do NOT add AI self-reference, hedging, or sentiment."
            ),
        },
        {
            "role": "user",
            "content": (
                f"QUOTED SPAN: {quoted_span or ''}\n"
                f"REASON THIS IS A TELL: {reason or ''}"
            ),
        },
    ]
    rewrite, _usage = await acomplete(
        agent_id="qa",
        run_id=run_id,
        messages=messages,
        response_format=_Rewrite,
    )
    if hasattr(rewrite, "suggestedFix"):
        return rewrite.suggestedFix
    if isinstance(rewrite, dict):
        return rewrite.get("suggestedFix", "")
    return ""


# ── text-unit access ────────────────────────────────────────────────────────


def _units(work: dict[str, Any], section: str) -> list[tuple[Any, Any]]:
    """Return ``(container, key)`` pairs where ``container[key]`` is an
    editable str for this section inside the working copy."""
    field = SECTION_STATE_FIELD.get(section)
    if field is None:
        return []
    value = work.get(field)
    units: list[tuple[Any, Any]] = []
    if section == "podcast":
        if isinstance(value, str):
            units.append((work, field))
    elif section == "deliberation_conversation":
        for turn in value if isinstance(value, list) else []:
            if isinstance(turn, dict) and isinstance(turn.get("text"), str):
                units.append((turn, "text"))
    elif section == "game":
        if isinstance(value, dict) and isinstance(value.get("description"), str):
            units.append((value, "description"))
    else:
        if not isinstance(value, dict):
            return []
        body = value.get("body")
        if isinstance(body, str):
            units.append((value, "body"))
        elif isinstance(body, list):
            for block in body:
                if not isinstance(block, dict):
                    continue
                if "children" in block:
                    for child in block.get("children") or []:
                        if isinstance(child, dict) and isinstance(child.get("text"), str):
                            units.append((child, "text"))
                elif isinstance(block.get("text"), str):
                    units.append((block, "text"))
    return units


def _apply_span(
    work: dict[str, Any], section: str, span: str | None, fix: str | None
) -> tuple[bool, str]:
    """Replace ``span`` with ``fix`` iff it occurs exactly once. Returns
    ``(applied, reason)``."""
    if not span:
        return False, "no quoted span"
    if not fix:
        return False, "no suggested fix"
    units = _units(work, section)
    hits = [(c, k) for c, k in units if span in c[k]]
    total = sum(c[k].count(span) for c, k in hits)
    if total == 0:
        return False, "span not found"
    if total > 1:
        return False, "ambiguous span"
    container, key = hits[0]
    container[key] = container[key].replace(span, fix, 1)
    return True, "Agent applied the suggested fix."


# ── public API ──────────────────────────────────────────────────────────────


async def apply_self_fixes(
    state: dict, findings: list[QAFinding]
) -> tuple[dict, list[dict]]:
    """Apply findings to a working copy of section state.

    Returns ``(state_updates, resolutions)`` — ``resolutions[i]`` aligns with
    ``findings[i]``: ``{"resolution", "resolutionReason", "suggestedFix"}``.
    Never raises on a per-finding failure.
    """
    run_id = state.get("run_id") or ""
    work: dict[str, Any] = {}
    for field in set(SECTION_STATE_FIELD.values()):
        if state.get(field) is not None:
            work[field] = copy.deepcopy(state[field])
    touched: set[str] = set()
    resolutions: list[dict] = []

    for f in findings:
        fix = f.suggestedFix or None
        try:
            if not fix and f.axis in VOICE_AXES and f.quotedSpan:
                fix = (
                    await generate_voice_rewrite(f.quotedSpan, f.reason, run_id)
                ) or None
            applied, reason = _apply_span(work, f.section, f.quotedSpan, fix)
        except Exception as exc:  # noqa: BLE001 — self-fix must never fail a run
            log.warning("self-fix: finding on %s skipped (%r)", f.section, exc)
            applied, reason = False, "self-fix step failed"
        if applied:
            touched.add(f.section)
        resolutions.append(
            {
                "resolution": APPLIED if applied else SKIPPED,
                "resolutionReason": reason,
                "suggestedFix": fix,
            }
        )

    updates = {
        SECTION_STATE_FIELD[s]: work[SECTION_STATE_FIELD[s]]
        for s in touched
        if SECTION_STATE_FIELD[s] in work
    }
    return updates, resolutions


def correct_theme(theme: dict | None) -> tuple[dict | None, list[dict]]:
    """Replace invalid theme colors/fonts with safe defaults.

    Returns ``(new_theme, findings)`` — one finding dict per corrected field;
    a valid (or missing) theme yields no findings and is returned unchanged.
    """
    if not isinstance(theme, dict):
        return theme, []
    failed = validate_theme_fields(theme)
    if not failed:
        return theme, []
    new_theme = dict(theme)
    findings: list[dict] = []
    for field in failed:
        if field in _THEME_COLOR_FIELDS:
            replacement = SAFE_THEME[field]
        else:
            replacement = _THEME_FONT_DEFAULTS[field]
        findings.append(
            {
                "section": "theme",
                "severity": "warning",
                "axis": "hard-rule",
                "quotedSpan": str(theme.get(field)),
                "suggestedFix": replacement,
                "reason": "Invalid theme value replaced with a safe default.",
            }
        )
        new_theme[field] = replacement
    return new_theme, findings
