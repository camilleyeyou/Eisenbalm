---
phase: 06-pdf-generation-webhook-chain
plan: 05
type: execute
wave: 1
depends_on:
  - 01
  - 02
  - 03
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/publisher.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/pdf.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/fonts.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/templates/__init__.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/templates/problem_statement.html.j2
  - packages/pipeline/tests/agents/publisher/test_pdf.py
  - packages/pipeline/tests/agents/publisher/test_fonts.py
autonomous: true
requirements_addressed:
  - PDF-01
  - PDF-02
  - PDF-03

must_haves:
  truths:
    - "agents/publisher.py is promoted to the agents/publisher/ package mirroring agents/design/ and agents/qa/ — Phase 4 stub body preserved verbatim in __init__.py"
    - "render_problem_statement_pdf returns non-empty PDF bytes starting with '%PDF' when called with sample_pdf_content + sample_theme"
    - "Generated PDF inlines exactly the two fonts the theme requested (theme.fontDisplay + theme.fontBody), not all 17 whitelisted fonts"
    - "WeasyPrint @font-face resolves base64 TTF data URLs — no HTTP requests to fonts.googleapis.com during render"
    - "Plan 06-01's test_pdf.py + test_fonts.py skip-marked tests are now unskipped and green"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py"
      provides: "@agent_node publisher (Phase 4 stub body preserved); graph/builder.py import contract unchanged"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/publisher/pdf.py"
      provides: "render_problem_statement_pdf(*, issue_number, charity_name, pdf_content, theme) -> bytes"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/publisher/fonts.py"
      provides: "_font_filename, _font_to_base64, FONTS_DIR helpers"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/publisher/templates/problem_statement.html.j2"
      provides: "Jinja2 HTML template with {% block %} for fonts_css + theme variables"
  key_links:
    - from: "agents/publisher/pdf.py::render_problem_statement_pdf"
      to: "packages/pipeline/fonts/"
      via: "FONTS_DIR + _font_to_base64"
      pattern: "fonts/PlayfairDisplay"
    - from: "agents/publisher/pdf.py"
      to: "agents/publisher/templates/problem_statement.html.j2"
      via: "Jinja2 Environment(FileSystemLoader)"
      pattern: "problem_statement.html.j2"
    - from: "graph/builder.py"
      to: "agents/publisher/__init__.py::publisher"
      via: "import preserved (publisher package re-exports the symbol)"
      pattern: "from eisenbalm_pipeline.agents.publisher import publisher"
---

<objective>
Promote `agents/publisher.py` (a single module) to `agents/publisher/` (a package), mirroring the Phase 5 Plan 05-04 pattern for `agents/design/` and Plan 05-13 for `agents/qa/`. The Phase 4 stub body stays in `__init__.py` for now — Plan 06-07 replaces it with the real `_run_publisher` coroutine. This plan ships the PDF renderer module (`pdf.py`), the base64 font helper (`fonts.py`), and the Jinja2 template (`templates/problem_statement.html.j2`), then unskips the test_pdf.py + test_fonts.py skeletons from Plan 06-01.

Purpose: the renderer + font pipeline is self-contained (no Sanity calls, no Convex calls), so it can ship in Wave 1 in parallel with the webhook libs in Plan 06-04. Plan 06-07 composes both halves.

Scope clarification: the publisher package's `__init__.py` keeps Phase 4's `@agent_node` body. The package promotion is structural — Phase 4 must still pass its PIP-* integration tests, which call `publisher()` directly. The real webhook → Publisher path that Phase 6 introduces lives in a SEPARATE async function (`_run_publisher` in Plan 06-07), not the @agent_node graph entrypoint.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/agents/publisher.py
@packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
@packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py
@packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
@packages/pipeline/tests/agents/publisher/test_pdf.py
@packages/pipeline/tests/agents/publisher/test_fonts.py

