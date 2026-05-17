"""Andrew-approved font whitelist (D-16 resolved 2026-05-17).

# Approved by Andrew 2026-05-17

Each font is:
  1. Available on Google Fonts (SIL Open Font License or equivalent)
  2. Renderable by WeasyPrint on Ubuntu fontconfig (Phase 6 PDF generation)
  3. Compatible with Phase 2 theme engine validators (apps/web/lib/theme.ts)
  4. Editorial/Fortune-500-serious in feel (no novelty/decorative faces)

Rejected from the Phase 5 candidate list during Andrew's review:
  - Josefin Serif (geometric/decorative — too contemporary for Jesse voice)
  - Zilla Slab (industrial slab — reads zine-y rather than editorial)
  - Roboto Slab (same concern as Zilla Slab)
  - Noto Sans (generic body sans — Inter is the canonical choice)
"""
from __future__ import annotations

WHITELIST_DISPLAY: list[str] = [
    # ── Phase 2 approved (locked) ─────────────────────────────────
    "Playfair Display",
    "Lora",
    "Cormorant Garamond",
    "Merriweather",
    "DM Serif Display",
    # ── Phase 5 — Andrew approved 2026-05-17 ──────────────────────
    "Libre Baskerville",
    "EB Garamond",
    "Crimson Text",
    "Spectral",
    "Source Serif Pro",
    "Bitter",
]

WHITELIST_BODY: list[str] = [
    # ── Phase 2 approved (locked) ─────────────────────────────────
    "Inter",
    "Lora",
    "Merriweather",
    # ── Phase 5 — Andrew approved 2026-05-17 ──────────────────────
    "Source Serif Pro",
    "Libre Baskerville",
    "EB Garamond",
    "Crimson Text",
    "PT Serif",
    "Noto Serif",
    "IBM Plex Serif",
]

# Union set for O(1) membership check in agents/design.py validation.
FONT_WHITELIST: set[str] = set(WHITELIST_DISPLAY + WHITELIST_BODY)

# D-16 fallback defaults — used when DesignAgent regenerates twice and still
# emits an unapproved font. Both are Phase 2-approved so the fallback is safe.
FALLBACK_FONT_DISPLAY: str = "Playfair Display"
FALLBACK_FONT_BODY: str = "Source Serif Pro"
