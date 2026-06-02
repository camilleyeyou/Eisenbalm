"""WeasyPrint Problem Statement PDF renderer (PDF-01 + PDF-02).

Inlines exactly the two fonts the issue's theme uses (Pitfall 3 — never inline
all 17). Reads vendored TTF via the fonts.py helper. Requires a
FontConfiguration on both HTML(...) and write_pdf(...) — without it, WeasyPrint
silently drops @font-face rules (Pitfall 2).

Inputs come from Sanity (read via groq_query in Plan 06-07), shaped as:
  - pdf_content: weeklyIssue.problemStatement.pdfContent
  - theme:       weeklyIssue.theme

This module is pure (no network, no I/O beyond vendored fonts + Jinja2
template). Plan 06-07's _run_publisher composes this with sanity_client +
vercel_client + convex.

Source: 06-RESEARCH.md Pattern 3 + Pitfalls 2, 3.
"""
from __future__ import annotations

import logging
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML
from weasyprint.text.fonts import FontConfiguration

from eisenbalm_pipeline.agents.publisher.fonts import font_to_base64

log = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)

# Phase 14 house-palette PDF defaults.
#
# Since Phase 12/14 (DESIGNAGENT_SUPPRESSED), the pipeline no longer writes a
# per-issue ``theme`` to Sanity — the web app renders from the fixed house
# palette in globals.css, and ``weeklyIssue.theme.fontDisplay`` / ``fontBody``
# (and the hex fields) come back null. The Phase 6 renderer predates that
# suppression and assumed those keys were always present, so it KeyError'd on
# every post-Phase-14 issue (observed live 2026-06-01, issue-999601).
#
# These defaults give an on-brand warm-paper PDF (rust display headings, gold
# accents, ink body) using the two VENDORED families (only Playfair Display +
# Source Serif Pro are bundled for base64 inlining — Pitfall 3). When an issue
# DOES carry an explicit theme (e.g. a pre-suppression issue, or if DesignAgent
# is re-enabled), its non-null values win.
_PDF_THEME_DEFAULTS: dict[str, str] = {
    "primaryColor": "#C2502A",       # rust — display headings + section rules
    "accentColor": "#CDA434",        # gold — small accents / hairlines
    "backgroundColor": "#FAFAF8",    # warm paper
    "textColor": "#1A1A1A",          # near-black ink
    "fontDisplay": "Playfair Display",
    "fontBody": "Source Serif Pro",
    "visualDirection": "",
}


def _theme_with_defaults(theme: dict | None) -> dict:
    """Merge the incoming theme over the house defaults, treating null/empty
    values as absent.

    Post-Phase-14 issues carry ``fontDisplay: None`` (key present, value null),
    so a plain ``{**defaults, **theme}`` would re-introduce the None. Filter
    falsy values from the incoming theme before overlaying.
    """
    incoming = {k: v for k, v in (theme or {}).items() if v}
    return {**_PDF_THEME_DEFAULTS, **incoming}


def _build_fonts_css(theme: dict) -> str:
    """Return the @font-face CSS block for the two theme fonts.

    Inlines Regular for both display + body; Bold is best-effort (skipped if
    the vendored file is missing — Pitfall 3 keeps the PDF lean). Missing/null
    theme fonts fall back to the vendored house defaults (_theme_with_defaults).
    """
    theme = _theme_with_defaults(theme)
    families = [theme["fontDisplay"], theme["fontBody"]]
    blocks: list[str] = []
    for family in families:
        # Regular is REQUIRED — raise if missing.
        b64 = font_to_base64(family, "Regular")
        blocks.append(
            f"@font-face {{ font-family: '{family}'; font-weight: normal; "
            f"src: url(data:font/truetype;charset=utf-8;base64,{b64}) "
            f"format('truetype'); }}"
        )
        # Bold is optional — silently skip if not vendored.
        try:
            b64_bold = font_to_base64(family, "Bold")
            blocks.append(
                f"@font-face {{ font-family: '{family}'; font-weight: bold; "
                f"src: url(data:font/truetype;charset=utf-8;base64,{b64_bold}) "
                f"format('truetype'); }}"
            )
        except FileNotFoundError:
            log.info("Bold variant of '%s' not vendored; skipping (PDF still renders).", family)
    return "\n".join(blocks)


def render_problem_statement_pdf(
    *,
    issue_number: int,
    charity_name: str,
    pdf_content: dict,
    theme: dict,
) -> bytes:
    """Render the Problem Statement PDF.

    Parameters:
        issue_number: weeklyIssue.issueNumber
        charity_name: weeklyIssue.charity->name
        pdf_content:  weeklyIssue.problemStatement.pdfContent  (3-keyDataPoint shape)
        theme:        weeklyIssue.theme  (4 hex + 2 fonts + visualDirection)

    Returns:
        PDF bytes (starts with b'%PDF-').
    """
    # Fill missing/null theme keys (Phase 14 suppressed per-issue themes) with
    # the house palette so BOTH the font CSS and the template colors render
    # on-brand instead of empty/black-on-white.
    theme = _theme_with_defaults(theme)
    fonts_css = _build_fonts_css(theme)
    template = _env.get_template("problem_statement.html.j2")
    html = template.render(
        issue_number=issue_number,
        charity_name=charity_name,
        pdf_content=pdf_content,
        theme=theme,
        fonts_css=fonts_css,
    )

    # WeasyPrint requires FontConfiguration to be passed to BOTH HTML and
    # write_pdf for @font-face rules to resolve (Pitfall 2). Construct one
    # per render — do NOT memoize globally.
    font_config = FontConfiguration()
    pdf_bytes = HTML(string=html).write_pdf(font_config=font_config)
    return pdf_bytes