<interfaces>
From 06-RESEARCH.md §Pattern 3 (renderer):
```python
TEMPLATES_DIR = Path(__file__).parent / "templates"
FONTS_DIR = Path(__file__).parents[3].parent / "fonts"  # packages/pipeline/fonts/

def _font_filename(family: str, weight: str) -> str:
    # 'Playfair Display' + 'Regular' -> 'PlayfairDisplay-Regular.ttf'
    return f"{family.replace(' ', '')}-{weight}.ttf"

def render_problem_statement_pdf(
    *, issue_number: int, charity_name: str,
    pdf_content: dict, theme: dict,
) -> bytes:
    # 1) Build @font-face for the two theme fonts (Regular + Bold; Bold optional)
    # 2) Render Jinja2 template
    # 3) WeasyPrint with FontConfiguration (REQUIRED — Pitfall 2)
```

From agents/problem.py — pdf_content shape:
```python
{
  "problemStatement": str,         # <=150 words
  "keyDataPoints": [               # exactly 3
    {"stat": str, "source": str}, ...
  ],
  "interventionMechanism": str,    # <=100 words
}
```

theme shape (from agents/design/__init__.py):
```python
{
  "primaryColor": "#1D9E75",       # 6-digit hex
  "accentColor":  "#B5651D",
  "backgroundColor": "#FAF7F0",
  "textColor": "#1A1A1A",
  "fontDisplay": "Playfair Display",
  "fontBody": "Source Serif Pro",
  "visualDirection": "..."         # optional, included in template as flavor text
}
```

Phase 4 publisher.py @agent_node body (lines 47-94 — MUST be preserved verbatim in the new __init__.py):
```python
@agent_node(name="publisher", emit_event="publisher-deploy", payload_builder=_publisher_payload)
async def publisher(state: DispatchState) -> DispatchState:
    # ... see agents/publisher.py lines 52-94
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Promote agents/publisher.py to agents/publisher/ package; preserve Phase 4 body in __init__.py</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher.py (entire file — body MUST be preserved)
    - packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py (mirrors the promotion pattern Plan 05-04 established)
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py (verify the import path is `from eisenbalm_pipeline.agents.publisher import publisher`)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md ("Recommended Project Structure")
  </read_first>
  <files>
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/templates/__init__.py
  </files>
  <action>
1. Delete `packages/pipeline/src/eisenbalm_pipeline/agents/publisher.py`. We're replacing the module with a package of the same name.

2. Create `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` with the EXACT same body as the deleted publisher.py, plus a comment at the top noting the promotion. New content:

```python
"""Publisher package — Phase 4 stub body lives here.

Phase 6 promotes agents/publisher.py to agents/publisher/ (a package) so the
PDF renderer (pdf.py), font helpers (fonts.py), and Jinja2 templates can
co-locate with the @agent_node publisher entrypoint. This file's body is
VERBATIM from the Phase 4 stub publisher.py so:

  - graph/builder.py's `from eisenbalm_pipeline.agents.publisher import publisher`
    still resolves to the same callable.
  - Phase 4 PIP-* integration tests continue to pass without change.
  - Plan 06-07 replaces this stub body with the real Publisher webhook
    coroutine path — at which point the @agent_node here may either stay
    (still called by the graph for pipeline-end Sanity write) or be split
    further. Plan 06-07 decides.

CONTEXT D-18 steps 11 + 12 (canonical write order — Phase 4 lock):

  1. Sanity ``write_issue_draft(state, cost_payload)`` — once, at pipeline end.
     ``pipelineMetadata.runId = state['run_id']`` (Pitfall 6 — nesting matters).
  2. Convex ``pipelineRuns:updateStatus`` with status='awaiting-review' (NOT
     'complete' — Phase 6 webhook flips it to 'complete').
  3. Convex ``deliberationEvents:insert`` eventType='publisher-deploy' —
     emitted by the @agent_node wrapper via emit_event='publisher-deploy'.
"""
from __future__ import annotations

