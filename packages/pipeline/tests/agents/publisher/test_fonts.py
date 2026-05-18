"""Vendored TTF base64 helper tests (Plan 06-05 fills bodies)."""
from __future__ import annotations

import base64

import pytest

from eisenbalm_pipeline.agents.publisher.fonts import (
    FONTS_DIR,
    font_filename,
    font_to_base64,
)


def test_font_to_base64_roundtrip():
    """PDF-02: font_to_base64 returns a string that round-trips back to TTF bytes."""
    b64 = font_to_base64("Playfair Display", "Regular")
    decoded = base64.b64decode(b64)
    # TrueType signature
    assert decoded[:4] == b"\x00\x01\x00\x00", (
        f"Decoded bytes not a TrueType file (got {decoded[:4]!r})"
    )
    # The on-disk file should match
    on_disk = (FONTS_DIR / "PlayfairDisplay-Regular.ttf").read_bytes()
    assert decoded == on_disk


def test_font_filename_normalization():
    """Pitfall 9: 'Playfair Display' + 'Regular' → 'PlayfairDisplay-Regular.ttf'."""
    assert font_filename("Playfair Display", "Regular") == "PlayfairDisplay-Regular.ttf"
    assert font_filename("Source Serif Pro", "Bold") == "SourceSerifPro-Bold.ttf"
    assert font_filename("Inter", "Regular") == "Inter-Regular.ttf"
    # default weight is Regular
    assert font_filename("Source Serif Pro") == "SourceSerifPro-Regular.ttf"


def test_missing_font_raises_clear_error():
    """Pitfall 9: Unknown family raises FileNotFoundError with diagnostic message."""
    with pytest.raises(FileNotFoundError) as excinfo:
        font_to_base64("Nonexistent Family", "Regular")
    msg = str(excinfo.value)
    assert "Nonexistent Family" in msg
    assert "vendor" in msg.lower()  # diagnostic guidance for the engineer
