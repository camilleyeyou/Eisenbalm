"""Phase 5 DesignAgent — Haiku via OpenRouter + programmatic validation.

Replaces the Phase 4 stub (preserved under Plan 05-04 to keep the package
import surface stable). Pipeline:

  1. Call LLM → ThemeOutput (4 hex + 2 font names)
  2. validate_theme() (hex regex + WCAG-AA contrast) + font_whitelist check
  3. If errors AND attempt==1: retry with errors injected into prompt
  4. If errors AND attempt==2: fall back to SAFE_THEME + FALLBACK_FONT_*
                               + write qaCorrections severity='warning'
  5. Return validated theme + modelVersions['design'] (AGT-17)

Severity 'warning' (NOT 'error') per D-15: DesignAgent fallback is an
operational notice for Andrew, not a brand-failure-grade event. The site
still renders with a safe Phase-2-approved theme.

Validation lives in two modules — kept separate so the Phase 2 render-time
validator (apps/web/lib/theme.ts) and the Phase 5 pre-write validator
(this module) can not drift:

  - lib/wcag.py            → hex regex + WCAG-AA contrast (Phase 2 port)
  - agents/design/font_whitelist → font whitelist (Plan 05-04 candidates)

Re-entry safety: agent_node wrapper emits deliberationEvents AFTER the body
returns, so a regenerate-once retry never double-emits.
"""
from __future__ import annotations

import logging
from typing import Optional

from pydantic import BaseModel

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.agents.design.font_whitelist import (
    FALLBACK_FONT_BODY,
    FALLBACK_FONT_DISPLAY,
    FONT_WHITELIST,
    WHITELIST_BODY,
    WHITELIST_DISPLAY,
)
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.wcag import SAFE_THEME, validate_theme

log = logging.getLogger(__name__)


class ThemeOutput(BaseModel):
    """AGT-13 LLM structured output. Maps 1:1 to graph.state.Theme minus
    visualDirection (carried verbatim from style_brief, not re-emitted by
    the LLM). Field defaults let Pydantic.model_construct() succeed in
    stub mode without validation (FakeOpenRouterClient path)."""

    primaryColor: str = ""
    accentColor: str = ""
    backgroundColor: str = ""
    textColor: str = ""
    fontDisplay: str = ""
    fontBody: str = ""


def _validate_full(theme: dict) -> list[str]:
    """Combine lib/wcag.validate_theme (hex + WCAG-AA) with font whitelist
    enforcement. Returns empty list when the theme is fully valid.

    Caller (the agent body) uses a non-empty list to trigger regenerate-once;
    a non-empty list after the second attempt triggers SAFE_THEME fallback.
    """
    errors = validate_theme(theme)
    if theme.get("fontDisplay") not in FONT_WHITELIST:
        errors.append(
            f"fontDisplay '{theme.get('fontDisplay')}' not in whitelist"
        )
    if theme.get("fontBody") not in FONT_WHITELIST:
        errors.append(
            f"fontBody '{theme.get('fontBody')}' not in whitelist"
        )
    return errors


def _build_messages(
    *,
    charity: dict,
    style_brief: dict,
    retry_errors: Optional[list[str]] = None,
) -> list[dict]:
    """Assemble DesignAgent system + user prompt.

    The system prompt embeds the font whitelist + WCAG-AA constraint
    verbatim so the model has the contract in-context. On retry, the prior
    errors are appended to the user message — D-15 regenerate-once pattern.
    """
    display_list = ", ".join(sorted(WHITELIST_DISPLAY))
    body_list = ", ".join(sorted(WHITELIST_BODY))
    system = (
        "You are the DesignAgent for The Eisenbalm Dispatch.\n\n"
        "AESTHETIC ENVELOPE (Machine Editorial):\n"
        "  backgroundColor: warm paper canvas. Target range near #FAFAF8 "
        "(warm off-white / daylight broadsheet). Do NOT use near-black, "
        "charcoal, or dark canvases for backgroundColor.\n"
        "  textColor: near-black warm ink. Target range near #1A1A1A. "
        "Ensure >= 4.5:1 WCAG-AA contrast with the (light) backgroundColor.\n"
        "  fontDisplay: strongly prefer Cormorant Garamond.\n"
        "  fontBody: strongly prefer Lora.\n"
        "  primaryColor: brand gold #CDA434 register (decorative — "
        "fills, borders, large glyphs; NOT body text on light canvas).\n"
        "  accentColor: brand rust #C2502A register (borders and large "
        "text only; NOT normal body text on light canvas).\n"
        "  Atmosphere / character: editorial magazine on quality paper "
        "with subtle warm ink-wash atmosphere — NOT digital dark-mode.\n\n"
        "Output exactly four six-digit hex colors and two font names. You will not "
        "invent a font. WCAG-AA contrast is a precondition, not a polish step.\n\n"
        f"fontDisplay must be one of: {display_list}\n"
        f"fontBody must be one of: {body_list}\n\n"
        "WCAG-AA: contrast ratio between backgroundColor and textColor "
        ">= 4.5:1. Your choices will be validated programmatically; a "
        "second failure forces a hardcoded fallback."
    )
    user_lines = [
        f"CHARITY: {charity.get('name', '')}",
        f"VISUAL DIRECTION: {style_brief.get('visualDirection', '')}",
        "",
        "Output JSON Theme: primaryColor, accentColor, backgroundColor, "
        "textColor, fontDisplay, fontBody.",
    ]
    if retry_errors:
        user_lines.extend([
            "",
            "PREVIOUS ATTEMPT FAILED VALIDATION:",
            *(f"- {e}" for e in retry_errors),
            "",
            "Fix every error and return a fully valid theme.",
        ])
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": "\n".join(user_lines)},
    ]