import time

from slugify import slugify

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.lib.cost import cost_payload_to_json, end_run
from eisenbalm_pipeline.lib.sanity_client import (
    get_client as get_sanity_http,
    write_issue_draft,
)


def _publisher_payload(state: DispatchState) -> dict:
    return {
        "issueNumber": state["issue_number"],
        "sanityIssueId": state.get("sanity_issue_id"),
        # Plan 06-07 replaces the stub note with real PDF generation.
        "stubPdfNote": "stub-pdf-not-yet-implemented",
    }


@agent_node(
    name="publisher",
    emit_event="publisher-deploy",
    payload_builder=_publisher_payload,
)
async def publisher(state: DispatchState) -> DispatchState:
    run_id = state["run_id"]
    sanity_http = get_sanity_http()

    cost_payload, duration_ms = end_run(run_id)

    winning = state.get("winning_charity") or {}
    if winning and not state.get("winning_charity_sanity_id"):
        state = {
            **state,
            "winning_charity_sanity_id": f"charity-{slugify(winning['name'])}",
        }

    issue_id = await write_issue_draft(sanity_http, state, cost_payload)

    await convex_mutation_safe(
        "pipelineRuns:updateStatus",
        {
            "runId": run_id,
            "status": "awaiting-review",
            "completedAt": int(time.time() * 1000),
            "durationMs": duration_ms,
            "cost": cost_payload_to_json(cost_payload),
        },
    )

    return {
        **state,
        "sanity_issue_id": issue_id,
    }
```

3. Create `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/templates/__init__.py` as an empty file (makes the directory a Python package so Jinja2's FileSystemLoader can resolve it via importlib if needed — and keeps pytest discovery clean).

4. Verify the import contract is preserved:
```bash
cd packages/pipeline
uv run python -c "from eisenbalm_pipeline.agents.publisher import publisher; print('ok')"
```
This must print `ok` with no ImportError.

5. Run the Phase 4 integration tests to confirm zero regression:
```bash
EISENBALM_STUB_MODE=true uv run pytest tests/test_pipeline_integration.py -x -k "publisher or PIP-" 2>&1 | tail -3
```
The relevant Phase 4 PIP-04 / PIP-06 / PIP-08 tests should remain at their current pass/skip status (no NEW failures).
  </action>
  <verify>
    <automated>cd packages/pipeline && test ! -f src/eisenbalm_pipeline/agents/publisher.py && test -f src/eisenbalm_pipeline/agents/publisher/__init__.py && uv run python -c "from eisenbalm_pipeline.agents.publisher import publisher; print('ok')"</automated>
  </verify>
  <acceptance_criteria>
    - `test -f packages/pipeline/src/eisenbalm_pipeline/agents/publisher.py` returns FALSE (file removed)
    - `test -f packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` returns TRUE
    - `test -f packages/pipeline/src/eisenbalm_pipeline/agents/publisher/templates/__init__.py` returns TRUE
    - `grep -c "def publisher" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` returns `1`
    - `grep -c "emit_event=\"publisher-deploy\"" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` returns `1`
    - `grep -c "write_issue_draft" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` returns `1`
    - `grep -c "status.*awaiting-review" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` returns `1`
    - `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.publisher import publisher; print('ok')"` exits 0
    - `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/ -x --collect-only 2>&1 | grep -c "error"` returns `0` (no import errors anywhere)
  </acceptance_criteria>
  <done>
    publisher.py replaced by publisher/ package; same callable exported; Phase 4 contract preserved.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create fonts.py helper + pdf.py renderer + Jinja2 template</name>
  <read_first>
    - packages/pipeline/fonts/ (Plan 06-03 vendored 4 TTFs — verify FONTS_DIR resolves)
    - packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py (FALLBACK_FONT_DISPLAY / FALLBACK_FONT_BODY — the only two families this plan must support; others raise FileNotFoundError until vendored)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md (Pattern 3 + Pitfalls 2, 3, 9)
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py (after Task 1)
  </read_first>
  <files>
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/fonts.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/pdf.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/templates/problem_statement.html.j2
  </files>
  <action>
