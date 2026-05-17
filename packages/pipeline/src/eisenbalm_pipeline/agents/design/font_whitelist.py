"""Phase 5 D-16 — DesignAgent font whitelist (candidate list pending Andrew approval).

TODO(Andrew): approve or revise this candidate list BEFORE Phase 5 closes.
Each font must be:
  1. Available on Google Fonts (SIL Open Font License or equivalent)
  2. Renderable by WeasyPrint on Ubuntu fontconfig (Phase 6 PDF generation)
  3. Compatible with Phase 2 theme engine validators (apps/web/lib/theme.ts)

Phase 2 already approved 6 fonts; this file extends the list with 19 candidates.
The fallback defaults (FALLBACK_FONT_DISPLAY, FALLBACK_FONT_BODY) are Phase 2-approved
so DesignAgent fallback path is safe even before Andrew approves the extended list.

Plan 05-15 (Wave 8) is where Andrew reviews and signs off on the extended candidates
before the phase closes.
"""
from __future__ import annotations

WHITELIST_DISPLAY: list[str] = [
    # ── Phase 2 approved (locked) ─────────────────────────────────
    "Playfair Display",
    "Lora",
    "Cormorant Garamond",
    "Merriweather",
    "DM Serif Display",
    # ── Phase 5 candidates — Andrew approval pending ──────────────
    "Libre Baskerville",
    "EB Garamond",
    "Crimson Text",
    "Spectral",
    "Source Serif Pro",
    "Josefin Serif",
    "Zilla Slab",
    "Bitter",
]

WHITELIST_BODY: list[str] = [
    # ── Phase 2 approved (locked) ─────────────────────────────────
    "Inter",
    "Lora",
    "Merriweather",
    # ── Phase 5 candidates — Andrew approval pending ──────────────
    "Source Serif Pro",
    "Libre Baskerville",
    "EB Garamond",
    "Crimson Text",
    "PT Serif",
    "Noto Serif",
    "Roboto Slab",
    "IBM Plex Serif",
    "Noto Sans",
]

# Union set for O(1) membership check in agents/design.py validation.
FONT_WHITELIST: set[str] = set(WHITELIST_DISPLAY + WHITELIST_BODY)

# D-16 fallback defaults — used when DesignAgent regenerates twice and still
# emits an unapproved font. Both are Phase 2-approved so the fallback is safe
# even before Andrew reviews the extended candidate list.
FALLBACK_FONT_DISPLAY: str = "Playfair Display"
FALLBACK_FONT_BODY: str = "Source Serif Pro"