async def _call_llm(
    *,
    run_id: str,
    charity: dict,
    style_brief: dict,
    retry_errors: Optional[list[str]] = None,
) -> tuple[dict, dict]:
    """Single LLM call site (kwargs-only per lib.openrouter_client.acomplete).

    Returns (theme_dict, usage_dict). Coerces Pydantic ThemeOutput to dict
    via model_dump() so downstream validation operates on the same shape
    regardless of stub vs real mode.
    """
    messages = _build_messages(
        charity=charity, style_brief=style_brief, retry_errors=retry_errors,
    )
    out_obj, usage = await acomplete(
        agent_id="design",
        run_id=run_id,
        messages=messages,
        response_format=ThemeOutput,
    )
    if hasattr(out_obj, "model_dump"):
        theme_dict = out_obj.model_dump()
    elif isinstance(out_obj, dict):
        theme_dict = dict(out_obj)
    else:
        theme_dict = {}
    return theme_dict, usage


@agent_node(name="design", emit_event="section-draft")
async def design(state: DispatchState) -> DispatchState:
    run_id = state["run_id"]
    charity = state.get("winning_charity") or {}
    style_brief = state.get("style_brief") or {}

    # Attempt 1.
    theme, usage = await _call_llm(
        run_id=run_id, charity=charity, style_brief=style_brief,
    )
    errors = _validate_full(theme)
    resolved_model = usage["resolved_model"]

    if errors:
        # Attempt 2: regenerate once with errors injected (D-15).
        log.info(
            "DesignAgent attempt 1 failed validation (%d errors); regenerating",
            len(errors),
        )
        theme, usage = await _call_llm(
            run_id=run_id,
            charity=charity,
            style_brief=style_brief,
            retry_errors=errors,
        )
        errors = _validate_full(theme)
        resolved_model = usage["resolved_model"]

    if errors:
        # Second failure: fall back to SAFE_THEME + warn for Andrew.
        log.warning(
            "DesignAgent failed validation twice; falling back to SAFE_THEME. "
            "errors=%s",
            errors,
        )
        fallback_summary = (
            f"DesignAgent failed validation twice: {'; '.join(errors)}"
        )
        await convex_mutation_safe(
            "qaCorrections:insert",
            {
                "runId": run_id,
                "agentId": "design",
                "sectionName": "theme",
                "reason": fallback_summary,
                "severity": "warning",  # D-15: operational notice, not error
                "accepted": False,
                "axis": "precision",
                "quotedSpan": str(theme)[:200],
                "suggestedFix": (
                    "Theme fell back to hardcoded safe defaults "
                    "(lib/wcag.SAFE_THEME + FALLBACK_FONT_*)."
                ),
            },
        )
        theme = {
            **SAFE_THEME,
            "fontDisplay": FALLBACK_FONT_DISPLAY,
            "fontBody": FALLBACK_FONT_BODY,
        }

    # Carry visualDirection through from style_brief (not LLM-emitted).
    theme["visualDirection"] = style_brief.get("visualDirection", "")

    # AGT-17: parallel writers each contribute their OWN key to
    # model_versions; the DispatchState Annotated reducer merges across
    # the 7 fan-out branches. Returning only owned keys (no **state)
    # avoids the InvalidUpdate race on shared keys (Phase 4-12 fix).
    return {
        "theme": theme,
        "model_versions": {"design": resolved_model},
    }