1. Create `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/fonts.py`:

```python
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
```

2. Create `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/templates/problem_statement.html.j2`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Issue {{ issue_number }} — {{ charity_name }} — Problem Statement</title>
<style>
{{ fonts_css|safe }}

@page {
  size: A4;
  margin: 25mm 22mm;
  background: {{ theme.backgroundColor }};
}

body {
  font-family: '{{ theme.fontBody }}', Georgia, serif;
  color: {{ theme.textColor }};
  background: {{ theme.backgroundColor }};
  line-height: 1.5;
  font-size: 11pt;
}

h1, h2, h3 {
  font-family: '{{ theme.fontDisplay }}', 'Times New Roman', serif;
  color: {{ theme.primaryColor }};
  font-weight: 700;
  margin-top: 0;
}

h1 { font-size: 24pt; margin-bottom: 6pt; }
h2 { font-size: 14pt; margin-top: 18pt; margin-bottom: 4pt; }

.eyebrow {
  font-family: '{{ theme.fontBody }}', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 8pt;
  color: {{ theme.accentColor }};
  margin-bottom: 10pt;
}

.lead {
  font-size: 12pt;
  margin-bottom: 16pt;
}

.data-points {
  border-top: 1px solid {{ theme.accentColor }};
  padding-top: 12pt;
  margin: 18pt 0;
}
.data-point {
  margin-bottom: 10pt;
  page-break-inside: avoid;
}
.data-point .stat {
  font-family: '{{ theme.fontDisplay }}', serif;
  font-size: 16pt;
  font-weight: 700;
  color: {{ theme.primaryColor }};
  display: block;
}
.data-point .source {
  font-size: 8pt;
  font-style: italic;
  color: {{ theme.accentColor }};
}

.intervention {
  border-left: 3px solid {{ theme.primaryColor }};
  padding-left: 12pt;
  margin: 18pt 0;
}

.footer {
  margin-top: 32pt;
  padding-top: 8pt;
  border-top: 1px solid {{ theme.accentColor }};
  font-size: 8pt;
  color: {{ theme.accentColor }};
  text-align: center;
}
</style>
</head>
<body>

<div class="eyebrow">The Eisenbalm Dispatch — Issue {{ issue_number }}</div>
<h1>{{ charity_name }}</h1>
<h2>The Problem</h2>
<p class="lead">{{ pdf_content.problemStatement }}</p>

<div class="data-points">
  <h2>Key Data Points</h2>
  {% for kdp in pdf_content.keyDataPoints %}
  <div class="data-point">
    <span class="stat">{{ kdp.stat }}</span>
    <span class="source">{{ kdp.source }}</span>
  </div>
  {% endfor %}
</div>

<div class="intervention">
  <h2>Intervention Mechanism</h2>
  <p>{{ pdf_content.interventionMechanism }}</p>
</div>

<div class="footer">
  Generated by the Eisenbalm Dispatch pipeline. 100% of proceeds from the lip balm benefit this charity.
</div>

</body>
</html>
```

3. Create `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/pdf.py`:

```python
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


