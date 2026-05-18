"""WeasyPrint renderer tests (Plan 06-05 fills bodies).

Real WeasyPrint + real vendored fonts per 06-VALIDATION "What to Mock vs Hit Real".
"""
from __future__ import annotations

import json
import re
import zlib
from pathlib import Path

import pytest

from eisenbalm_pipeline.agents.publisher.pdf import (
    _build_fonts_css,
    render_problem_statement_pdf,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"
TINY_TTF = FIXTURES_DIR / "tiny.ttf"


@pytest.fixture
def pdf_content() -> dict:
    return json.loads((FIXTURES_DIR / "sample_pdf_content.json").read_text())


@pytest.fixture
def theme() -> dict:
    return json.loads((FIXTURES_DIR / "sample_theme.json").read_text())


def _decompressed_streams(pdf: bytes) -> list[bytes]:
    """Yield decompressed bytes of every FlateDecode stream in the PDF.

    WeasyPrint 68.1 emits heavily compressed PDFs; TTF font subsets land in
    FlateDecode streams whose name-table strings are UTF-16 BE. Plain
    ``b"PlayfairDisplay" in pdf`` won't find them — we have to decompress.
    """
    streams: list[bytes] = []
    pat = re.compile(rb"<<(.*?)>>\s*stream\s*(.*?)\s*endstream", re.DOTALL)
    for m in pat.finditer(pdf):
        try:
            streams.append(zlib.decompress(m.group(2)))
        except zlib.error:
            continue
    return streams


def _font_embedded(pdf: bytes, family: str) -> bool:
    """Return True if `family` (or its space-stripped form) appears in any
    decompressed PDF stream, in either ASCII or UTF-16-BE encoding.

    TTF name tables encode strings as UTF-16-BE (per OpenType spec), and the
    PostScript name in the font's CFF / cmap subset typically appears as a
    space-stripped ASCII form (e.g. 'PlayfairDisplay-Bold').
    """
    ascii_form = family.encode("ascii")
    stripped_form = family.replace(" ", "").encode("ascii")
    utf16_form = family.encode("utf-16-be")
    for s in _decompressed_streams(pdf):
        if ascii_form in s or stripped_form in s or utf16_form in s:
            return True
    return False


def test_render_produces_nonempty_pdf(pdf_content, theme):
    """PDF-01: render_problem_statement_pdf returns non-empty bytes starting with '%PDF'."""
    pdf = render_problem_statement_pdf(
        issue_number=42,
        charity_name="The Quiet Foundation",
        pdf_content=pdf_content,
        theme=theme,
    )
    assert isinstance(pdf, bytes)
    assert pdf.startswith(b"%PDF-")
    assert len(pdf) > 1000  # plausibly a real PDF, not an empty container


def test_pdf_embeds_inline_ttf(pdf_content, theme):
    """PDF-02: PDF bytes contain inlined font (no http://fonts.googleapis.com URLs)."""
    pdf = render_problem_statement_pdf(
        issue_number=42,
        charity_name="The Quiet Foundation",
        pdf_content=pdf_content,
        theme=theme,
    )
    # NO HTTP-loaded Google Fonts (PDF-02 requirement).
    assert b"fonts.googleapis.com" not in pdf
    assert b"fonts.gstatic.com" not in pdf
    # The chosen display font's family name is embedded somewhere in the PDF.
    # WeasyPrint 68.1 compresses font subsets via FlateDecode, so we have to
    # decompress streams and check both ASCII PostScript names and UTF-16-BE
    # name-table entries.
    assert _font_embedded(pdf, theme["fontDisplay"]), (
        f"Display font '{theme['fontDisplay']}' not embedded in PDF"
    )
    assert _font_embedded(pdf, theme["fontBody"]), (
        f"Body font '{theme['fontBody']}' not embedded in PDF"
    )


def test_pdf_inlines_only_two_fonts(pdf_content, theme):
    """PDF-02: only theme.fontDisplay + theme.fontBody are inlined, not all 17."""
    fonts_css = _build_fonts_css(theme)
    # The CSS string should contain @font-face for ONLY the two configured fonts.
    families_in_css = set(re.findall(r"font-family: '([^']+)'", fonts_css))
    # Bold + Regular variants share the same family name, so we expect EXACTLY 2 unique families.
    assert families_in_css == {theme["fontDisplay"], theme["fontBody"]}, (
        f"Expected exactly 2 unique font families in CSS, got: {families_in_css}"
    )
    # Other whitelist fonts MUST NOT appear (e.g., Inter, Lora, Merriweather, ...)
    assert "Inter" not in fonts_css
    assert "Lora" not in fonts_css
    assert "Merriweather" not in fonts_css


def test_font_configuration_required():
    """PDF-02 Pitfall 2: render without FontConfiguration falls back to system fonts.

    Documents Pitfall 2: the renderer ALWAYS passes FontConfiguration. This
    test asserts the renderer's source code references FontConfiguration so a
    refactor that drops it surfaces here.
    """
    from eisenbalm_pipeline.agents.publisher import pdf as pdf_mod
    source = Path(pdf_mod.__file__).read_text()
    # Required imports + usage.
    assert "FontConfiguration" in source
    assert (
        "font_config=font_config" in source
        or "font_config = font_config" in source
        or "font_config=fc" in source
    )
