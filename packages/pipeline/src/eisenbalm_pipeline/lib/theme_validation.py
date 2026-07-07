"""Phase 31 — operator-facing theme validator for content-patch endpoints.

The single HARD-block gate for `PATCH /issues/{run_id}/theme` (EDT-02). The
canonical font whitelist here MIRRORS `apps/web/lib/theme.ts` FONT_WHITELIST
(the render-time gate — what actually breaks if violated), NOT the drifted
17-entry `agents/design/font_whitelist.py` list used by the DesignAgent. That
divergence is a separate, out-of-scope concern (DesignAgent output is
regenerate-once-then-fallback safe against its own SAFE_THEME; operator edits
here must match what the live site actually renders).

Source: docs/API_CONTRACTS.md §31.5.
"""
from __future__ import annotations

import re

# MIRRORS apps/web/lib/theme.ts FONT_WHITELIST (render-time gate). Keep in sync.
CONTENT_FONT_WHITELIST = frozenset(
    {
        "Playfair Display",
        "Lora",
        "Inter",
        "Cormorant Garamond",
        "Merriweather",
        "DM Serif Display",
        "Fraunces",
        "Newsreader",
        "IBM Plex Mono",
    }
)

HEX_REGEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def validate_theme_fields(theme: dict) -> list[str]:
    """Return list of failed field names (empty = valid). HARD-block on any failure."""
    failed: list[str] = []
    for f in ("primaryColor", "accentColor", "backgroundColor", "textColor"):
        v = theme.get(f)
        if v is not None and not HEX_REGEX.match(str(v)):
            failed.append(f)
    for f in ("fontDisplay", "fontBody"):
        v = theme.get(f)
        if v is not None and v not in CONTENT_FONT_WHITELIST:
            failed.append(f)
    return failed


GAME_EMBED_MAX_BYTES = 50000


def validate_game_embed(embed_code: str) -> bool:
    """True iff embed_code's UTF-8 byte length is within the 50KB cap."""
    return len(embed_code.encode("utf-8")) <= GAME_EMBED_MAX_BYTES