def _build_fonts_css(theme: dict) -> str:
    """Return the @font-face CSS block for the two theme fonts.

    Inlines Regular for both display + body; Bold is best-effort (skipped if
    the vendored file is missing — Pitfall 3 keeps the PDF lean).
    """
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
```

4. Smoke-verify the renderer (with the Plan 06-01 fixtures + Plan 06-03 vendored fonts):

```bash
cd packages/pipeline
uv run python -c "
import json
from pathlib import Path
from eisenbalm_pipeline.agents.publisher.pdf import render_problem_statement_pdf
pdf_content = json.loads(Path('tests/agents/publisher/fixtures/sample_pdf_content.json').read_text())
theme = json.loads(Path('tests/agents/publisher/fixtures/sample_theme.json').read_text())
pdf = render_problem_statement_pdf(
    issue_number=42,
    charity_name='The Quiet Foundation',
    pdf_content=pdf_content,
    theme=theme,
)
assert pdf.startswith(b'%PDF-'), 'not a valid PDF'
assert len(pdf) > 1000, f'PDF unexpectedly small: {len(pdf)} bytes'
# Verify both fonts were inlined (font name embedded by WeasyPrint)
assert b'PlayfairDisplay' in pdf or b'Playfair' in pdf, 'display font not embedded'
print(f'PDF OK ({len(pdf)} bytes)')
"
```
  </action>
  <verify>
    <automated>cd packages/pipeline && grep -c "def render_problem_statement_pdf" src/eisenbalm_pipeline/agents/publisher/pdf.py && grep -c "FontConfiguration" src/eisenbalm_pipeline/agents/publisher/pdf.py && uv run python -c "
import json
from pathlib import Path
from eisenbalm_pipeline.agents.publisher.pdf import render_problem_statement_pdf
pdf_content = json.loads(Path('tests/agents/publisher/fixtures/sample_pdf_content.json').read_text())
theme = json.loads(Path('tests/agents/publisher/fixtures/sample_theme.json').read_text())
pdf = render_problem_statement_pdf(issue_number=42, charity_name='The Quiet Foundation', pdf_content=pdf_content, theme=theme)
assert pdf.startswith(b'%PDF-') and len(pdf) > 1000
print('ok', len(pdf))
"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "def render_problem_statement_pdf" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/pdf.py` returns `1`
    - `grep -c "def font_to_base64" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/fonts.py` returns `1`
    - `grep -c "def font_filename" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/fonts.py` returns `1`
    - `grep -c "FontConfiguration" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/pdf.py` returns at least `2` (import + usage in write_pdf)
    - `test -f packages/pipeline/src/eisenbalm_pipeline/agents/publisher/templates/problem_statement.html.j2` returns TRUE
    - `grep -c "fonts_css" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/templates/problem_statement.html.j2` returns at least `1`
    - The smoke-render Python one-liner in the verify command exits 0 and the resulting PDF is > 1000 bytes
    - Generated PDF starts with `%PDF-` byte signature
  </acceptance_criteria>
  <done>
    fonts.py + pdf.py + problem_statement.html.j2 land; the renderer produces a valid PDF from the sample fixtures using base64-inlined Playfair Display + Source Serif Pro TTFs.
  </done>
</task>

<task type="auto">
  <name>Task 3: Unskip + flesh out tests/agents/publisher/test_pdf.py and test_fonts.py</name>
  <read_first>
    - packages/pipeline/tests/agents/publisher/test_pdf.py (Wave 0 skeletons — LOCKED test names)
    - packages/pipeline/tests/agents/publisher/test_fonts.py (same)
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/pdf.py (after Task 2)
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/fonts.py (after Task 2)
    - .planning/phases/06-pdf-generation-webhook-chain/06-VALIDATION.md
  </read_first>
  <files>
    - packages/pipeline/tests/agents/publisher/test_pdf.py
    - packages/pipeline/tests/agents/publisher/test_fonts.py
  </files>
  <action>
For each file, remove the `@pytest.mark.skip(...)` decorators and fill in the test bodies. The test NAMES are LOCKED — DO NOT rename. Tests run against REAL WeasyPrint + REAL vendored TTFs (no mocking) per 06-VALIDATION.

**`tests/agents/publisher/test_pdf.py`** (replace the body of each test; keep all module-level fixtures and constants):

