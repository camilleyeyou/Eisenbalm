"""Vendored TTF helpers for the WeasyPrint renderer (Pitfall 9).

Filenames are normalized deterministically: 'Playfair Display' + 'Regular'
→ 'PlayfairDisplay-Regular.ttf'. Vendored files live at
packages/pipeline/fonts/ (Plan 06-03 adds them).

If a requested family is not yet vendored, FileNotFoundError surfaces with a
diagnostic message so future PRs see "vendor font X" tasks naturally.
"""
from __future__ import annotations

import base64
from pathlib import Path

# packages/pipeline/src/eisenbalm_pipeline/agents/publisher/fonts.py
#   parents[0] = publisher/
#   parents[1] = agents/
#   parents[2] = eisenbalm_pipeline/
#   parents[3] = src/
#   parents[3].parent = packages/pipeline/
FONTS_DIR: Path = Path(__file__).parents[3].parent / "fonts"


def font_filename(family: str, weight: str = "Regular") -> str:
    """Deterministic filename for a (family, weight) pair (Pitfall 9).

    'Playfair Display' + 'Regular' -> 'PlayfairDisplay-Regular.ttf'.
    'Source Serif Pro' + 'Bold'    -> 'SourceSerifPro-Bold.ttf'.
    """
    return f"{family.replace(' ', '')}-{weight}.ttf"


def font_to_base64(family: str, weight: str = "Regular") -> str:
    """Read the vendored TTF and return its base64 (no padding stripped — full b64).

    Raises:
        FileNotFoundError: with diagnostic message if the TTF isn't vendored.
    """
    path = FONTS_DIR / font_filename(family, weight)
    if not path.exists():
        raise FileNotFoundError(
            f"Vendored TTF not found for '{family} {weight}' at {path}. "
            f"Phase 6 setup must vendor this font; see packages/pipeline/fonts/LICENSES/README.md "
            f"for the vendoring procedure."
        )
    return base64.b64encode(path.read_bytes()).decode("ascii")
