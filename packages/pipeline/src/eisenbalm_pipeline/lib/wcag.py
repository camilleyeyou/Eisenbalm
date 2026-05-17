"""WCAG-AA contrast — Python port of ``apps/web/lib/theme.ts``.

IMPORTANT (RESEARCH Pitfall 3): uses linearization threshold ``0.03928`` to
match Phase 2's render-time validator exactly. Do NOT change to WCAG 2.1's
``0.04045``; the two validators must agree on every color.

Used by ``agents/design.py`` (Plan 05-14) to validate DesignAgent output
before the Sanity write. Failure path: regenerate-once; second failure
falls back to ``SAFE_THEME``.
"""
from __future__ import annotations

import re

HEX_REGEX = re.compile(r"^#[0-9a-fA-F]{6}$")
WCAG_AA_THRESHOLD = 4.5

# apps/web/lib/theme.ts BRAND_DEFAULTS (lines 67-76) — Phase 2 verified.
# Phase 5 DesignAgent fallback uses these when validation fails twice.
SAFE_THEME: dict[str, str] = {
    "primaryColor":    "#2D5016",         # forest green
    "accentColor":     "#8B1A1A",         # deep crimson
    "backgroundColor": "#FAFAF8",         # warm off-white
    "textColor":       "#1A1A18",         # near-black
    "fontDisplay":     "Playfair Display",
    "fontBody":        "Lora",
}


def validate_hex(color: str) -> bool:
    """Strict 6-digit hex regex. Mirrors apps/web/lib/theme.ts validateHex."""
    if not isinstance(color, str):
        return False
    return bool(HEX_REGEX.match(color))


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert 6-digit hex (post-validate_hex) to (r, g, b) in [0, 255]."""
    r = int(hex_color[1:3], 16)
    g = int(hex_color[3:5], 16)
    b = int(hex_color[5:7], 16)
    return r, g, b


def _srgb_to_linear(channel255: int) -> float:
    """sRGB (0-255) → linearized per apps/web/lib/theme.ts srgbToLinear.

    Threshold ``0.03928`` matches the TypeScript exactly.
    """
    c = channel255 / 255.0
    if c <= 0.03928:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def relative_luminance(hex_color: str) -> float:
    """WCAG 2.x relative luminance. Returns NaN-like 0.0 on invalid input
    (matches apps/web/lib/theme.ts behavior: invalid → NaN; here we
    return 0.0 for simpler arithmetic — passes_wcag_aa returns False below).
    """
    if not validate_hex(hex_color):
        return 0.0
    r, g, b = _hex_to_rgb(hex_color)
    r_l = _srgb_to_linear(r)
    g_l = _srgb_to_linear(g)
    b_l = _srgb_to_linear(b)
    return 0.2126 * r_l + 0.7152 * g_l + 0.0722 * b_l


def contrast_ratio(hex1: str, hex2: str) -> float:
    """WCAG 2.x contrast ratio. Returns 0.0 if either input is invalid
    (so passes_wcag_aa returns False — safe behavior matches Phase 2).
    """
    if not (validate_hex(hex1) and validate_hex(hex2)):
        return 0.0
    l1 = relative_luminance(hex1)
    l2 = relative_luminance(hex2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def passes_wcag_aa(hex_text: str, hex_bg: str) -> bool:
    """True iff (text, bg) contrast ratio >= 4.5:1 (WCAG AA body text).

    Argument order matches apps/web/lib/theme.ts passesWcagAA(textColor, bgColor).
    """
    return contrast_ratio(hex_text, hex_bg) >= WCAG_AA_THRESHOLD


def validate_theme(theme: dict) -> list[str]:
    """Validate a DesignAgent-emitted theme.

    Checks:
      1. All 4 color fields (primaryColor, accentColor, backgroundColor,
         textColor) match HEX_REGEX.
      2. (backgroundColor, textColor) pair passes WCAG AA (>= 4.5:1).

    Returns:
        Empty list if valid. Otherwise list of human-readable error strings.
        Caller (agents/design.py) uses non-empty list to trigger regenerate.

    Note: fontDisplay / fontBody whitelist enforcement is in
    ``agents/design/font_whitelist.py`` (Plan 05-04), not here.
    """
    errors: list[str] = []
    for field in ("primaryColor", "accentColor", "backgroundColor", "textColor"):
        value = theme.get(field, "")
        if not validate_hex(value):
            errors.append(f"{field} invalid 6-digit hex: '{value}'")
    if not errors:
        ratio = contrast_ratio(theme["backgroundColor"], theme["textColor"])
        if ratio < WCAG_AA_THRESHOLD:
            errors.append(
                f"bg/text contrast {ratio:.2f}:1 fails WCAG AA "
                f"(required >= {WCAG_AA_THRESHOLD}:1)"
            )
    return errors