```python
"""WeasyPrint renderer tests (Plan 06-05 fills bodies).

Real WeasyPrint + real vendored fonts per 06-VALIDATION "What to Mock vs Hit Real".
"""
from __future__ import annotations

import json
import re
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
    # WeasyPrint embeds the PostScript font name; for Playfair Display that's
    # 'PlayfairDisplay' or similar variants.
    assert b"PlayfairDisplay" in pdf or b"Playfair" in pdf


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
    assert "font_config=font_config" in source or "font_config = font_config" in source or "font_config=fc" in source
```

**`tests/agents/publisher/test_fonts.py`** (replace the body of each test):

```python
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
    assert decoded[:4] == b"\x00\x01\x00\x00", f"Decoded bytes not a TrueType file (got {decoded[:4]!r})"
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
```

Then run:
```bash
cd packages/pipeline
EISENBALM_STUB_MODE=true uv run pytest tests/agents/publisher/test_pdf.py tests/agents/publisher/test_fonts.py -x -v 2>&1 | tail -15
# Expected: 4 passed in test_pdf.py + 3 passed in test_fonts.py = 7 passed, 0 failed.
```
  </action>
  <verify>
    <automated>cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/publisher/test_pdf.py tests/agents/publisher/test_fonts.py -x 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "@pytest.mark.skip" packages/pipeline/tests/agents/publisher/test_pdf.py` returns `0`
    - `grep -c "@pytest.mark.skip" packages/pipeline/tests/agents/publisher/test_fonts.py` returns `0`
    - `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/publisher/test_pdf.py -x 2>&1 | tail -1` shows ≥ 4 passed, 0 failed
    - `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/publisher/test_fonts.py -x 2>&1 | tail -1` shows ≥ 3 passed, 0 failed
    - Each test name from Plan 06-01's locked list is still present (e.g., `grep -c "def test_render_produces_nonempty_pdf" tests/agents/publisher/test_pdf.py` returns `1`)
  </acceptance_criteria>
  <done>
    7 tests pass deterministically. Renderer is end-to-end exercised against real WeasyPrint + real vendored TTFs; no network, no mocking.
  </done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.publisher import publisher; from eisenbalm_pipeline.agents.publisher.pdf import render_problem_statement_pdf; from eisenbalm_pipeline.agents.publisher.fonts import font_to_base64; print('ok')"` exits 0
- `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/publisher/ -x 2>&1 | tail -1` shows ≥ 7 passed (4 PDF + 3 fonts); 4 publisher coroutine tests still skipped (Plan 06-07 unskips)
- Phase 4 + Phase 5 suite still green
- `cd packages/pipeline && du -h tests/agents/publisher/fixtures/tiny.ttf packages/pipeline/fonts/*.ttf 2>/dev/null | head -10` shows all TTFs are reasonable sizes (≤ 500KB each)
</verification>

<success_criteria>
1. agents/publisher.py removed; agents/publisher/ package created with __init__.py preserving Phase 4 stub body
2. agents/publisher/pdf.py renders a valid PDF from sample fixtures
3. agents/publisher/fonts.py exposes font_filename + font_to_base64 with deterministic naming
4. templates/problem_statement.html.j2 is a complete Jinja2 template using theme vars + 3-keyDataPoint structure
5. 7 unit tests pass (4 PDF + 3 fonts); no network, no mocking
6. Phase 4 PIP-* integration tests show NO new failures
</success_criteria>

<output>
After completion, create `.planning/phases/06-pdf-generation-webhook-chain/06-pdf-generation-webhook-chain-05-SUMMARY.md` documenting:
  - The byte sizes of the rendered sample PDF (helps Plan 06-07 size assumptions)
  - Any deviations from the Jinja2 template (extra blocks added, blocks removed)
  - Whether FONTS_DIR resolution worked first try (`Path(__file__).parents[3].parent` is fragile to reorganization — note the actual resolved path)
  - Phase 4 integration test status (any flakes, any new skips)
</output>
